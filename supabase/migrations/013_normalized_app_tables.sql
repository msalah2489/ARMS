-- =============================================================================
-- ARMS: جداول علائقية مرتّبة من arms_client_store (JSON → صفوف/أعمدة)
-- =============================================================================
-- AR: شغّل هذا الملف مرة واحدة في Supabase → SQL Editor → Run.
--     بعد التشغيل:
--       1) تُنشأ جداول app_* بأعمدة واضحة
--       2) تُنسخ البيانات الحالية من payload JSON إلى الجداول
--       3) التطبيق يستمر يعمل عبر arms_client_store + يحدّث الجداول تلقائياً
--
-- EN: Run once in Supabase → SQL Editor. Safe to re-run (idempotent).
--     Creates normalized app_* tables, expand RPC, RLS, and browsing views.
--     Does NOT delete arms_client_store (app still uses it as primary sync).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) Tables
-- ---------------------------------------------------------------------------

-- مستخدمو المنصة (من managed_users)
create table if not exists public.app_users (
  id text primary key,
  username text not null,
  full_name text,
  email text,
  mobile text,
  role text,
  ops_branch_id text,
  ops_branch_name text,
  password_plain text, -- نفس نموذج التطبيق الحالي؛ لا يظهر في VIEW العامة
  is_active boolean not null default true,
  created_at timestamptz,
  updated_at timestamptz,
  synced_at timestamptz not null default now()
);

comment on table public.app_users is 'مستخدمو المنصة — صف لكل مستخدم (من managed_users JSON)';
comment on column public.app_users.full_name is 'الاسم الكامل';
comment on column public.app_users.ops_branch_name is 'اسم الفرع';
comment on column public.app_users.is_active is 'نشط؟';
comment on column public.app_users.password_plain is 'كلمة المرور (لا تُعرض في v_app_users)';

-- فروع العمليات
create table if not exists public.app_ops_branches (
  id text primary key,
  name text not null,
  city text,
  code text,
  is_service_center boolean not null default false,
  created_at timestamptz,
  updated_at timestamptz,
  synced_at timestamptz not null default now()
);

comment on table public.app_ops_branches is 'فروع العمليات — صف لكل فرع';

-- طلبات الصيانة (رأس الطلب)
create table if not exists public.app_maintenance_requests (
  id text primary key,
  request_number text,
  received_at timestamptz,
  ops_branch_id text,
  ops_branch_name text,
  branch_staff_id text,
  branch_staff_name text,
  priority text,
  customer_mobile text,
  contact_name text,
  purchase_invoice text,
  general_notes text,
  device_count integer not null default 0,
  synced_at timestamptz not null default now()
);

comment on table public.app_maintenance_requests is 'طلبات الصيانة — صف لكل طلب (رقم SR، عميل، فرع، أولوية…)';
comment on column public.app_maintenance_requests.request_number is 'رقم الطلب';
comment on column public.app_maintenance_requests.contact_name is 'اسم العميل / جهة الاتصال';
comment on column public.app_maintenance_requests.customer_mobile is 'جوال العميل';
comment on column public.app_maintenance_requests.ops_branch_name is 'الفرع';
comment on column public.app_maintenance_requests.priority is 'الأولوية';
comment on column public.app_maintenance_requests.device_count is 'عدد الأجهزة في الطلب';

-- أجهزة داخل طلبات الصيانة
create table if not exists public.app_request_devices (
  id text primary key, -- requestId::localId
  request_id text not null,
  request_number text,
  local_id text,
  device_code text,
  device_type_name text,
  brand_name text,
  model_name text,
  serial_number text,
  fault text,
  external_condition text,
  color text,
  lifecycle_status text,
  current_location text,
  assigned_technician_id text,
  assigned_technician_name text,
  locked_after_ship boolean,
  accessory_names text,
  extra_details text,
  synced_at timestamptz not null default now()
);

create index if not exists idx_app_request_devices_request
  on public.app_request_devices (request_id);
create index if not exists idx_app_request_devices_code
  on public.app_request_devices (device_code);

