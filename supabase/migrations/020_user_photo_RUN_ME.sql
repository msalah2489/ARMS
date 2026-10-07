-- انسخ هذا الملف كاملاً إلى Supabase SQL Editor وشغّله مرة واحدة.
-- يضيف أعمدة الصورة الشخصية الاختيارية على app_users ويحدّث v_app_users.

alter table if exists public.app_users
  add column if not exists photo_data_url text;

alter table if exists public.app_users
  add column if not exists photo_name text;

comment on column public.app_users.photo_data_url is
  'صورة شخصية اختيارية (data URL مضغوط)';

comment on column public.app_users.photo_name is
  'اسم ملف الصورة الشخصية (اختياري)';

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
  (photo_data_url is not null and length(trim(photo_data_url)) > 0) as has_photo,
  photo_name,
  created_at,
  updated_at
from public.app_users;

comment on view public.v_app_users is
  'مستخدمو المنصة بدون كلمة المرور والصورة الكاملة — أعمدة إنجليزية مستقرة';

grant select on public.v_app_users to anon, authenticated;
