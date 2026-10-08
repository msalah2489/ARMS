-- =============================================================================
-- ARMS: معرّف QR لكل جهاز + وقت طباعة الملصق
-- =============================================================================
-- Safe to re-run (idempotent). Adds qr_token / qr_printed_at on app_request_devices.
-- Payload JSON already carries these fields; columns help browsing + uniqueness.
-- =============================================================================

alter table public.app_request_devices
  add column if not exists qr_token text;

alter table public.app_request_devices
  add column if not exists qr_printed_at timestamptz;

comment on column public.app_request_devices.qr_token is
  'معرّف ثابت لرابط QR (عادةً local_id) — لا يمنح صلاحيات';
comment on column public.app_request_devices.qr_printed_at is
  'وقت طباعة / تأكيد ملصق QR من موظف الفرع';

-- Backfill from local_id when token is empty
update public.app_request_devices
set qr_token = local_id
where (qr_token is null or btrim(qr_token) = '')
  and local_id is not null
  and btrim(local_id) <> '';

create unique index if not exists idx_app_request_devices_qr_token
  on public.app_request_devices (qr_token)
  where qr_token is not null and btrim(qr_token) <> '';

create index if not exists idx_app_request_devices_qr_printed
  on public.app_request_devices (qr_printed_at);

-- Refresh Arabic browse view with the new columns
drop view if exists public.v_app_request_devices cascade;

create view public.v_app_request_devices
with (security_invoker = true)
as
select
  d.id,
  d.request_id,
  d.request_number as "رقم_الطلب",
  d.local_id,
  d.device_code as "كود_الجهاز",
  d.device_type_name as "النوع",
  d.brand_name as "البراند",
  d.model_name as "الموديل",
  d.serial_number as "السيريال",
  d.fault as "العطل",
  d.lifecycle_status as "الحالة",
  d.current_location as "الموقع",
  d.assigned_technician_name as "الفني",
  d.qr_token,
  d.qr_printed_at as "وقت_طباعة_QR",
  d.synced_at
from public.app_request_devices d;

comment on view public.v_app_request_devices is
  'أجهزة الطلبات للتصفح — يتضمن معرّف QR ووقت الطباعة';

grant select on public.v_app_request_devices to anon, authenticated;
