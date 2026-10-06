-- Soft-archive users + soft-disable branches (preserve history)

alter table if exists public.app_users
  add column if not exists is_archived boolean not null default false;

comment on column public.app_users.is_archived is 'مؤرشف؟ يُخفى من القوائم النشطة مع الإبقاء على السجل';

alter table if exists public.app_ops_branches
  add column if not exists is_active boolean not null default true;

comment on column public.app_ops_branches.is_active is 'نشط؟ التعطيل يُبقي السجل ويُخفيه من الاختيارات';

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
  created_at as "أُنشئ",
  updated_at as "حُدّث"
from public.app_users;

grant select on public.v_app_users to anon, authenticated;
