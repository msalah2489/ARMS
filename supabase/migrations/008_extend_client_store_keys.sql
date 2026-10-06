-- ARMS: extend arms_client_store keys for remaining Pages ops data.
-- Safe to re-run. Requires arms_client_store (from 000 or 007).
-- Prefer re-running 000_apply_all_for_pages.sql on a fresh project;
-- existing projects that already ran 000/007 only need this file.

insert into public.arms_client_store (store_key, payload)
values
  ('managed_users', '[]'::jsonb),
  ('shipping_batches', '[]'::jsonb),
  ('audit_events', '[]'::jsonb),
  ('technician_work', '[]'::jsonb),
  ('spare_inventory', '{"balances":[],"receipts":[],"movements":[]}'::jsonb),
  ('waybills', '[]'::jsonb)
on conflict (store_key) do nothing;
