-- =============================================================================
-- ARMS 019 — user permissions (RUN ME)
-- Paste this ENTIRE file into Supabase SQL Editor. Do not paste from Cursor chat
-- if you see placeholders like "[N lines collapsed]" — that is NOT SQL.
-- =============================================================================
-- What this does (safe to re-run):
--   1) Ensure app_users.is_archived exists
--   2) Ensure app_users.permissions exists (jsonb array, default [])
--   3) DROP + CREATE v_app_users (English column names; OR REPLACE cannot rename)
-- =============================================================================

alter table if exists public.app_users
  add column if not exists is_archived boolean not null default false;

comment on column public.app_users.is_archived is
  'مؤرشف؟ يُخفى من القوائم النشطة مع الإبقاء على السجل';

alter table if exists public.app_users
  add column if not exists permissions jsonb not null default '[]'::jsonb;

comment on column public.app_users.permissions is
  'مصفوفة مفاتيح صلاحيات فعّالة (قالب الدور + تخصيص المدير)';

drop view if exists public.v_app_users cascade;

create view public.v_app_users
with (security_invoker = true)
as
select
  id,
  username,
  full_name,
  email,
  mobile,
  role,
  ops_branch_name,
  is_active,
  is_archived,
  permissions,
  created_at,
  updated_at
from public.app_users;

comment on view public.v_app_users is
  'مستخدمو المنصة بدون كلمة المرور — أعمدة إنجليزية مستقرة للـ API وTable Editor';

grant select on public.v_app_users to anon, authenticated;
