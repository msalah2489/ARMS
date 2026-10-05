-- Branch maintenance workflow extensions. Run in Supabase SQL Editor after 001/setup_all.

-- New roles (safe to re-run: ignore errors if value exists)
do $$ begin alter type app_role add value if not exists 'system_admin'; exception when duplicate_object then null; end $$;
do $$ begin alter type app_role add value if not exists 'maintenance_manager'; exception when duplicate_object then null; end $$;
do $$ begin alter type app_role add value if not exists 'branch'; exception when duplicate_object then null; end $$;
do $$ begin alter type app_role add value if not exists 'maintenance_supervisor'; exception when duplicate_object then null; end $$;
do $$ begin alter type app_role add value if not exists 'mobile_technician'; exception when duplicate_object then null; end $$;

do $$ begin
  create type external_condition as enum ('intact', 'broken', 'scratched', 'leak_marks', 'other');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type branch_priority as enum ('normal', 'urgent');
exception when duplicate_object then null;
end $$;

-- Company-owned branches (not customer locations)
create table if not exists public.ops_branches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text unique not null,
  address text,
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.device_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default true
);

create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default true
);

create table if not exists public.models (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  device_type_id uuid not null references public.device_types (id),
  brand_id uuid not null references public.brands (id),
  is_active boolean not null default true,
  unique (name, brand_id, device_type_id)
);

create table if not exists public.model_accessories (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null references public.models (id) on delete cascade,
  name text not null
);

create sequence if not exists public.service_request_number_seq start 1000;

create or replace function public.next_request_number()
returns text
language plpgsql
as $$
declare
  n bigint;
begin
  n := nextval('public.service_request_number_seq');
  return 'SR-' || to_char(now(), 'YYYY') || '-' || lpad(n::text, 6, '0');
end;
$$;

create table if not exists public.maintenance_requests (
  id uuid primary key default gen_random_uuid(),
  request_number text not null unique default public.next_request_number(),
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  ops_branch_id uuid not null references public.ops_branches (id),
  branch_staff_id uuid not null references public.profiles (id),
  priority branch_priority not null default 'normal',
  customer_mobile text not null check (customer_mobile ~ '^05[0-9]{8}$'),
  contact_name text not null,
  purchase_invoice text,
  general_notes text,
  status text not null default 'open'
);

create table if not exists public.maintenance_request_devices (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.maintenance_requests (id) on delete cascade,
  device_code text not null unique,
  device_type_id uuid not null references public.device_types (id),
  brand_id uuid not null references public.brands (id),
  model_id uuid not null references public.models (id),
  serial_number text,
  fault text,
  external_condition external_condition not null,
  extra_details text,
  receipt_number text not null,
  device_photos text[] not null default '{}',
  receipt_photo text not null,
  lifecycle_status text not null default 'received_at_branch',
  created_at timestamptz not null default now()
);

create table if not exists public.maintenance_request_device_accessories (
  id uuid primary key default gen_random_uuid(),
  request_device_id uuid not null references public.maintenance_request_devices (id) on delete cascade,
  accessory_id uuid not null references public.model_accessories (id)
);

create table if not exists public.shipping_waybills (
  id uuid primary key default gen_random_uuid(),
  waybill_number text not null unique,
  courier_company text not null,
  ops_branch_id uuid not null references public.ops_branches (id),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  status text not null default 'open'
);

create table if not exists public.shipping_waybill_devices (
  id uuid primary key default gen_random_uuid(),
  waybill_id uuid not null references public.shipping_waybills (id) on delete cascade,
  request_device_id uuid not null references public.maintenance_request_devices (id),
  removed boolean not null default false,
  removal_note text,
  removed_by uuid references public.profiles (id),
  removed_at timestamptz
);

alter table public.profiles
  add column if not exists ops_branch_id uuid references public.ops_branches (id);