comment on table public.app_request_devices is 'أجهزة طلبات الصيانة — صف لكل جهاز داخل طلب';
comment on column public.app_request_devices.device_code is 'كود الجهاز';
comment on column public.app_request_devices.fault is 'العطل';
comment on column public.app_request_devices.lifecycle_status is 'حالة دورة الحياة';
comment on column public.app_request_devices.current_location is 'الموقع الحالي';

-- كتالوج الأجهزة
create table if not exists public.app_catalog_device_types (
  id text primary key,
  name text not null,
  synced_at timestamptz not null default now()
);

create table if not exists public.app_catalog_brands (
  id text primary key,
  name text not null,
  synced_at timestamptz not null default now()
);

create table if not exists public.app_catalog_models (
  id text primary key,
  name text not null,
  device_type_id text,
  brand_id text,
  has_image boolean not null default false,
  accessory_count integer not null default 0,
  spare_part_count integer not null default 0,
  synced_at timestamptz not null default now()
);

comment on table public.app_catalog_brands is 'كتالوج الماركات';
comment on table public.app_catalog_models is 'كتالوج الموديلات';

-- شحنات
create table if not exists public.app_shipping_batches (
  id text primary key,
  batch_number text,
  shipment_number text,
  carrier text,
  direction text,
  source_name text,
  destination_name text,
  ops_branch_id text,
  status text,
  created_by_name text,
  created_at timestamptz,
  handed_to_carrier_at timestamptz,
  received_at timestamptz,
  item_count integer not null default 0,
  notes text,
  synced_at timestamptz not null default now()
);

create table if not exists public.app_shipping_items (
  id text primary key,
  batch_id text not null,
  batch_number text,
  device_code text,
  model_name text,
  color text,
  status text,
  branch_receive_outcome text,
  synced_at timestamptz not null default now()
);

create index if not exists idx_app_shipping_items_batch
  on public.app_shipping_items (batch_id);

comment on table public.app_shipping_batches is 'شحنات — صف لكل دفعة شحن';
comment on table public.app_shipping_items is 'أجهزة داخل الشحنات';

-- عمل الفني
create table if not exists public.app_technician_work (
  id text primary key,
  request_id text,
  request_number text,
  device_local_id text,
  device_code text,
  technician_id text,
  technician_name text,
  started_at timestamptz,
  finished_at timestamptz,
  status text,
  external_check text,
  device_state text,
  outcome text,
  hold_reason text,
  fault_cause text,
  action_taken text,
  test_power boolean,
  test_pump boolean,
  test_light boolean,
  test_sound boolean,
  test_programming boolean,
  spare_parts_summary text,
  synced_at timestamptz not null default now()
);

comment on table public.app_technician_work is 'سجلات عمل الفني — صف لكل جهاز/جلسة صيانة';

-- مخزون قطع الغيار (أرصدة)
create table if not exists public.app_spare_balances (
  id text primary key,
  model_id text,
  model_name text,
  part_id text,
  part_name text,
  color text,
  quantity numeric not null default 0,
  updated_at timestamptz,
  synced_at timestamptz not null default now()
);

comment on table public.app_spare_balances is 'أرصدة قطع الغيار';

-- أحداث التدقيق (ملخّص)
create table if not exists public.app_audit_events (
  id text primary key,
  event_type text,
  actor_name text,
  summary text,
  created_at timestamptz,
  details jsonb,
  synced_at timestamptz not null default now()
);

comment on table public.app_audit_events is 'أحداث التدقيق (ملخّص من audit_events JSON)';

-- بوالص قديمة (waybills)
create table if not exists public.app_waybills (
  id text primary key,
  waybill_number text,
  courier_company text,
  ops_branch_id text,
  device_codes text,
  synced_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2) Expand helpers
-- ---------------------------------------------------------------------------

create or replace function public._arms_json_array(p jsonb)
returns jsonb
language sql
immutable
as $$
  select case
    when p is null then '[]'::jsonb
    when jsonb_typeof(p) = 'array' then p
    else '[]'::jsonb
  end;
$$;

