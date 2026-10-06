-- =============================================================================
-- ARMS: Cleanup legacy public.profiles (Pages → managed_users model)
-- =============================================================================
-- AR: شغّل هذا الملف مرة في Supabase → SQL Editor.
--     تطبيق GitHub Pages يسجّل الدخول عبر arms_client_store → managed_users
--     (JSON)، وليس عبر جدول profiles / Supabase Auth.
--     هذا السكربت يفرّغ صفوف profiles التجريبية القديمة (مثل Lina Haddad)
--     دون المساس ببيانات التطبيق الحية.
--
-- EN: Paste into Supabase → SQL Editor → Run (once; safe to re-run).
--     GitHub Pages auth uses arms_client_store.managed_users, NOT profiles.
--     Clears experimental / seed profile rows (e.g. Lina Haddad manager).
--
-- DELETES (يُحذف):
--   • كل صفوف public.profiles (بما فيها seed مثل Lina Haddad)
--
-- KEEPS (لا يُمس):
--   • public.arms_client_store  — بما فيه managed_users وجميع payloads
--   • auth.users               — لا نحذف حسابات Auth (آمن أكثر)
--   • بنية جدول profiles       — الجدول يبقى؛ فقط الصفوف تُفرَّغ
--
-- WHY DELETE ALL profiles?
--   Pages لا يعتمد على profiles لتسجيل الدخول. الصفوف المتبقية غالباً seed
--   تجريبي من setup_all / Auth قديم. تفريغ الكل أبسط وآمن من قائمة أسماء.
--
-- FK NOTES:
--   • profiles.id → auth.users(id) ON DELETE CASCADE
--     (حذف auth.users يحذف profile؛ العكس غير صحيح — حذف profile لا يحذف Auth)
--   • جداول CRM قديمة قد تشير إلى profiles — نُصفّر FKs الاختيارية أولاً
-- =============================================================================

do $$
declare
  r record;
begin
  if to_regclass('public.profiles') is null then
    raise notice 'public.profiles does not exist — nothing to clean.';
    return;
  end if;

  -- -------------------------------------------------------------------------
  -- 1) Null optional FKs FROM remaining tables TO profiles
  --    (so DELETE FROM profiles is not blocked by referential integrity)
  -- -------------------------------------------------------------------------
  for r in
    select
      c.conrelid::regclass as tbl,
      a.attname as col
    from pg_constraint c
    join pg_attribute a
      on a.attrelid = c.conrelid
     and a.attnum = any (c.conkey)
    where c.contype = 'f'
      and c.confrelid = 'public.profiles'::regclass
      and a.attnotnull = false
  loop
    execute format('update %s set %I = null where %I is not null', r.tbl, r.col, r.col);
  end loop;

  -- Known CRM columns (in case catalog lookup missed a non-FK leftover)
  if to_regclass('public.service_requests') is not null then
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'service_requests'
        and column_name = 'created_by'
    ) then
      execute 'update public.service_requests set created_by = null where created_by is not null';
    end if;
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'service_requests'
        and column_name = 'assigned_technician_id'
    ) then
      execute 'update public.service_requests set assigned_technician_id = null where assigned_technician_id is not null';
    end if;
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'service_requests'
        and column_name = 'supervisor_id'
    ) then
      execute 'update public.service_requests set supervisor_id = null where supervisor_id is not null';
    end if;
  end if;

  -- -------------------------------------------------------------------------
  -- 2) Delete ALL profile rows (idempotent: empty table is a no-op)
  --    Does NOT delete auth.users. Does NOT touch arms_client_store.
  -- -------------------------------------------------------------------------
  delete from public.profiles;

  raise notice 'public.profiles cleared. arms_client_store and auth.users untouched.';
end $$;

-- =============================================================================
-- Verify in Table Editor:
--   ✓ profiles empty (0 rows) — Lina Haddad / demo managers gone
--   ✓ arms_client_store → managed_users payload unchanged
--   ✓ auth.users still present (optional leftovers; unused by Pages login)
-- =============================================================================
