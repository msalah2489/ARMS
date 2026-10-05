-- Align DB lifecycle enum + receive RPC with the required device path.
-- Run after 003/004/005.

do $$
begin
  if not exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'device_lifecycle' and e.enumlabel = 'awaiting_manager_decision'
  ) then
    alter type public.device_lifecycle add value 'awaiting_manager_decision';
  end if;
exception when others then
  null;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'device_lifecycle' and e.enumlabel = 'received_damaged'
  ) then
    alter type public.device_lifecycle add value 'received_damaged';
  end if;
exception when others then
  null;
end $$;

-- Receive at service only after handed_to_carrier
create or replace function public.confirm_received_at_service(p_batch_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_name text;
  v_batch public.shipping_batches%rowtype;
begin
  if v_uid is null then raise exception 'يجب تسجيل الدخول'; end if;
  select role::text, full_name into v_role, v_name from public.profiles where id = v_uid;

  if v_role not in ('maintenance_manager', 'system_admin', 'manager') then
    raise exception 'استلام البوليصة مسموح لمدير الصيانة فقط';
  end if;

  select * into v_batch from public.shipping_batches where id = p_batch_id for update;
  if not found then raise exception 'البوليصة غير موجودة'; end if;
  if v_batch.direction <> 'to_service' then
    raise exception 'هذا الاستلام يخص بوالص الإرسال إلى الصيانة';
  end if;
  if v_batch.status = 'received' then
    raise exception 'تم استلام هذه البوليصة مسبقاً';
  end if;
  if v_batch.status <> 'handed_to_carrier' then
    raise exception 'لا يمكن الاستلام إلا بعد أن يؤكد الفرع التسليم لشركة الشحن';
  end if;

  update public.shipping_batches
  set status = 'received', received_at = now(), received_by = v_uid
  where id = p_batch_id;

  update public.maintenance_request_devices d
  set lifecycle_status = 'awaiting_maintenance',
      current_location = 'service_center',
      locked_after_ship = true
  from public.shipping_batch_items i
  where i.shipping_batch_id = p_batch_id
    and i.status = 'active'
    and i.request_device_id = d.id;

  perform public.write_audit(
    v_uid, v_name, 'confirm_received_at_service', 'shipping_batch', p_batch_id::text,
    to_jsonb(v_batch), jsonb_build_object('status', 'received')
  );
end;
$$;

grant execute on function public.confirm_received_at_service(uuid) to authenticated;
