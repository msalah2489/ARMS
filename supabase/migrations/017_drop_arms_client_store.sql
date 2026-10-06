-- =============================================================================
-- ARMS: اعتمد جداول app_* فقط — أضف payload، انقل أي JSON متبقّي، احذف arms_client_store
-- =============================================================================
-- AR: شغّل هذا الملف في Supabase → SQL Editor → Run
--     AFTER نشر الكود الذي يقرأ/يكتب app_* مباشرة (بدون arms_client_store).
--
-- الترتيب الموصى به:
--   1) Deploy الكود على GitHub Pages
--   2) شغّل هذا الملف (017) هنا
--   3) Hard refresh للموقع (Ctrl+Shift+R)
--
-- EN: Run AFTER deploying app code that syncs via app_* only.
--     Migrates leftover JSON → app_*, ensures admin user, drops client store + expand RPCs.
--     Keeps v_app_* views. Rewrites JSON-dependent views onto app_* tables.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) Full-fidelity payload columns (nested domain objects)
-- ---------------------------------------------------------------------------

alter table public.app_maintenance_requests
  add column if not exists payload jsonb;

alter table public.app_request_devices
  add column if not exists payload jsonb;

alter table public.app_catalog_models
  add column if not exists payload jsonb;

alter table public.app_shipping_batches
  add column if not exists payload jsonb;

alter table public.app_shipping_items
  add column if not exists payload jsonb;

alter table public.app_technician_work
  add column if not exists payload jsonb;

alter table public.app_waybills
  add column if not exists payload jsonb;

alter table public.app_spare_balances
  add column if not exists payload jsonb;

-- ---------------------------------------------------------------------------
-- 2) Spare receipts / movements (were only inside spare_inventory JSON)
-- ---------------------------------------------------------------------------

create table if not exists public.app_spare_receipts (
  id text primary key,
  receipt_number text,
  receipt_date text,
  supplier text,
  payload jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now()
);

create table if not exists public.app_spare_movements (
  id text primary key,
  type text,
  payload jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now()
);

comment on table public.app_spare_receipts is 'إيصالات استلام قطع الغيار (كامل الكائن في payload)';
comment on table public.app_spare_movements is 'حركات مخزون قطع الغيار (كامل الكائن في payload)';

do $$
declare
  t text;
  tables text[] := array['app_spare_receipts', 'app_spare_movements'];
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
-- 3) Final migrate from arms_client_store (if table still has data)
-- ---------------------------------------------------------------------------

do $$
begin
  if to_regclass('public.arms_client_store') is null then
    raise notice 'arms_client_store already absent — skip JSON migrate';
    return;
  end if;

  -- Prefer expand RPC if still present (fills summary columns)
  if to_regprocedure('public.expand_arms_client_store()') is not null then
    perform public.expand_arms_client_store();
  end if;

  -- Copy full JSON payloads onto app_* rows for fidelity
  -- managed_users → app_users (columns; expand already did this)
  -- maintenance_requests payload
  update public.app_maintenance_requests r
  set payload = elem
  from public.arms_client_store s,
       lateral jsonb_array_elements(
         case when jsonb_typeof(s.payload) = 'array' then s.payload else '[]'::jsonb end
       ) as elem
  where s.store_key = 'maintenance_requests'
    and elem->>'id' = r.id
    and r.payload is null;

  -- device_catalog models payload
  update public.app_catalog_models m
  set payload = elem
  from public.arms_client_store s,
       lateral jsonb_array_elements(
         case
           when jsonb_typeof(s.payload->'models') = 'array' then s.payload->'models'
           else '[]'::jsonb
         end
       ) as elem
  where s.store_key = 'device_catalog'
    and elem->>'id' = m.id
    and m.payload is null;

  -- shipping_batches payload
  update public.app_shipping_batches b
  set payload = elem
  from public.arms_client_store s,
       lateral jsonb_array_elements(
         case when jsonb_typeof(s.payload) = 'array' then s.payload else '[]'::jsonb end
       ) as elem
  where s.store_key = 'shipping_batches'
    and elem->>'id' = b.id
    and b.payload is null;

  -- technician_work payload
  update public.app_technician_work w
  set payload = elem
  from public.arms_client_store s,
       lateral jsonb_array_elements(
         case when jsonb_typeof(s.payload) = 'array' then s.payload else '[]'::jsonb end
       ) as elem
  where s.store_key = 'technician_work'
    and elem->>'id' = w.id
    and w.payload is null;

  -- waybills payload
  update public.app_waybills w
  set payload = elem
  from public.arms_client_store s,
       lateral jsonb_array_elements(
         case when jsonb_typeof(s.payload) = 'array' then s.payload else '[]'::jsonb end
       ) as elem
  where s.store_key = 'waybills'
    and elem->>'id' = w.id
    and w.payload is null;

  -- spare receipts / movements from spare_inventory JSON
  insert into public.app_spare_receipts (id, receipt_number, receipt_date, supplier, payload, synced_at)
  select
    coalesce(nullif(elem->>'id', ''), gen_random_uuid()::text),
    elem->>'receiptNumber',
    elem->>'receiptDate',
    elem->>'supplier',
    elem,
    now()
  from public.arms_client_store s,
       lateral jsonb_array_elements(
         case
           when jsonb_typeof(s.payload->'receipts') = 'array' then s.payload->'receipts'
           else '[]'::jsonb
         end
       ) as elem
  where s.store_key = 'spare_inventory'
  on conflict (id) do update
  set
    receipt_number = excluded.receipt_number,
    receipt_date = excluded.receipt_date,
    supplier = excluded.supplier,
    payload = excluded.payload,
    synced_at = excluded.synced_at;

  insert into public.app_spare_movements (id, type, payload, synced_at)
  select
    coalesce(nullif(elem->>'id', ''), gen_random_uuid()::text),
    elem->>'type',
    elem,
    now()
  from public.arms_client_store s,
       lateral jsonb_array_elements(
         case
           when jsonb_typeof(s.payload->'movements') = 'array' then s.payload->'movements'
           else '[]'::jsonb
         end
       ) as elem
  where s.store_key = 'spare_inventory'
  on conflict (id) do update
  set
    type = excluded.type,
    payload = excluded.payload,
    synced_at = excluded.synced_at;

  -- spare balances payload
  update public.app_spare_balances b
  set payload = elem
  from public.arms_client_store s,
       lateral jsonb_array_elements(
         case
           when jsonb_typeof(s.payload->'balances') = 'array' then s.payload->'balances'
           else '[]'::jsonb
         end
       ) as elem
  where s.store_key = 'spare_inventory'
    and elem->>'id' = b.id
    and b.payload is null;
