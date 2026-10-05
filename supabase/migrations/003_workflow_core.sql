-- ARMS workflow core: unified statuses, shipping batches, constraints, audit, transition RPCs.
-- Run in Supabase SQL Editor after 002_branch_workflow.sql.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type device_lifecycle as enum (
    'received_at_branch',
    'awaiting_branch_handover',
    'handed_to_carrier',
    'in_transit_to_service',
    'received_at_warehouse',
    'at_service_center',
    'awaiting_maintenance',
    'in_maintenance',
    'ready_to_return',
    'in_return_transit',
    'received_at_destination',
    'excluded_from_shipment',
    'ready_to_send',
    'excluded'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type shipment_direction as enum ('inbound', 'to_service', 'return');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type shipping_batch_status as enum (
    'draft', 'ready', 'handed_to_carrier', 'received', 'cancelled'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type shipping_item_status as enum ('active', 'removed');
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- Device columns for location + lock after handoff
-- ---------------------------------------------------------------------------
alter table public.maintenance_request_devices
  add column if not exists current_location text not null default 'branch',
  add column if not exists color text,
  add column if not exists locked_after_ship boolean not null default false;

-- Migrate free-text lifecycle values toward unified vocabulary (best-effort)
update public.maintenance_request_devices
set lifecycle_status = case lifecycle_status
  when 'in_shipping' then 'in_transit_to_service'
  when 'under_maintenance' then 'in_maintenance'
  when 'returning_from_service' then 'in_return_transit'
  when 'delivered_to_customer' then 'received_at_destination'
  when 'ready_to_ship' then 'awaiting_branch_handover'
  else lifecycle_status
end
where lifecycle_status in (
  'in_shipping', 'under_maintenance', 'returning_from_service',
  'delivered_to_customer', 'ready_to_ship'
);

-- Uniqueness: receipt number must be unique across devices
do $$ begin
  alter table public.maintenance_request_devices
    add constraint maintenance_request_devices_receipt_number_key unique (receipt_number);
exception when duplicate_object then null;
when unique_violation then null;
end $$;

-- Unique serial when present
create unique index if not exists maintenance_request_devices_serial_unique
  on public.maintenance_request_devices (serial_number)
  where serial_number is not null and length(trim(serial_number)) > 0;

-- ---------------------------------------------------------------------------
-- Shipping batches (canonical)
-- ---------------------------------------------------------------------------
create sequence if not exists public.shipping_batch_number_seq start 1000;

create or replace function public.next_batch_number()
returns text
language plpgsql
as $$
declare n bigint;
begin
  n := nextval('public.shipping_batch_number_seq');
  return 'SB-' || to_char(now(), 'YYYY') || '-' || lpad(n::text, 6, '0');
end;
$$;

create table if not exists public.shipping_batches (
  id uuid primary key default gen_random_uuid(),
  batch_number text not null unique default public.next_batch_number(),
  shipment_number text not null,
  carrier text not null,
  direction shipment_direction not null default 'to_service',
  source_type text not null default 'branch',
  source_name text not null,
  ops_branch_id uuid references public.ops_branches (id),
  destination_type text not null default 'service_center',
  destination_name text not null default 'مركز الصيانة',
  status shipping_batch_status not null default 'ready',
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  handed_to_carrier_at timestamptz,
  handed_to_carrier_by uuid references public.profiles (id),
  received_at timestamptz,
  received_by uuid references public.profiles (id),
  parent_batch_id uuid references public.shipping_batches (id),
  notes text
);

create table if not exists public.shipping_batch_items (
  id uuid primary key default gen_random_uuid(),
  shipping_batch_id uuid not null references public.shipping_batches (id) on delete cascade,
  request_device_id uuid not null references public.maintenance_request_devices (id),
  device_code_snapshot text not null,
  model_snapshot text,
  color_snapshot text,
  status shipping_item_status not null default 'active',
  removed_at timestamptz,
  removed_by uuid references public.profiles (id),
  removal_reason text
);

-- One active item per device across open batches
create unique index if not exists shipping_batch_items_one_active_device
  on public.shipping_batch_items (request_device_id)
  where status = 'active';

create index if not exists idx_shipping_batches_branch on public.shipping_batches (ops_branch_id);
create index if not exists idx_shipping_batches_status on public.shipping_batches (status);
create index if not exists idx_shipping_batch_items_batch on public.shipping_batch_items (shipping_batch_id);

-- ---------------------------------------------------------------------------
-- Audit
-- ---------------------------------------------------------------------------
create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  actor_name text,
  action text not null,
  entity_type text not null,
  entity_id text,
  before_json jsonb,
  after_json jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.write_audit(
  p_actor_id uuid,
  p_actor_name text,
  p_action text,
  p_entity_type text,
  p_entity_id text,
  p_before jsonb default null,
  p_after jsonb default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_events (actor_id, actor_name, action, entity_type, entity_id, before_json, after_json)
  values (p_actor_id, p_actor_name, p_action, p_entity_type, p_entity_id, p_before, p_after);
end;
$$;

-- ---------------------------------------------------------------------------
-- Helper: current profile role
-- ---------------------------------------------------------------------------
create or replace function public.profile_role(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role::text from public.profiles where id = p_user_id;
$$;

-- ---------------------------------------------------------------------------
-- RPC: create shipping batch (maintenance_manager / system_admin)
-- ---------------------------------------------------------------------------
create or replace function public.create_shipping_batch(
  p_shipment_number text,
  p_carrier text,
  p_ops_branch_id uuid,
  p_source_name text,
  p_device_ids uuid[],
  p_notes text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_name text;
  v_batch_id uuid;
  v_device record;
begin
  if v_uid is null then
    raise exception 'يجب تسجيل الدخول';
  end if;

  select role::text, full_name into v_role, v_name from public.profiles where id = v_uid;
  if v_role not in ('maintenance_manager', 'system_admin', 'manager') then
    raise exception 'إنشاء البوليصة مسموح لمدير الصيانة فقط';
  end if;

  if p_device_ids is null or array_length(p_device_ids, 1) is null then
    raise exception 'يجب اختيار جهاز واحد على الأقل';
  end if;

  -- reject devices already on an active batch item
  if exists (
    select 1 from public.shipping_batch_items i
    where i.request_device_id = any(p_device_ids) and i.status = 'active'
  ) then
    raise exception 'أحد الأجهزة مرتبط ببوليصة نشطة بالفعل';
  end if;

  insert into public.shipping_batches (
    shipment_number, carrier, direction, source_type, source_name,
    ops_branch_id, destination_type, destination_name, status, created_by, notes
  ) values (
    p_shipment_number, p_carrier, 'to_service', 'branch', p_source_name,
    p_ops_branch_id, 'service_center', 'مركز الصيانة', 'ready', v_uid, p_notes
  ) returning id into v_batch_id;

  for v_device in
    select d.id, d.device_code, m.name as model_name, d.color, d.lifecycle_status, d.locked_after_ship
    from public.maintenance_request_devices d
    left join public.models m on m.id = d.model_id
    where d.id = any(p_device_ids)
  loop
    if v_device.locked_after_ship then
      raise exception 'الجهاز % مقفل بعد الشحن', v_device.device_code;
    end if;
    insert into public.shipping_batch_items (
      shipping_batch_id, request_device_id, device_code_snapshot, model_snapshot, color_snapshot, status
    ) values (
      v_batch_id, v_device.id, v_device.device_code, v_device.model_name, v_device.color, 'active'
    );
    update public.maintenance_request_devices
    set lifecycle_status = 'awaiting_branch_handover',
        current_location = 'branch'
    where id = v_device.id;
  end loop;

  perform public.write_audit(v_uid, v_name, 'create_shipping_batch', 'shipping_batch', v_batch_id::text, null,
    jsonb_build_object('shipment_number', p_shipment_number, 'carrier', p_carrier, 'device_count', array_length(p_device_ids, 1)));

  return v_batch_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: remove device from batch before handoff
-- ---------------------------------------------------------------------------
create or replace function public.remove_device_from_batch(
  p_item_id uuid,
  p_reason text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_name text;
  v_batch public.shipping_batches%rowtype;
  v_item public.shipping_batch_items%rowtype;
begin
  if v_uid is null then raise exception 'يجب تسجيل الدخول'; end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'سبب الاستبعاد إلزامي';
  end if;

  select role::text, full_name into v_role, v_name from public.profiles where id = v_uid;

  select * into v_item from public.shipping_batch_items where id = p_item_id;
  if not found then raise exception 'عنصر البوليصة غير موجود'; end if;

  select * into v_batch from public.shipping_batches where id = v_item.shipping_batch_id;
  if v_batch.status = 'handed_to_carrier' then
    raise exception 'لا يمكن الاستبعاد بعد التسليم لشركة الشحن';
  end if;

  if v_role not in ('branch', 'branch_employee', 'maintenance_manager', 'system_admin', 'manager') then
    raise exception 'غير مصرح بالاستبعاد';
  end if;

  update public.shipping_batch_items
  set status = 'removed', removed_at = now(), removed_by = v_uid, removal_reason = p_reason
  where id = p_item_id;

  update public.maintenance_request_devices
  set lifecycle_status = 'excluded_from_shipment',
      current_location = 'branch'
  where id = v_item.request_device_id;

  perform public.write_audit(v_uid, v_name, 'remove_device_from_batch', 'shipping_batch_item', p_item_id::text,
    to_jsonb(v_item), jsonb_build_object('reason', p_reason));
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: confirm handed to carrier (branch)
-- ---------------------------------------------------------------------------
create or replace function public.confirm_handed_to_carrier(p_batch_id uuid)
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

  if v_role not in ('branch', 'branch_employee', 'system_admin', 'manager') then
    raise exception 'تأكيد التسليم للشحن مسموح لموظف الفرع';
  end if;

  select * into v_batch from public.shipping_batches where id = p_batch_id for update;
  if not found then raise exception 'البوليصة غير موجودة'; end if;
  if v_batch.status = 'handed_to_carrier' then
    raise exception 'تم تأكيد التسليم مسبقًا';
  end if;
  if v_batch.status not in ('ready', 'draft') then
    raise exception 'حالة البوليصة لا تسمح بالتسليم';
  end if;

  update public.shipping_batches
  set status = 'handed_to_carrier',
      handed_to_carrier_at = now(),
      handed_to_carrier_by = v_uid
  where id = p_batch_id;

  update public.maintenance_request_devices d
  set lifecycle_status = 'in_transit_to_service',
      current_location = 'in_transit_to_service',
      locked_after_ship = true
  from public.shipping_batch_items i
  where i.shipping_batch_id = p_batch_id
    and i.status = 'active'
    and i.request_device_id = d.id;

  perform public.write_audit(v_uid, v_name, 'confirm_handed_to_carrier', 'shipping_batch', p_batch_id::text,
    to_jsonb(v_batch), jsonb_build_object('status', 'handed_to_carrier'));
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.shipping_batches enable row level security;
alter table public.shipping_batch_items enable row level security;
alter table public.audit_events enable row level security;

drop policy if exists "auth read shipping batches" on public.shipping_batches;
create policy "auth read shipping batches" on public.shipping_batches
  for select to authenticated using (true);

drop policy if exists "auth insert shipping batches" on public.shipping_batches;
create policy "auth insert shipping batches" on public.shipping_batches
  for insert to authenticated with check (true);

drop policy if exists "auth update shipping batches" on public.shipping_batches;
create policy "auth update shipping batches" on public.shipping_batches
  for update to authenticated using (true) with check (true);

drop policy if exists "auth read shipping batch items" on public.shipping_batch_items;
create policy "auth read shipping batch items" on public.shipping_batch_items
  for select to authenticated using (true);

drop policy if exists "auth write shipping batch items" on public.shipping_batch_items;
create policy "auth write shipping batch items" on public.shipping_batch_items
  for all to authenticated using (true) with check (true);

drop policy if exists "auth read audit" on public.audit_events;
create policy "auth read audit" on public.audit_events
  for select to authenticated using (true);

grant execute on function public.create_shipping_batch(text, text, uuid, text, uuid[], text) to authenticated;
grant execute on function public.remove_device_from_batch(uuid, text) to authenticated;
grant execute on function public.confirm_handed_to_carrier(uuid) to authenticated;
grant execute on function public.write_audit(uuid, text, text, text, text, jsonb, jsonb) to authenticated;
