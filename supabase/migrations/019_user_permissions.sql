-- Per-user permission overrides (role template + toggles)

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
