-- =============================================================================
-- ARMS: Cleanup OLD unused schema / seed after Pages → arms_client_store sync
-- =============================================================================
-- AR: شغّل هذا الملف مرة في Supabase → SQL Editor بعد ما التطبيق صار يعتمد
--     على arms_client_store. الهدف: تفريغ بيانات CRM/تجريبية قديمة وحذف جداول
--     مسار الـ workflow العلائقي اللي الصفحات الثابتة ما عاد تقرأها.
--
-- EN: Paste into Supabase → SQL Editor → Run (once; safe to re-run).
--     Clears stale classic CRM / demo seed and DROPs obsolete relational
--     workflow tables. Does NOT wipe live ops JSON in arms_client_store.
--
-- PRESERVED (لا تُمس بياناتها الحية):
--   • public.arms_client_store  — كل المفاتيح الحية وحمولاتها (payload)
--   • public.profiles           — مرتبط بـ auth.users
--   • بنية جداول CRM الأساسية (customers/branches/devices/…) كـ fallback فقط
--
-- REMOVED / EMPTIED:
--   • تفريغ بيانات seed/تجريبية من جداول CRM الكلاسيكية + ops_branches العلائقي
--   • DROP لجداول 002/003 (waybills / maintenance_requests / shipping_batches
--     العلائقية / كتالوج device_types…) إن وُجدت — البديل JSON في client store
--   • DROP لجداول 001 الثانوية غير المستخدمة في مسار Pages
--   • حذف أي store_key غريب غير معروف للتطبيق
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0) Ensure live client-store keys exist ( لا يمسح بيانات موجودة )
--    Same as 008_extend_client_store_keys.sql — safe on conflict.
-- ---------------------------------------------------------------------------
create table if not exists public.arms_client_store (
  store_key text primary key,
  payload jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.arms_client_store (store_key, payload)
values
  ('ops_branches', '[]'::jsonb),
  ('maintenance_requests', '[]'::jsonb),
  ('device_catalog', '{}'::jsonb),
  ('managed_users', '[]'::jsonb),
  ('shipping_batches', '[]'::jsonb),
  ('audit_events', '[]'::jsonb),
  ('technician_work', '[]'::jsonb),
  ('spare_inventory', '{"balances":[],"receipts":[],"movements":[]}'::jsonb),
  ('waybills', '[]'::jsonb)
on conflict (store_key) do nothing;

-- Drop unknown / obsolete keys only (never touch the nine live keys above)
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
-- 1) Clear classic CRM seed / demo rows (keep tables for optional fallback)
--    Avoid TRUNCATE CASCADE into profiles (FK from profiles → branches).
-- ---------------------------------------------------------------------------
do $$
begin
  -- Null FKs on profiles that point at CRM / ops branch rows we will clear
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

  -- Leaf / dependent CRM rows first (IF table exists)
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

  -- Relational ops_branches seed (RYD-01 demo). Live branches live in client store.
  if to_regclass('public.ops_branches') is not null then
    delete from public.ops_branches;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2) DROP obsolete relational workflow tables (002 / 003)
--    Pages sync uses JSON keys with the SAME names — those are NOT these tables.
-- ---------------------------------------------------------------------------
drop table if exists public.shipping_waybill_devices cascade;
drop table if exists public.shipping_waybills cascade;
drop table if exists public.maintenance_request_device_accessories cascade;
drop table if exists public.maintenance_request_devices cascade;
drop table if exists public.maintenance_requests cascade;
drop table if exists public.shipping_batch_items cascade;
drop table if exists public.shipping_batches cascade;
drop table if exists public.audit_events cascade;
drop table if exists public.model_accessories cascade;
drop table if exists public.models cascade;
drop table if exists public.brands cascade;
drop table if exists public.device_types cascade;

-- ---------------------------------------------------------------------------
-- 3) DROP unused classic CRM satellite tables (001) — not on Pages sync path
-- ---------------------------------------------------------------------------
drop table if exists public.notifications cascade;
drop table if exists public.attachments cascade;
drop table if exists public.device_dispatches cascade;
drop table if exists public.customer_receipt_devices cascade;
drop table if exists public.customer_receipts cascade;
drop table if exists public.spare_part_usage cascade;
drop table if exists public.maintenance_records cascade;
drop table if exists public.service_request_history cascade;
drop table if exists public.spare_part_movements cascade;
drop table if exists public.device_accessories cascade;
drop table if exists public.accessories cascade;
drop table if exists public.device_status_history cascade;

-- ---------------------------------------------------------------------------
-- 4) DROP obsolete RPCs that targeted the relational workflow (optional cleanup)
--    Idempotent: IF EXISTS. Pages static build does not call these.
-- ---------------------------------------------------------------------------
drop function if exists public.confirm_received_at_service(uuid);
drop function if exists public.confirm_handed_to_carrier(uuid);
drop function if exists public.remove_device_from_batch(uuid, text);
drop function if exists public.create_shipping_batch(text, text, uuid, text, uuid[], text);
drop function if exists public.write_audit(uuid, text, text, text, text, jsonb, jsonb);
drop function if exists public.next_batch_number();
drop function if exists public.next_request_number();
drop function if exists public.profile_role(uuid);

drop sequence if exists public.shipping_batch_number_seq;
drop sequence if exists public.service_request_number_seq;

-- =============================================================================
-- Done. Verify in Table Editor:
--   ✓ arms_client_store still has your live payloads
--   ✓ customers / devices / … empty (or missing satellite tables dropped)
--   ✓ shipping_waybills / relational shipping_batches gone if they existed
-- =============================================================================
