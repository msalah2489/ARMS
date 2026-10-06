-- =============================================================================
-- ARMS: Read-only VIEW to list managed users from arms_client_store JSON
-- =============================================================================
-- AR: شغّل مرة في Supabase → SQL Editor. لا يغيّر البيانات الحية.
--     يعرض كل مستخدم مُدار كصف منفصل بدل البحث داخل عمود payload.
--     لا يعرض كلمة المرور (password) عمدًا.
-- EN: Paste into Supabase → SQL Editor → Run. Safe to re-run.
--     Expands arms_client_store.managed_users payload into rows.
--     Password field intentionally omitted.
-- =============================================================================

create or replace view public.v_managed_users_list
with (security_invoker = true)
as
select
  elem->>'id' as id,
  elem->>'username' as username,
  elem->>'fullName' as full_name,
  elem->>'email' as email,
  elem->>'mobile' as mobile,
  elem->>'role' as role,
  elem->>'opsBranchId' as ops_branch_id,
  elem->>'opsBranchName' as ops_branch_name,
  coalesce((elem->>'isActive')::boolean, true) as is_active,
  elem->>'createdAt' as created_at,
  elem->>'updatedAt' as updated_at,
  s.updated_at as store_updated_at
from public.arms_client_store s
cross join lateral jsonb_array_elements(
  case
    when jsonb_typeof(s.payload) = 'array' then s.payload
    else '[]'::jsonb
  end
) as elem
where s.store_key = 'managed_users';

comment on view public.v_managed_users_list is
  'Read-only expansion of arms_client_store.managed_users JSON for Table Editor browsing (no passwords)';

grant select on public.v_managed_users_list to anon, authenticated;