end $$;

-- ---------------------------------------------------------------------------
-- 4) Ensure admin / demo login row in app_users
-- ---------------------------------------------------------------------------

insert into public.app_users (
  id, username, full_name, email, mobile, role,
  ops_branch_id, ops_branch_name, password_plain, is_active,
  created_at, updated_at, synced_at
)
values (
  'admin-local',
  'admin',
  'أحمد المدير',
  'admin@arms.local',
  '0500000001',
  'system_admin',
  null,
  null,
  'demo',
  true,
  coalesce(
    (select created_at from public.app_users where id = 'admin-local'),
    now()
  ),
  now(),
  now()
)
on conflict (id) do update
set
  username = excluded.username,
  full_name = excluded.full_name,
  email = excluded.email,
  mobile = excluded.mobile,
  role = excluded.role,
  password_plain = coalesce(nullif(public.app_users.password_plain, ''), excluded.password_plain),
  is_active = true,
  updated_at = now(),
  synced_at = now();

-- ---------------------------------------------------------------------------
-- 5) Rewrite views that depended on arms_client_store JSON
-- ---------------------------------------------------------------------------

create or replace view public.v_maintenance_requests_list
with (security_invoker = true)
as
select
  r.id,
  r.request_number,
  r.ops_branch_id,
  r.ops_branch_name,
  r.contact_name,
  r.customer_mobile,
  r.priority,
  r.received_at::text as received_at,
  r.branch_staff_name,
  r.device_count,
  r.synced_at as store_updated_at
from public.app_maintenance_requests r;

comment on view public.v_maintenance_requests_list is
  'طلبات الصيانة من app_maintenance_requests (بديل توسعة JSON القديمة)';

create or replace view public.v_managed_users_list
with (security_invoker = true)
as
select
  u.id,
  u.username,
  u.full_name,
  u.email,
  u.mobile,
  u.role,
  u.ops_branch_id,
  u.ops_branch_name,
  u.is_active,
  u.created_at::text as created_at,
  u.updated_at::text as updated_at,
  u.synced_at as store_updated_at
from public.app_users u;

comment on view public.v_managed_users_list is
  'مستخدمو المنصة من app_users بدون كلمة المرور (بديل توسعة JSON القديمة)';

grant select on public.v_maintenance_requests_list to anon, authenticated;
grant select on public.v_managed_users_list to anon, authenticated;

-- Keep browsing views from 013
grant select on public.v_app_users to anon, authenticated;
grant select on public.v_app_maintenance_overview to anon, authenticated;
grant select on public.v_app_request_devices to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6) Drop expand RPCs / helpers that only mirrored JSON → app_*
-- ---------------------------------------------------------------------------

drop function if exists public.expand_arms_client_store();
drop function if exists public.expand_arms_store_key(text);
drop function if exists public._arms_json_array(jsonb);

-- ---------------------------------------------------------------------------
-- 7) Drop arms_client_store (+ trigger function)
-- ---------------------------------------------------------------------------

drop trigger if exists trg_arms_client_store_updated_at on public.arms_client_store;
drop function if exists public.touch_arms_client_store_updated_at();
drop table if exists public.arms_client_store cascade;

-- =============================================================================
-- Done. Verify:
--   ✓ arms_client_store gone
--   ✓ app_users has admin (username=admin, password_plain=demo)
--   ✓ v_app_* / v_maintenance_requests_list / v_managed_users_list still work
--   ✓ app_spare_receipts / app_spare_movements present
-- Then: hard-refresh https://msalah2489.github.io/ARMS/ (Ctrl+Shift+R)
-- Login: admin / demo
-- =============================================================================
