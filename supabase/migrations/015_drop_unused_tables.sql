-- =============================================================================
-- ARMS: DROP unused legacy tables (Pages uses arms_client_store + app_*)
-- =============================================================================
-- ⚠️ WARNING / تحذير:
--   CASCADE يحذف فقط الـ views/triggers المعتمدة على الجداول القديمة أدناه.
--   لا يمس arms_client_store ولا جداول app_* ولا views v_app_* / v_maintenance_* /
--   v_managed_users_list.
--
-- AR: شغّل مرة في Supabase → SQL Editor → Run.
--     الهدف: حذف جداول CRM / workflow العلائقي القديمة من الشريط الجانبي
--     (Table Editor) لأن منصة GitHub Pages لا تقرأها ولا تكتبها.
--     آمن لإعادة التشغيل (idempotent: IF EXISTS).
--
-- EN: Paste into Supabase → SQL Editor → Run once (safe to re-run).
--     DROPs classic CRM + obsolete relational workflow tables the live
--     GitHub Pages app never queries. Does NOT empty or drop live sync tables.
--
-- ----------------------------------------------------------------------------
-- KEPT (لا تُحذف — مستخدمة بالمنصة):
--   • public.arms_client_store          — المزامنة الأساسية (JSON)
--   • public.app_*                      — جداول مرآة من 013
--   • views: v_app_*, v_maintenance_requests_list, v_managed_users_list
--   • RPCs/triggers: expand_arms_client_store / expand_* (013)
--   • auth.users                        — حسابات Auth (إن وُجدت)
--
-- DROPPED (تُحذف إن وُجدت — غير مستخدمة بمسار Pages):
--   • Classic CRM (001): customers, branches, devices, service_requests,
--     spare_parts, device_models, service_centers, profiles + satellites
--   • Relational ops (002/003/007): ops_branches table, waybills, shipping_*,
--     maintenance_requests (table), device_types/brands/models, audit_events
--   • Obsolete workflow RPCs / sequences from 003–006 (optional cleanup)
--
-- NOTE: مفتاح JSON اسمه ops_branches داخل arms_client_store يبقى — هذا ليس
--       جدول public.ops_branches. جدول profiles يُحذف لأن تسجيل الدخول على
--       Pages عبر managed_users وليس Auth profiles.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) DROP classic CRM satellite tables (001) — dependents first
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
-- 2) DROP classic CRM core tables (001) — emptied by 009/014; unused by Pages
--    Live customers/devices/branches come from maintenance_requests JSON +
--    ops_branches key in arms_client_store (and mirrored app_* tables).
-- ---------------------------------------------------------------------------
drop table if exists public.service_requests cascade;
drop table if exists public.devices cascade;
drop table if exists public.branches cascade;
drop table if exists public.customers cascade;
drop table if exists public.spare_parts cascade;
drop table if exists public.device_models cascade;
drop table if exists public.service_centers cascade;

-- profiles: FK → auth.users only; Pages auth uses managed_users JSON.
-- CASCADE drops dependent objects on this table only (not auth.users).
drop table if exists public.profiles cascade;

-- ---------------------------------------------------------------------------
-- 3) DROP obsolete relational workflow tables (002 / 003 / 007)
--    Same names as JSON store keys are unrelated — those keys stay in
--    arms_client_store. This only drops the old SQL tables.
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

-- Relational seed table from 002/007 — live branches = store key + app_ops_branches
drop table if exists public.ops_branches cascade;

-- ---------------------------------------------------------------------------
-- 4) DROP obsolete RPCs that targeted the relational workflow (optional)
--    Pages static build does not call these. Idempotent: IF EXISTS.
-- ---------------------------------------------------------------------------
drop function if exists public.confirm_received_at_service(uuid);
drop function if exists public.confirm_handed_to_carrier(uuid);
drop function if exists public.remove_device_from_batch(uuid, text);
drop function if exists public.create_shipping_batch(text, text, uuid, text, uuid[], text);
drop function if exists public.write_audit(uuid, text, text, text, text, jsonb, jsonb);
drop function if exists public.next_batch_number();
drop function if exists public.next_request_number();
drop function if exists public.profile_role(uuid);
drop function if exists public.current_role();
drop function if exists public.is_manager();
-- Auth trigger helper from 001 (creates profiles on signup) — unused by Pages managed_users
drop function if exists public.handle_new_user() cascade;

drop sequence if exists public.shipping_batch_number_seq;
drop sequence if exists public.service_request_number_seq;

-- =============================================================================
-- Done. Verify in Table Editor:
--   ✓ arms_client_store still present (9 keys)
--   ✓ app_* tables + v_app_* / v_maintenance_requests_list / v_managed_users_list
--   ✗ customers / branches / devices / service_requests / spare_parts / profiles
--     / ops_branches (table) / relational shipping_* gone
-- Then: hard-refresh the site — sync continues via arms_client_store only.
-- =============================================================================
