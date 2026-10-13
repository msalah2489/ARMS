-- انسخ هذا الملف كاملاً إلى Supabase → SQL Editor وشغّله مرة واحدة.
-- يضيف أعمدة ربط طلب المتابعة / سبب الإرجاع على app_maintenance_requests.
-- التطبيق يعمل عبر payload حتى بدون هذه الأعمدة؛ الأعمدة تحسّن الاستعلام والتقارير.

alter table if exists public.app_maintenance_requests
  add column if not exists parent_request_id text;

alter table if exists public.app_maintenance_requests
  add column if not exists parent_request_number text;

alter table if exists public.app_maintenance_requests
  add column if not exists link_reason text;

alter table if exists public.app_maintenance_requests
  add column if not exists link_note text;

comment on column public.app_maintenance_requests.parent_request_id is
  'معرّف الطلب السابق عند إنشاء طلب متابعة (إرجاع بعد التسليم)';

comment on column public.app_maintenance_requests.parent_request_number is
  'رقم الطلب السابق للعرض السريع';

comment on column public.app_maintenance_requests.link_reason is
  'سبب الإرجاع / الربط (repeat_fault, new_fault, …, other)';

comment on column public.app_maintenance_requests.link_note is
  'ملاحظة اختيارية (إلزامية إذا السبب = other)';

create index if not exists idx_app_maintenance_requests_parent
  on public.app_maintenance_requests (parent_request_id)
  where parent_request_id is not null;
