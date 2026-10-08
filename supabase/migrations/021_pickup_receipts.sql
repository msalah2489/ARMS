-- =============================================================================
-- ARMS: نماذج استلام مندوب الاستلام (pickup_courier receipt forms)
-- =============================================================================
-- Safe to re-run (idempotent). Creates app_pickup_receipts + RLS for anon/authenticated.
-- =============================================================================

create table if not exists public.app_pickup_receipts (
  id text primary key,
  receipt_number text,
  direction text,
  ops_branch_id text,
  ops_branch_name text,
  created_by text,
  created_by_name text,
  assigned_courier_id text,
  assigned_courier_name text,
  status text,
  created_at timestamptz,
  submitted_at timestamptz,
  courier_reviewed_at timestamptz,
  line_count integer not null default 0,
  notes text,
  payload jsonb,
  synced_at timestamptz not null default now()
);

create index if not exists idx_app_pickup_receipts_courier
  on public.app_pickup_receipts (assigned_courier_id);

create index if not exists idx_app_pickup_receipts_branch
  on public.app_pickup_receipts (ops_branch_id);

create index if not exists idx_app_pickup_receipts_status
  on public.app_pickup_receipts (status);

comment on table public.app_pickup_receipts is
  'نماذج استلام مندوب الاستلام — صف لكل نموذج (payload يحتوي البنود)';
comment on column public.app_pickup_receipts.receipt_number is 'رقم النموذج';
comment on column public.app_pickup_receipts.direction is
  'branch_to_center | center_to_branch';
comment on column public.app_pickup_receipts.status is
  'draft|pending_courier|partially_rejected|approved|pending_supervisor|received_at_center|received_at_branch|cancelled';
comment on column public.app_pickup_receipts.payload is 'الكائن الكامل PickupReceipt JSON';

alter table public.app_pickup_receipts enable row level security;

drop policy if exists "anon_all_app_pickup_receipts" on public.app_pickup_receipts;
create policy "anon_all_app_pickup_receipts"
  on public.app_pickup_receipts
  for all
  to anon, authenticated
  using (true)
  with check (true);

grant select, insert, update, delete on public.app_pickup_receipts to anon, authenticated;

drop view if exists public.v_app_pickup_receipts cascade;

create view public.v_app_pickup_receipts
with (security_invoker = true)
as
select
  id,
  receipt_number,
  direction,
  ops_branch_name,
  created_by_name,
  assigned_courier_name,
  status,
  line_count,
  created_at,
  submitted_at,
  courier_reviewed_at,
  notes,
  synced_at
from public.app_pickup_receipts;

comment on view public.v_app_pickup_receipts is
  'نماذج استلام المندوب بدون payload الكامل — للتصفح';

grant select on public.v_app_pickup_receipts to anon, authenticated;