create or replace function public.expand_arms_store_key(p_key text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payload jsonb;
  v_count integer := 0;
  v_now timestamptz := now();
begin
  select payload into v_payload
  from public.arms_client_store
  where store_key = p_key;

  if v_payload is null then
    return 0;
  end if;

  if p_key = 'managed_users' then
    delete from public.app_users;
    insert into public.app_users (
      id, username, full_name, email, mobile, role,
      ops_branch_id, ops_branch_name, password_plain, is_active,
      created_at, updated_at, synced_at
    )
    select
      coalesce(nullif(elem->>'id', ''), gen_random_uuid()::text),
      coalesce(elem->>'username', ''),
      elem->>'fullName',
      elem->>'email',
      elem->>'mobile',
      elem->>'role',
      nullif(elem->>'opsBranchId', ''),
      elem->>'opsBranchName',
      elem->>'password',
      coalesce((elem->>'isActive')::boolean, true),
      nullif(elem->>'createdAt', '')::timestamptz,
      nullif(elem->>'updatedAt', '')::timestamptz,
      v_now
    from jsonb_array_elements(public._arms_json_array(v_payload)) as elem;
    get diagnostics v_count = row_count;

  elsif p_key = 'ops_branches' then
    delete from public.app_ops_branches;
    insert into public.app_ops_branches (
      id, name, city, code, is_service_center, created_at, updated_at, synced_at
    )
    select
      coalesce(nullif(elem->>'id', ''), gen_random_uuid()::text),
      coalesce(elem->>'name', ''),
      elem->>'city',
      elem->>'code',
      coalesce((elem->>'isServiceCenter')::boolean, false),
      nullif(elem->>'createdAt', '')::timestamptz,
      nullif(elem->>'updatedAt', '')::timestamptz,
      v_now
    from jsonb_array_elements(public._arms_json_array(v_payload)) as elem;
    get diagnostics v_count = row_count;

  elsif p_key = 'maintenance_requests' then
    delete from public.app_request_devices;
    delete from public.app_maintenance_requests;

    insert into public.app_maintenance_requests (
      id, request_number, received_at, ops_branch_id, ops_branch_name,
      branch_staff_id, branch_staff_name, priority, customer_mobile,
      contact_name, purchase_invoice, general_notes, device_count, synced_at
    )
    select
      coalesce(nullif(elem->>'id', ''), gen_random_uuid()::text),
      elem->>'requestNumber',
      nullif(elem->>'receivedAt', '')::timestamptz,
      nullif(elem->>'opsBranchId', ''),
      elem->>'opsBranchName',
      nullif(elem->>'branchStaffId', ''),
      elem->>'branchStaffName',
      elem->>'priority',
      elem->>'customerMobile',
      elem->>'contactName',
      elem->>'purchaseInvoice',
      elem->>'generalNotes',
      coalesce(jsonb_array_length(public._arms_json_array(elem->'devices')), 0),
      v_now
    from jsonb_array_elements(public._arms_json_array(v_payload)) as elem;
    get diagnostics v_count = row_count;

    insert into public.app_request_devices (
      id, request_id, request_number, local_id, device_code,
      device_type_name, brand_name, model_name, serial_number, fault,
      external_condition, color, lifecycle_status, current_location,
      assigned_technician_id, assigned_technician_name, locked_after_ship,
      accessory_names, extra_details, synced_at
    )
    select
      coalesce(nullif(req->>'id', ''), 'req') || '::' ||
        coalesce(nullif(dev->>'localId', ''), nullif(dev->>'deviceCode', ''), gen_random_uuid()::text),
      coalesce(nullif(req->>'id', ''), ''),
      req->>'requestNumber',
      dev->>'localId',
      dev->>'deviceCode',
      dev->>'deviceTypeName',
      dev->>'brandName',
      dev->>'modelName',
      dev->>'serialNumber',
      dev->>'fault',
      dev->>'externalCondition',
      dev->>'color',
      dev->>'lifecycleStatus',
      dev->>'currentLocation',
      nullif(dev->>'assignedTechnicianId', ''),
      dev->>'assignedTechnicianName',
      coalesce((dev->>'lockedAfterShip')::boolean, false),
      (
        select string_agg(a, ', ')
        from jsonb_array_elements_text(public._arms_json_array(dev->'accessoryNames')) as a
      ),
      dev->>'extraDetails',
      v_now
    from jsonb_array_elements(public._arms_json_array(v_payload)) as req
    cross join lateral jsonb_array_elements(
      public._arms_json_array(req->'devices')
    ) as dev;

  elsif p_key = 'device_catalog' then
    delete from public.app_catalog_models;
    delete from public.app_catalog_brands;
    delete from public.app_catalog_device_types;

    insert into public.app_catalog_device_types (id, name, synced_at)
    select
      coalesce(nullif(elem->>'id', ''), gen_random_uuid()::text),
      coalesce(elem->>'name', ''),
      v_now
    from jsonb_array_elements(public._arms_json_array(v_payload->'deviceTypes')) as elem;

    insert into public.app_catalog_brands (id, name, synced_at)
    select
      coalesce(nullif(elem->>'id', ''), gen_random_uuid()::text),
      coalesce(elem->>'name', ''),
      v_now
    from jsonb_array_elements(public._arms_json_array(v_payload->'brands')) as elem;
    get diagnostics v_count = row_count;

    insert into public.app_catalog_models (
      id, name, device_type_id, brand_id, has_image,
      accessory_count, spare_part_count, synced_at
    )
    select
      coalesce(nullif(elem->>'id', ''), gen_random_uuid()::text),
      coalesce(elem->>'name', ''),
      nullif(elem->>'deviceTypeId', ''),
      nullif(elem->>'brandId', ''),
      coalesce(nullif(elem->>'imageDataUrl', ''), '') <> '',
      coalesce(jsonb_array_length(public._arms_json_array(elem->'accessories')), 0),
      coalesce(jsonb_array_length(public._arms_json_array(elem->'spareParts')), 0),
      v_now
    from jsonb_array_elements(public._arms_json_array(v_payload->'models')) as elem;

  elsif p_key = 'shipping_batches' then
    delete from public.app_shipping_items;
    delete from public.app_shipping_batches;

    insert into public.app_shipping_batches (
      id, batch_number, shipment_number, carrier, direction,
      source_name, destination_name, ops_branch_id, status,
      created_by_name, created_at, handed_to_carrier_at, received_at,
      item_count, notes, synced_at
    )
    select
      coalesce(nullif(elem->>'id', ''), gen_random_uuid()::text),
      elem->>'batchNumber',
      elem->>'shipmentNumber',
      elem->>'carrier',
      elem->>'direction',
      elem->>'sourceName',
      elem->>'destinationName',
      nullif(elem->>'opsBranchId', ''),
      elem->>'status',
      elem->>'createdByName',
      nullif(elem->>'createdAt', '')::timestamptz,
      nullif(elem->>'handedToCarrierAt', '')::timestamptz,
      nullif(elem->>'receivedAt', '')::timestamptz,
      coalesce(jsonb_array_length(public._arms_json_array(elem->'items')), 0),
      elem->>'notes',
      v_now
    from jsonb_array_elements(public._arms_json_array(v_payload)) as elem;
    get diagnostics v_count = row_count;

    insert into public.app_shipping_items (
      id, batch_id, batch_number, device_code, model_name, color,
      status, branch_receive_outcome, synced_at
    )
    select
      coalesce(nullif(item->>'id', ''), gen_random_uuid()::text),
      coalesce(nullif(batch->>'id', ''), ''),
      batch->>'batchNumber',
      item->>'deviceCode',
      item->>'modelName',
      item->>'color',
      item->>'status',
      item->>'branchReceiveOutcome',
      v_now
    from jsonb_array_elements(public._arms_json_array(v_payload)) as batch
    cross join lateral jsonb_array_elements(
      public._arms_json_array(batch->'items')
    ) as item;

  elsif p_key = 'technician_work' then
    delete from public.app_technician_work;
    insert into public.app_technician_work (
      id, request_id, request_number, device_local_id, device_code,
      technician_id, technician_name, started_at, finished_at, status,
      external_check, device_state, outcome, hold_reason, fault_cause,
      action_taken, test_power, test_pump, test_light, test_sound,
      test_programming, spare_parts_summary, synced_at
    )
    select
      coalesce(nullif(elem->>'id', ''), gen_random_uuid()::text),
      nullif(elem->>'requestId', ''),
      elem->>'requestNumber',
      elem->>'deviceLocalId',
      elem->>'deviceCode',
      nullif(elem->>'technicianId', ''),
      elem->>'technicianName',
      nullif(elem->>'startedAt', '')::timestamptz,
      nullif(elem->>'finishedAt', '')::timestamptz,
      elem->>'status',
      elem->>'externalCheck',
      elem->>'deviceState',
      elem->>'outcome',
      elem->>'holdReason',
      elem->>'faultCause',
      elem->>'actionTaken',
      case when jsonb_typeof(elem->'tests'->'power') = 'boolean'
        then (elem->'tests'->>'power')::boolean else null end,
      case when jsonb_typeof(elem->'tests'->'pump') = 'boolean'
        then (elem->'tests'->>'pump')::boolean else null end,
      case when jsonb_typeof(elem->'tests'->'light') = 'boolean'
        then (elem->'tests'->>'light')::boolean else null end,
      case when jsonb_typeof(elem->'tests'->'sound') = 'boolean'
        then (elem->'tests'->>'sound')::boolean else null end,
      case when jsonb_typeof(elem->'tests'->'programming') = 'boolean'
        then (elem->'tests'->>'programming')::boolean else null end,
      (
        select string_agg(
          coalesce(p->>'partName', '') || '×' || coalesce(p->>'qty', '0'),
          ', '
        )
        from jsonb_array_elements(public._arms_json_array(elem->'sparePartsUsed')) as p
      ),
      v_now
    from jsonb_array_elements(public._arms_json_array(v_payload)) as elem;
    get diagnostics v_count = row_count;

  elsif p_key = 'spare_inventory' then
    delete from public.app_spare_balances;
    insert into public.app_spare_balances (
      id, model_id, model_name, part_id, part_name, color,
      quantity, updated_at, synced_at
    )
    select
      coalesce(nullif(elem->>'id', ''), gen_random_uuid()::text),
      nullif(elem->>'modelId', ''),
      elem->>'modelName',
      nullif(elem->>'partId', ''),
      elem->>'partName',
      elem->>'color',
      coalesce((elem->>'quantity')::numeric, 0),
      nullif(elem->>'updatedAt', '')::timestamptz,
      v_now
    from jsonb_array_elements(public._arms_json_array(v_payload->'balances')) as elem;
    get diagnostics v_count = row_count;

  elsif p_key = 'audit_events' then
    delete from public.app_audit_events;
    insert into public.app_audit_events (
      id, event_type, actor_name, summary, created_at, details, synced_at
    )
    select
      coalesce(
        nullif(elem->>'id', ''),
        nullif(elem->>'eventId', ''),
        md5(elem::text)
      ),
      coalesce(elem->>'type', elem->>'eventType', elem->>'action'),
      coalesce(elem->>'actorName', elem->>'createdByName', elem->>'userName'),
      coalesce(elem->>'summary', elem->>'message', elem->>'description', left(elem::text, 200)),
      coalesce(
        nullif(elem->>'createdAt', '')::timestamptz,
        nullif(elem->>'at', '')::timestamptz
      ),
      elem,
      v_now
    from jsonb_array_elements(public._arms_json_array(v_payload)) as elem;
    get diagnostics v_count = row_count;

  elsif p_key = 'waybills' then
    delete from public.app_waybills;
    insert into public.app_waybills (
      id, waybill_number, courier_company, ops_branch_id, device_codes, synced_at
    )
    select
      coalesce(nullif(elem->>'id', ''), gen_random_uuid()::text),
      elem->>'waybillNumber',
      elem->>'courierCompany',
      nullif(elem->>'opsBranchId', ''),
      (
        select string_agg(c, ', ')
        from jsonb_array_elements_text(public._arms_json_array(elem->'deviceCodes')) as c
      ),
      v_now
    from jsonb_array_elements(public._arms_json_array(v_payload)) as elem;
    get diagnostics v_count = row_count;
  end if;

  return coalesce(v_count, 0);
end;
$$;

comment on function public.expand_arms_store_key(text) is
  'Expands one arms_client_store key into normalized app_* tables';

create or replace function public.expand_arms_client_store()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text;
  v_keys text[] := array[
    'managed_users',
    'ops_branches',
    'maintenance_requests',
    'device_catalog',
    'shipping_batches',
    'technician_work',
    'spare_inventory',
    'audit_events',
    'waybills'
  ];
  v_result jsonb := '{}'::jsonb;
  v_n integer;
begin
  foreach v_key in array v_keys loop
    v_n := public.expand_arms_store_key(v_key);
    v_result := v_result || jsonb_build_object(v_key, v_n);
  end loop;
  return v_result;
end;
$$;

comment on function public.expand_arms_client_store() is
  'One-shot / on-demand: expand all arms_client_store JSON payloads into app_* tables';

grant execute on function public.expand_arms_store_key(text) to anon, authenticated;
grant execute on function public.expand_arms_client_store() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3) RLS (نفس نموذج Pages: anon read/write)
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
  tables text[] := array[
    'app_users',
    'app_ops_branches',
    'app_maintenance_requests',
    'app_request_devices',
    'app_catalog_device_types',
    'app_catalog_brands',
    'app_catalog_models',
    'app_shipping_batches',
    'app_shipping_items',
    'app_technician_work',
    'app_spare_balances',
    'app_audit_events',
    'app_waybills'
  ];
