-- =============================================================================
-- ARMS: Bootstrap system admin into public.app_users
-- =============================================================================
-- AR: شغّل مرة واحدة في Supabase → SQL Editor → Run.
--     ثم حدّث الموقع بقوة (Ctrl+Shift+R) حتى يعيد hydrate المستخدمين.
--
-- EN: Paste into Supabase → SQL Editor → Run once (safe to re-run).
--     Then hard-refresh the live site so hydrate pulls app_users.
--
-- Login (matches src/lib/users-store.ts SEED_USERS / plain-text check):
--   username: admin
--   password: demo
--   role:     system_admin
-- =============================================================================

-- Source of truth for GitHub Pages login (normalized table — not arms_client_store)
insert into public.app_users (
  id, username, full_name, email, mobile, role,
  ops_branch_id, ops_branch_name, password_plain, is_active,
  created_at, updated_at, synced_at
)
values (
  'admin-local',
  'admin',
  'أحمد المدير',
  'admin@arms.local',
  '0500000001',
  'system_admin',
  null,
  null,
  'demo',
  true,
  now(),
  now(),
  now()
)
on conflict (id) do update
set
  username = excluded.username,
  full_name = excluded.full_name,
  email = excluded.email,
  mobile = excluded.mobile,
  role = excluded.role,
  ops_branch_id = excluded.ops_branch_id,
  ops_branch_name = excluded.ops_branch_name,
  password_plain = coalesce(nullif(excluded.password_plain, ''), public.app_users.password_plain),
  is_active = excluded.is_active,
  updated_at = excluded.updated_at,
  synced_at = excluded.synced_at;

-- Optional: mark not archived when column exists (migration 018+)
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'app_users'
      and column_name = 'is_archived'
  ) then
    execute $q$
      update public.app_users
      set is_archived = false
      where id = 'admin-local'
    $q$;
  end if;
end $$;

-- =============================================================================
-- Done. Verify in Table Editor:
--   ✓ app_users → ≥1 row (username=admin, password_plain=demo, role=system_admin)
-- Then: hard-refresh https://msalah2489.github.io/ARMS/login/ (Ctrl+Shift+R)
-- =============================================================================
