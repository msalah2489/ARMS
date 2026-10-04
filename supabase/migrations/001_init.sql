-- ARMS core schema: identity, customers, devices, service, inventory, movements.
-- Apply in Supabase SQL editor or via supabase db push.

create extension if not exists "pgcrypto";

create type app_role as enum (
  'manager',
  'supervisor',
  'technician',
  'branch_employee',
  'service_center_employee'
);

create type device_status as enum (
  'new',
  'installed',
  'active',
  'under_maintenance',
  'waiting_for_spare_parts',
  'sent_to_service_center',
  'under_service_center_maintenance',
  'ready',
  'returned',
  'damaged',
  'non_repairable',
  'retired'
);

create type service_request_status as enum (
  'new',
  'in_review',
  'assigned',
  'in_progress',
  'waiting_parts',
  'dispatched',
  'at_service_center',
  'testing',
  'completed',
  'closed',
  'cancelled'
);

create type request_priority as enum ('low', 'normal', 'high', 'urgent');

create type inventory_movement_type as enum (
  'receive',
  'issue',
  'consume',
  'adjust',
  'transfer',
  'return'
);

create table public.service_centers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text unique,
  address text,
  contact_name text,
  contact_phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.customers (
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

create table public.branches (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  name text not null,
  code text,
  address text,
  phone text,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  role app_role not null,
  branch_id uuid references public.branches (id),
  service_center_id uuid references public.service_centers (id),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.device_models (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  brand text,
  model_code text unique,
  description text,
  specifications jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.devices (
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

create table public.device_status_history (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices (id) on delete cascade,
  from_status device_status,
  to_status device_status not null,
  changed_by uuid references public.profiles (id),
  note text,
  created_at timestamptz not null default now()
);

create table public.accessories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text unique,
  description text,
  is_active boolean not null default true
);

create table public.device_accessories (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices (id) on delete cascade,
  accessory_id uuid not null references public.accessories (id),
  quantity integer not null default 1,
  status text,
  notes text
);

create table public.spare_parts (
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

create table public.spare_part_movements (
  id uuid primary key default gen_random_uuid(),
  spare_part_id uuid not null references public.spare_parts (id),
  movement_type inventory_movement_type not null,
  quantity numeric not null,
  reference text,
  notes text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.service_requests (
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

create table public.service_request_history (
  id uuid primary key default gen_random_uuid(),
  service_request_id uuid not null references public.service_requests (id) on delete cascade,
  from_status service_request_status,
  to_status service_request_status not null,
  changed_by uuid references public.profiles (id),
  note text,
  created_at timestamptz not null default now()
);

create table public.maintenance_records (
  id uuid primary key default gen_random_uuid(),
  service_request_id uuid not null references public.service_requests (id) on delete cascade,
  device_id uuid not null references public.devices (id),
  technician_id uuid references public.profiles (id),
  inspection_notes text,
  actions_taken text,
  device_status_after device_status,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.spare_part_usage (
  id uuid primary key default gen_random_uuid(),
  spare_part_id uuid not null references public.spare_parts (id),
  service_request_id uuid references public.service_requests (id),
  device_id uuid references public.devices (id),
  technician_id uuid references public.profiles (id),
  quantity numeric not null,
  notes text,
  used_at timestamptz not null default now()
);

create table public.customer_receipts (
  id uuid primary key default gen_random_uuid(),
  receipt_number text not null,
  receipt_type text not null check (receipt_type in ('receive', 'return')),
  customer_id uuid references public.customers (id),
  branch_id uuid references public.branches (id),
  notes text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.customer_receipt_devices (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references public.customer_receipts (id) on delete cascade,
  device_id uuid not null references public.devices (id)
);

create table public.device_dispatches (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices (id),
  service_request_id uuid references public.service_requests (id),
  from_branch_id uuid references public.branches (id),
  service_center_id uuid not null references public.service_centers (id),
  reason text,
  device_condition text,
  dispatched_at timestamptz not null default now(),
  received_at timestamptz,
  returned_at timestamptz,
  notes text,
  created_by uuid references public.profiles (id)
);

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  file_path text not null,
  file_name text,
  mime_type text,
  uploaded_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  body text,
  event_type text not null,
  entity_type text,
  entity_id uuid,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_devices_customer on public.devices (customer_id);
create index idx_devices_branch on public.devices (branch_id);
create index idx_devices_status on public.devices (status);
create index idx_sr_status on public.service_requests (status);
create index idx_sr_technician on public.service_requests (assigned_technician_id);
create index idx_sr_customer on public.service_requests (customer_id);
create index idx_receipt_number on public.customer_receipts (receipt_number);

create or replace function public.current_role()
returns app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_manager()
returns boolean
language sql
stable
as $$
  select public.current_role() = 'manager';
$$;

alter table public.customers enable row level security;
alter table public.branches enable row level security;
alter table public.profiles enable row level security;
alter table public.device_models enable row level security;
alter table public.devices enable row level security;
alter table public.device_status_history enable row level security;
alter table public.accessories enable row level security;
alter table public.device_accessories enable row level security;
alter table public.spare_parts enable row level security;
alter table public.spare_part_movements enable row level security;
alter table public.service_requests enable row level security;
alter table public.service_request_history enable row level security;
alter table public.maintenance_records enable row level security;
alter table public.spare_part_usage enable row level security;
alter table public.customer_receipts enable row level security;
alter table public.customer_receipt_devices enable row level security;
alter table public.service_centers enable row level security;
alter table public.device_dispatches enable row level security;
alter table public.attachments enable row level security;
alter table public.notifications enable row level security;

create policy "authenticated read customers" on public.customers for select to authenticated using (true);
create policy "manager write customers" on public.customers for all to authenticated using (public.is_manager()) with check (public.is_manager());

create policy "authenticated read branches" on public.branches for select to authenticated using (true);
create policy "manager write branches" on public.branches for all to authenticated using (public.is_manager()) with check (public.is_manager());

create policy "read profiles" on public.profiles for select to authenticated using (true);
create policy "manager write profiles" on public.profiles for all to authenticated using (public.is_manager()) with check (public.is_manager());

create policy "authenticated read models" on public.device_models for select to authenticated using (true);
create policy "manager write models" on public.device_models for all to authenticated using (public.is_manager()) with check (public.is_manager());

create policy "authenticated read devices" on public.devices for select to authenticated using (true);
create policy "ops update devices" on public.devices for update to authenticated
  using (public.current_role() in ('manager', 'supervisor', 'technician', 'branch_employee', 'service_center_employee'));
create policy "manager insert devices" on public.devices for insert to authenticated
  with check (public.current_role() in ('manager', 'branch_employee'));

create policy "authenticated read sr" on public.service_requests for select to authenticated using (true);
create policy "create sr" on public.service_requests for insert to authenticated
  with check (public.current_role() in ('manager', 'supervisor', 'branch_employee'));
create policy "update sr" on public.service_requests for update to authenticated
  using (public.current_role() in ('manager', 'supervisor', 'technician', 'service_center_employee'));

create policy "authenticated read parts" on public.spare_parts for select to authenticated using (true);
create policy "manager write parts" on public.spare_parts for all to authenticated using (public.is_manager()) with check (public.is_manager());

create policy "authenticated read related ops" on public.device_status_history for select to authenticated using (true);
create policy "authenticated read accessories" on public.accessories for select to authenticated using (true);
create policy "authenticated read device accessories" on public.device_accessories for select to authenticated using (true);
create policy "authenticated read movements" on public.spare_part_movements for select to authenticated using (true);
create policy "authenticated read sr history" on public.service_request_history for select to authenticated using (true);
create policy "authenticated read maintenance" on public.maintenance_records for select to authenticated using (true);
create policy "tech write maintenance" on public.maintenance_records for insert to authenticated
  with check (public.current_role() in ('manager', 'supervisor', 'technician', 'service_center_employee'));
create policy "authenticated read usage" on public.spare_part_usage for select to authenticated using (true);
create policy "tech write usage" on public.spare_part_usage for insert to authenticated
  with check (public.current_role() in ('manager', 'supervisor', 'technician', 'service_center_employee'));
create policy "authenticated read receipts" on public.customer_receipts for select to authenticated using (true);
create policy "branch write receipts" on public.customer_receipts for insert to authenticated
  with check (public.current_role() in ('manager', 'branch_employee', 'supervisor'));
create policy "authenticated read receipt devices" on public.customer_receipt_devices for select to authenticated using (true);
create policy "authenticated read centers" on public.service_centers for select to authenticated using (true);
create policy "authenticated read dispatches" on public.device_dispatches for select to authenticated using (true);
create policy "ops write dispatches" on public.device_dispatches for all to authenticated
  using (public.current_role() in ('manager', 'supervisor', 'technician', 'service_center_employee'))
  with check (public.current_role() in ('manager', 'supervisor', 'technician', 'service_center_employee'));
create policy "authenticated read attachments" on public.attachments for select to authenticated using (true);
create policy "own notifications" on public.notifications for select to authenticated using (user_id = auth.uid());

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data->>'role')::app_role, 'branch_employee')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