begin
  foreach t in array tables loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "public read %s" on public.%I', t, t);
    execute format(
      'create policy "public read %s" on public.%I for select to anon, authenticated using (true)',
      t, t
    );
    execute format('drop policy if exists "public write %s" on public.%I', t, t);
    execute format(
      'create policy "public write %s" on public.%I for all to anon, authenticated using (true) with check (true)',
      t, t
    );
    execute format('grant select, insert, update, delete on public.%I to anon, authenticated', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 4) Browsing views (بدون كلمة المرور)
-- ---------------------------------------------------------------------------

create or replace view public.v_app_users
with (security_invoker = true)
as
select
  id,
  username,
  full_name as "الاسم",
  email,
  mobile as "الجوال",
  role as "الدور",
  ops_branch_name as "الفرع",
  is_active as "نشط",
  created_at,
  updated_at,
  synced_at
from public.app_users;

comment on view public.v_app_users is 'مستخدمو المنصة بدون كلمة المرور — للتصفح في Table Editor';

create or replace view public.v_app_maintenance_overview
with (security_invoker = true)
as
select
  r.request_number as "رقم_الطلب",
  r.contact_name as "العميل",
  r.customer_mobile as "الجوال",
  r.ops_branch_name as "الفرع",
  r.priority as "الأولوية",
  r.received_at as "تاريخ_الاستلام",
  r.branch_staff_name as "موظف_الفرع",
  r.device_count as "عدد_الأجهزة",
  r.id,
  r.synced_at