-- Seed catalogs
insert into public.ops_branches (id, name, code, address, phone)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'فرع الرياض', 'RYD-01', 'الرياض', '0500000001')
on conflict (id) do nothing;

insert into public.device_types (id, name) values
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 'جهاز تعطير'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2', 'جهاز توزيع')
on conflict (id) do nothing;

insert into public.brands (id, name) values
  ('cccccccc-cccc-cccc-cccc-ccccccccccc1', 'AromaTech'),
  ('cccccccc-cccc-cccc-cccc-ccccccccccc2', 'ScentPro')
on conflict (id) do nothing;

insert into public.models (id, name, device_type_id, brand_id) values
  ('dddddddd-dddd-dddd-dddd-ddddddddddd1', 'Nimbus 300', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 'cccccccc-cccc-cccc-cccc-ccccccccccc1'),
  ('dddddddd-dddd-dddd-dddd-ddddddddddd2', 'Aura Mini', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 'cccccccc-cccc-cccc-cccc-ccccccccccc1'),
  ('dddddddd-dddd-dddd-dddd-ddddddddddd3', 'Pro Diffuser', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2', 'cccccccc-cccc-cccc-cccc-ccccccccccc2')
on conflict do nothing;

insert into public.model_accessories (id, model_id, name) values
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1', 'dddddddd-dddd-dddd-dddd-ddddddddddd1', 'سلك كهرباء'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee2', 'dddddddd-dddd-dddd-dddd-ddddddddddd1', 'قاعدة تثبيت'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee3', 'dddddddd-dddd-dddd-dddd-ddddddddddd1', 'عبوة عطر'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee4', 'dddddddd-dddd-dddd-dddd-ddddddddddd2', 'سلك كهرباء'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee5', 'dddddddd-dddd-dddd-dddd-ddddddddddd2', 'ريموت')
on conflict (id) do nothing;

alter table public.ops_branches enable row level security;
alter table public.device_types enable row level security;
alter table public.brands enable row level security;
alter table public.models enable row level security;
alter table public.model_accessories enable row level security;
alter table public.maintenance_requests enable row level security;
alter table public.maintenance_request_devices enable row level security;
alter table public.maintenance_request_device_accessories enable row level security;
alter table public.shipping_waybills enable row level security;
alter table public.shipping_waybill_devices enable row level security;

drop policy if exists "auth read ops branches" on public.ops_branches;
create policy "auth read ops branches" on public.ops_branches for select to authenticated using (true);
drop policy if exists "auth read device types" on public.device_types;
create policy "auth read device types" on public.device_types for select to authenticated using (true);
drop policy if exists "auth read brands" on public.brands;
create policy "auth read brands" on public.brands for select to authenticated using (true);
drop policy if exists "auth read models" on public.models;
create policy "auth read models" on public.models for select to authenticated using (true);
drop policy if exists "auth read model accessories" on public.model_accessories;
create policy "auth read model accessories" on public.model_accessories for select to authenticated using (true);

drop policy if exists "auth rw maintenance requests" on public.maintenance_requests;
create policy "auth rw maintenance requests" on public.maintenance_requests
  for all to authenticated using (true) with check (true);
drop policy if exists "auth rw maintenance request devices" on public.maintenance_request_devices;
create policy "auth rw maintenance request devices" on public.maintenance_request_devices
  for all to authenticated using (true) with check (true);
drop policy if exists "auth rw mrd accessories" on public.maintenance_request_device_accessories;
create policy "auth rw mrd accessories" on public.maintenance_request_device_accessories
  for all to authenticated using (true) with check (true);
drop policy if exists "auth rw waybills" on public.shipping_waybills;
create policy "auth rw waybills" on public.shipping_waybills
  for all to authenticated using (true) with check (true);
drop policy if exists "auth rw waybill devices" on public.shipping_waybill_devices;
create policy "auth rw waybill devices" on public.shipping_waybill_devices
  for all to authenticated using (true) with check (true);
