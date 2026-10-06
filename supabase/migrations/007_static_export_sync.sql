-- ARMS static export (GitHub Pages) sync bridge.
-- Run in Supabase SQL Editor after 001–006 (or after setup_all + 002–006).
-- Enables browser anon client read/write for core ops data without Auth profiles.

-- ---------------------------------------------------------------------------
-- Document store matching localStorage shapes used by the static app
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

-- ---------------------------------------------------------------------------
-- ops_branches: fields used by admin UI
-- ---------------------------------------------------------------------------
alter table public.ops_branches
  add column if not exists city text,
  add column if not exists is_service_center boolean not null default false;

update public.ops_branches
set city = coalesce(nullif(trim(city), ''), nullif(trim(address), ''), '—')
where city is null or trim(city) = '';

-- ---------------------------------------------------------------------------
-- Starter anon policies for CRM tables (tighten later with real Auth roles)
-- ---------------------------------------------------------------------------
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

-- Seed keys so first client upsert has a row to update
insert into public.arms_client_store (store_key, payload)
values
  ('ops_branches', '[]'::jsonb),
  ('maintenance_requests', '[]'::jsonb),
  ('device_catalog', '{}'::jsonb)
on conflict (store_key) do nothing;
