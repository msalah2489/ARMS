-- =============================================================================
-- ARMS: ONE-SHOT schema for GitHub Pages / static-export Supabase sync
-- =============================================================================
-- Paste this ENTIRE file into Supabase → SQL Editor → Run (once).
-- Safe to re-run: uses IF NOT EXISTS / DROP POLICY IF EXISTS / DO exception guards.
--
-- Creates missing CRM + ops_branches deps, then arms_client_store + anon policies.
-- Ignore any earlier failure from running 007_static_export_sync.sql alone.
-- =============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums (no-op if already created by 001)
-- ---------------------------------------------------------------------------
do $$ begin
  create type app_role as enum (
    'manager', 'supervisor', 'technician', 'branch_employee', 'service_center_employee'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type device_status as enum (
    'new', 'installed', 'active', 'under_maintenance', 'waiting_for_spare_parts',
    'sent_to_service_center', 'under_service_center_maintenance', 'ready', 'returned',
    'damaged', 'non_repairable', 'retired'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type service_request_status as enum (
    'new', 'in_review', 'assigned', 'in_progress', 'waiting_parts', 'dispatched',
    'at_service_center', 'testing', 'completed', 'closed', 'cancelled'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type request_priority as enum ('low', 'normal', 'high', 'urgent');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type inventory_movement_type as enum (
    'receive', 'issue', 'consume', 'adjust', 'transfer', 'return'
  );
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- CRM tables referenced by static-export anon policies (from 001)
-- ---------------------------------------------------------------------------
create table if not exists public.service_centers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text unique,
  address text,
  contact_name text,
  contact_phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_name text,
  phone text,
  email text,
  address text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.branches (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  name text not null,
  code text,
  address text,
  phone text,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  role app_role not null,
  branch_id uuid references public.branches (id),
  service_center_id uuid references public.service_centers (id),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.device_models (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  brand text,
  model_code text unique,
  description text,
  specifications jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.devices (
  id uuid primary key default gen_random_uuid(),
  device_code text unique not null,
  serial_number text unique not null,
  model_id uuid references public.device_models (id),
  brand text,
  color text,
  customer_id uuid references public.customers (id),
  branch_id uuid references public.branches (id),
  status device_status not null default 'new',
  condition text,
  current_location text,
  qr_code text,
  barcode text,
  installed_at date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.spare_parts (
  id uuid primary key default gen_random_uuid(),
  part_code text unique not null,
  name text not null,
  description text,
  brand text,
  color text,
  unit text not null default 'pcs',
  stock_quantity numeric not null default 0,
  minimum_stock numeric not null default 0,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.service_requests (
  id uuid primary key default gen_random_uuid(),
  request_number text unique not null,
  customer_id uuid not null references public.customers (id),
  branch_id uuid references public.branches (id),
  device_id uuid references public.devices (id),
  reported_problem text,
  description text,
  priority request_priority not null default 'normal',
  status service_request_status not null default 'new',
  created_by uuid references public.profiles (id),
  assigned_technician_id uuid references public.profiles (id),
  supervisor_id uuid references public.profiles (id),
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- ops_branches (from 002) — this is what bare 007 failed on
-- ---------------------------------------------------------------------------
create table if not exists public.ops_branches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text unique not null,
  address text,
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists ops_branch_id uuid references public.ops_branches (id);

insert into public.ops_branches (id, name, code, address, phone)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'فرع الرياض', 'RYD-01', 'الرياض', '0500000001')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Static-export sync bridge (same as 007_static_export_sync.sql)
-- ---------------------------------------------------------------------------
create table if not exists public.arms_client_store (
  store_key text primary key,
  payload jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create or replace function public.touch_arms_client_store_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_arms_client_store_updated_at on public.arms_client_store;
create trigger trg_arms_client_store_updated_at
  before update on public.arms_client_store
  for each row execute function public.touch_arms_client_store_updated_at();

alter table public.arms_client_store enable row level security;

drop policy if exists "public read arms_client_store" on public.arms_client_store;
create policy "public read arms_client_store" on public.arms_client_store
  for select to anon, authenticated using (true);

drop policy if exists "public write arms_client_store" on public.arms_client_store;
create policy "public write arms_client_store" on public.arms_client_store
  for all to anon, authenticated using (true) with check (true);

alter table public.ops_branches
  add column if not exists city text,
  add column if not exists is_service_center boolean not null default false;

update public.ops_branches
set city = coalesce(nullif(trim(city), ''), nullif(trim(address), ''), '—')
where city is null or trim(city) = '';

do $$ begin
  alter table public.customers enable row level security;
exception when others then null;
end $$;
do $$ begin
  alter table public.branches enable row level security;
exception when others then null;
end $$;
do $$ begin
  alter table public.devices enable row level security;
exception when others then null;
end $$;
do $$ begin
  alter table public.service_requests enable row level security;
exception when others then null;
end $$;
do $$ begin
  alter table public.device_models enable row level security;
exception when others then null;
end $$;
do $$ begin
  alter table public.spare_parts enable row level security;
exception when others then null;
end $$;
do $$ begin
  alter table public.ops_branches enable row level security;
exception when others then null;
end $$;

drop policy if exists "anon read customers" on public.customers;
create policy "anon read customers" on public.customers
  for select to anon, authenticated using (true);
drop policy if exists "anon write customers" on public.customers;
create policy "anon write customers" on public.customers
  for all to anon, authenticated using (true) with check (true);

drop policy if exists "anon read branches" on public.branches;
create policy "anon read branches" on public.branches
  for select to anon, authenticated using (true);
drop policy if exists "anon write branches" on public.branches;
create policy "anon write branches" on public.branches
  for all to anon, authenticated using (true) with check (true);

drop policy if exists "anon read devices" on public.devices;
create policy "anon read devices" on public.devices
  for select to anon, authenticated using (true);
drop policy if exists "anon write devices" on public.devices;
create policy "anon write devices" on public.devices
  for all to anon, authenticated using (true) with check (true);

drop policy if exists "anon read service_requests" on public.service_requests;
create policy "anon read service_requests" on public.service_requests
  for select to anon, authenticated using (true);
drop policy if exists "anon write service_requests" on public.service_requests;
create policy "anon write service_requests" on public.service_requests
  for all to anon, authenticated using (true) with check (true);

drop policy if exists "anon read device_models" on public.device_models;
create policy "anon read device_models" on public.device_models
  for select to anon, authenticated using (true);

drop policy if exists "anon read spare_parts" on public.spare_parts;
create policy "anon read spare_parts" on public.spare_parts
  for select to anon, authenticated using (true);

drop policy if exists "anon read ops_branches" on public.ops_branches;
create policy "anon read ops_branches" on public.ops_branches
  for select to anon, authenticated using (true);
drop policy if exists "anon write ops_branches" on public.ops_branches;
create policy "anon write ops_branches" on public.ops_branches
  for all to anon, authenticated using (true) with check (true);

insert into public.arms_client_store (store_key, payload)
values
  ('ops_branches', '[]'::jsonb),
  ('maintenance_requests', '[]'::jsonb),
  ('device_catalog', '{}'::jsonb),
  ('managed_users', '[]'::jsonb),
  ('shipping_batches', '[]'::jsonb),
  ('audit_events', '[]'::jsonb),
  ('technician_work', '[]'::jsonb),
  ('spare_inventory', '{"balances":[],"receipts":[],"movements":[]}'::jsonb),
  ('waybills', '[]'::jsonb)
on conflict (store_key) do nothing;
