-- =============================================================================
-- ARMS: Wipe ALL operational data (client store + app_* + leftover CRM)
-- =============================================================================
-- ⚠️ WARNING / تحذير:
--   هذا السكربت يحذف كل بيانات العمليات (طلبات، فروع، مستخدمين، شحنات، كتالوج…).
--   لا يحذف بنية الجداول. لا يحذف auth.users.
--   اللغة والسمة (language/theme) مخزّنتان في المتصفح فقط — لا تُمس هنا.
--
-- AR: شغّل مرة واحدة في Supabase → SQL Editor → Run.
--     بعدها حدّث الموقع بقوة (hard refresh) حتى يعيد hydrate من قاعدة فارغة.
--     آمن لإعادة التشغيل (idempotent).
--
-- EN: Paste into Supabase → SQL Editor → Run once (safe to re-run).
--     Then hard-refresh the site so hydrate pulls empty remote payloads.
--     App must NOT re-seed demo data in cloud mode (hydrate clears local).
--
-- WIPES (يُفرَّغ):
--   • public.arms_client_store  — كل مفاتيح العمليات إلى [] / {} فارغ
--   • public.app_*             — الجداول العلائقية المنسوخة من JSON (013)
--   • جداول CRM المتبقية إن وُجدت (customers, devices, branches, …)
--   • public.ops_branches      — seed علائقي قديم (إن وُجد)
--
-- KEEPS (لا يُمس):
--   • بنية كل الجداول / الـ views / الـ RPCs
--   • auth.users               — حسابات Auth (لا تُحذف)
--   • public.profiles          — سبق تنظيفه في 011؛ لا نلمسه هنا
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) Reset arms_client_store: known keys → empty payloads; drop unknown keys
-- ---------------------------------------------------------------------------
create table if not exists public.arms_client_store (
  store_key text primary key,
  payload jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.arms_client_store (store_key, payload, updated_at)
values
  ('ops_branches', '[]'::jsonb, now()),
  ('maintenance_requests', '[]'::jsonb, now()),
  ('device_catalog', '{"deviceTypes":[],"brands":[],"models":[]}'::jsonb, now()),
  ('managed_users', '[]'::jsonb, now()),
  ('shipping_batches', '[]'::jsonb, now()),
  ('audit_events', '[]'::jsonb, now()),
  ('technician_work', '[]'::jsonb, now()),
  ('spare_inventory', '{"balances":[],"receipts":[],"movements":[]}'::jsonb, now()),
  ('waybills', '[]'::jsonb, now())
on conflict (store_key) do update
set
  payload = excluded.payload,
  updated_at = excluded.updated_at;

-- Remove any stray / obsolete keys not used by the app
delete from public.arms_client_store
where store_key not in (
  'ops_branches',
  'maintenance_requests',
  'device_catalog',
  'managed_users',
  'shipping_batches',
  'audit_events',
  'technician_work',
  'spare_inventory',
  'waybills'
);

-- ---------------------------------------------------------------------------
-- 2) Empty normalized app_* tables (013) — keep structure & views
--    No formal FKs between these tables; truncate each if present.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
  tables text[] := array[
    'app_request_devices',
    'app_shipping_items',
    'app_maintenance_requests',
    'app_shipping_batches',
    'app_catalog_models',
    'app_catalog_brands',
    'app_catalog_device_types',
    'app_users',
    'app_ops_branches',
    'app_technician_work',
    'app_spare_balances',
    'app_audit_events',
    'app_waybills'
  ];
begin
  foreach t in array tables
  loop
    if to_regclass('public.' || t) is not null then
      execute format('truncate table public.%I', t);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 3) Optional: clear leftover classic CRM / relational ops seed (if still around)
--    Same spirit as 009 — tables kept; rows emptied. Avoid CASCADE into profiles.
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.profiles') is not null then
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'profiles' and column_name = 'branch_id'
    ) then
      execute 'update public.profiles set branch_id = null where branch_id is not null';
    end if;
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'profiles' and column_name = 'service_center_id'
    ) then
      execute 'update public.profiles set service_center_id = null where service_center_id is not null';
    end if;
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'profiles' and column_name = 'ops_branch_id'
    ) then
      execute 'update public.profiles set ops_branch_id = null where ops_branch_id is not null';
    end if;
  end if;

  if to_regclass('public.service_requests') is not null then
    delete from public.service_requests;
  end if;
  if to_regclass('public.devices') is not null then
    delete from public.devices;
  end if;
  if to_regclass('public.branches') is not null then
    delete from public.branches;
  end if;
  if to_regclass('public.customers') is not null then
    delete from public.customers;
  end if;
  if to_regclass('public.spare_parts') is not null then
    delete from public.spare_parts;
  end if;
  if to_regclass('public.device_models') is not null then
    delete from public.device_models;
  end if;
  if to_regclass('public.service_centers') is not null then
    delete from public.service_centers;
  end if;
  if to_regclass('public.ops_branches') is not null then
    delete from public.ops_branches;
  end if;
end $$;

-- =============================================================================
-- Done. Verify in Table Editor:
--   ✓ arms_client_store → nine keys, all empty arrays/objects
--   ✓ app_* tables → 0 rows (views v_app_* also empty)
--   ✓ CRM leftovers empty if tables still exist
--   ✓ auth.users / profiles structure untouched
-- Then: hard-refresh the deployed site (Ctrl+Shift+R) so hydrate clears localStorage.
-- =============================================================================