from public.app_maintenance_requests r;

comment on view public.v_app_maintenance_overview is 'نظرة طلبات الصيانة بأعمدة عربية';

create or replace view public.v_app_request_devices
with (security_invoker = true)
as
select
  d.request_number as "رقم_الطلب",
  d.device_code as "كود_الجهاز",
  d.brand_name as "الماركة",
  d.model_name as "الموديل",
  d.fault as "العطل",
  d.lifecycle_status as "الحالة",
  d.current_location as "الموقع",
  d.assigned_technician_name as "الفني",
  d.color as "اللون",
  d.serial_number as "الرقم_التسلسلي",
  d.id,
  d.request_id,
  d.synced_at
from public.app_request_devices d;

grant select on public.v_app_users to anon, authenticated;
grant select on public.v_app_maintenance_overview to anon, authenticated;
grant select on public.v_app_request_devices to anon, authenticated;

-- Keep older JSON views working if present
-- (010 / 012 may already exist; leave them alone)

-- ---------------------------------------------------------------------------
-- 5) Initial expand from current JSON
-- ---------------------------------------------------------------------------
select public.expand_arms_client_store() as expand_result;

-- =============================================================================
-- بعد التشغيل افتح Table Editor:
--   • app_users / v_app_users
--   • app_ops_branches
--   • app_maintenance_requests / v_app_maintenance_overview
--   • app_request_devices / v_app_request_devices
--   • app_catalog_brands / app_catalog_models
--   • app_shipping_batches / app_shipping_items
--   • app_technician_work
--   • app_spare_balances
-- =============================================================================
