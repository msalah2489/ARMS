-- =============================================================================
-- ARMS 019 — user permissions (RUN ME)
-- Paste this ENTIRE file into Supabase SQL Editor. Do not paste from Cursor chat
-- if you see placeholders like "[N lines collapsed]" — that is NOT SQL.
-- =============================================================================
-- What this does (safe to re-run):
--   1) Ensure app_users.is_archived exists
--   2) Ensure app_users.permissions exists (jsonb array, default [])
--   3) Recreate v_app_users with those columns (no password)
-- =============================================================================

alter table if exists public.app_users
  add column if not exists is_archived boolean not null default false;

comment on column public.app_users.is_archived is
  'مؤرشف؟ يُخفى من القوائم النشطة مع الإبقاء على السجل';

alter table if exists public.app_users
  add column if not exists permissions jsonb not null default '[]'::jsonb;

comment on column public.app_users.permissions is
  'مصفوفة مفاتيح صلاحيات فعّالة (قالب الدور + تخصيص المدير)';

create or replace view public.v_app_users
with (security_invoker = true)
as
select
  id,
  username as "اسم المستخدم",
  full_name as "الاسم",
  email as "البريد",
  mobile as "الجوال",
  role as "الصلاحية",
  ops_branch_name as "الفرع",
  is_active as "نشط",
  is_archived as "مؤرشف",
  permissions as "الصلاحيات",
  created_at as "أُنشئ",
  updated_at as "حُدّث"
from public.app_users;

grant select on public.v_app_users to anon, authenticated;
