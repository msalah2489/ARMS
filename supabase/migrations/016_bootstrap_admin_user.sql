-- =============================================================================
-- ARMS: Bootstrap system admin after cleanup (014 emptied managed_users)
-- =============================================================================
-- AR: شغّل مرة واحدة في Supabase → SQL Editor → Run.
--     ثم حدّث الموقع بقوة (Ctrl+Shift+R) حتى يعيد hydrate المستخدمين.
--
-- EN: Paste into Supabase → SQL Editor → Run once (safe to re-run).
--     Then hard-refresh the live site so hydrate pulls managed_users.
--
-- Login (matches src/lib/users-store.ts SEED_USERS / plain-text check):
--   username: admin
--   password: demo
--   role:     system_admin
-- =============================================================================

insert into public.arms_client_store (store_key, payload, updated_at)
values (
  'managed_users',
  jsonb_build_array(
    jsonb_build_object(
      'id', 'admin-local',
      'fullName', 'أحمد المدير',
      'username', 'admin',
      'email', 'admin@arms.local',
      'mobile', '0500000001',
      'role', 'system_admin',
      'opsBranchId', null,
      'opsBranchName', null,
      'password', 'demo',
      'isActive', true,
      'createdAt', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'updatedAt', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    )
  ),
  now()
)
on conflict (store_key) do update
set
  payload = excluded.payload,
  updated_at = excluded.updated_at;

-- Keep normalized app_users in sync (expand RPC may fail under safeupdate)
do $$
begin
  if to_regclass('public.app_users') is null then
    return;
  end if;

  truncate table public.app_users;

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
  );
end $$;

-- =============================================================================
-- Done. Verify:
--   ✓ arms_client_store → managed_users has 1 user (admin / demo)
--   ✓ app_users → 1 row (username=admin, role=system_admin)
-- Then: hard-refresh https://msalah2489.github.io/ARMS/ (Ctrl+Shift+R)
-- =============================================================================
