-- =============================================================================
-- ARMS: مخزون الأجهزة المستبدلة (app_replaced_devices)
-- =============================================================================
-- Safe to re-run (idempotent). Used by manager «استبدال» decision + /replaced-devices.
-- =============================================================================

create table if not exists public.app_replaced_devices (
  id text primary key,
  device_type_name text not null,
  model_name text,
  serial_or_code text,
  quantity integer not null default 0 check (quantity >= 0),
  notes text,
  created_at timestamptz,
  updated_at timestamptz,
  created_by_id text,
  created_by_name text,
  payload jsonb,
  synced_at timestamptz not null default now()
);

comment on table public.app_replaced_devices is
  'مخزون أجهزة الاستبدال المحتفظ بها في مركز الصيانة';
comment on column public.app_replaced_devices.device_type_name is 'نوع الجهاز';
comment on column public.app_replaced_devices.quantity is 'الكمية المتاحة';
comment on column public.app_replaced_devices.payload is 'نسخة JSON كاملة للصف (توافق التطبيق)';

create index if not exists idx_app_replaced_devices_updated
  on public.app_replaced_devices (updated_at desc);

alter table public.app_replaced_devices enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'app_replaced_devices'
      and policyname = 'public read app_replaced_devices'
  ) then
    create policy "public read app_replaced_devices"
      on public.app_replaced_devices for select to anon, authenticated using (true);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'app_replaced_devices'
      and policyname = 'public write app_replaced_devices'
  ) then
    create policy "public write app_replaced_devices"
      on public.app_replaced_devices for all to anon, authenticated using (true) with check (true);
  end if;
end $$;

grant select, insert, update, delete on public.app_replaced_devices to anon, authenticated;

drop view if exists public.v_app_replaced_devices cascade;

create view public.v_app_replaced_devices
with (security_invoker = true)
as
select
  id,
  device_type_name,
  model_name,
  serial_or_code,
  quantity,
  notes,
  created_at,
  updated_at,
  created_by_name,
  synced_at
from public.app_replaced_devices;

comment on view public.v_app_replaced_devices is 'عرض مبسّط لمخزون الأجهزة المستبدلة';

grant select on public.v_app_replaced_devices to anon, authenticated;
