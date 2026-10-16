-- =============================================================================
-- CS-FEATURE — Seed customer_service demo user into public.app_users
-- =============================================================================
-- AR: شغّل مرة في Supabase → SQL Editor → Run (آمن لإعادة التشغيل).
--     ثم حدّث صفحة الدخول بقوة (Ctrl+Shift+R).
--
-- EN: Paste into Supabase → SQL Editor → Run once (safe to re-run).
--     Then hard-refresh the live login page.
--
-- Login (matches src/lib/users-store.ts SEED_USERS / plain-text check):
--   username: cs
--   email:    cs@arms.local
--   password: demo
--   role:     customer_service
--
-- Note: Live ops accounts often use AAA3; this CS demo row uses `demo`
-- (same as nora.branch / maint demo rows and in-app seed).
-- =============================================================================

insert into public.app_users (
  id, username, full_name, email, mobile, role,
  ops_branch_id, ops_branch_name, password_plain, is_active,
  created_at, updated_at, synced_at
)
values (
  'cs-local',
  'cs',
  'ليان خدمة العملاء',
  'cs@arms.local',
  '0500000008',
  'customer_service',
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
  -- Keep an existing non-empty password (do not clobber if already customized).
  password_plain = coalesce(nullif(public.app_users.password_plain, ''), excluded.password_plain),
  is_active = excluded.is_active,
  updated_at = excluded.updated_at,
  synced_at = excluded.synced_at;

-- Optional columns (018+ archive, 019+ permissions)
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
      where id = 'cs-local'
    $q$;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'app_users'
      and column_name = 'permissions'
  ) then
    execute $q$
      update public.app_users
      set permissions = coalesce(permissions, '[]'::jsonb)
      where id = 'cs-local'
    $q$;
  end if;
end $$;

-- =============================================================================
-- Done. Verify:
--   ✓ app_users → username=cs, password_plain=demo, role=customer_service
-- Then: hard-refresh the live /login/ page
-- =============================================================================
