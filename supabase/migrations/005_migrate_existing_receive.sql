-- Apply receive status to previously recorded shipping batches and devices.
-- Run in Supabase SQL Editor after 003 and 004.

-- 1) Update RPC to allow receive from ready or handed_to_carrier
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
  if v_batch.status = 'received' then
    raise exception 'تم استلام هذه البوليصة مسبقاً';
  end if;
  if v_batch.status not in ('ready', 'handed_to_carrier') then
    raise exception 'حالة البوليصة لا تسمح بالاستلام';
  end if;

  if not exists (
    select 1 from public.shipping_batch_items
    where shipping_batch_id = p_batch_id and status = 'active'
  ) then
    raise exception 'لا توجد أجهزة نشطة على البوليصة';
  end if;

  update public.shipping_batches
  set status = 'received',
      received_at = now(),
      received_by = v_uid
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

-- 2) Migrate existing batches (ready / handed_to_carrier) → received
update public.shipping_batches b
set status = 'received',
    received_at = coalesce(b.received_at, now())
where b.status in ('ready', 'handed_to_carrier')
  and exists (
    select 1
    from public.shipping_batch_items i
    where i.shipping_batch_id = b.id
      and i.status = 'active'
  );

-- 3) Migrate devices on received batches → awaiting_maintenance
update public.maintenance_request_devices d
set lifecycle_status = 'awaiting_maintenance',
    current_location = 'service_center',
    locked_after_ship = true
from public.shipping_batch_items i
join public.shipping_batches b on b.id = i.shipping_batch_id
where i.request_device_id = d.id
  and i.status = 'active'
  and b.status = 'received'
  and coalesce(d.lifecycle_status, '') not in (
    'awaiting_maintenance', 'in_maintenance', 'under_maintenance'
  );
