-- =============================================================================
-- ARMS: Read-only VIEW to list SR numbers from arms_client_store JSON
-- =============================================================================
-- AR: شغّل مرة في Supabase → SQL Editor. لا يغيّر البيانات الحية.
--     يعرض كل طلب صيانة كصف منفصل (رقم الطلب…) بدل البحث داخل عمود payload.
-- EN: Paste into Supabase → SQL Editor → Run. Safe to re-run.
--     Expands arms_client_store.maintenance_requests payload into rows.
-- =============================================================================

create or replace view public.v_maintenance_requests_list
with (security_invoker = true)
as
select
  elem->>'id' as id,
  elem->>'requestNumber' as request_number,
  elem->>'opsBranchId' as ops_branch_id,
  elem->>'opsBranchName' as ops_branch_name,
  elem->>'contactName' as contact_name,
  elem->>'customerMobile' as customer_mobile,
  elem->>'priority' as priority,
  elem->>'receivedAt' as received_at,
  elem->>'branchStaffName' as branch_staff_name,
  jsonb_array_length(coalesce(elem->'devices', '[]'::jsonb)) as device_count,
  s.updated_at as store_updated_at
from public.arms_client_store s
cross join lateral jsonb_array_elements(
  case
    when jsonb_typeof(s.payload) = 'array' then s.payload
    else '[]'::jsonb
  end
) as elem
where s.store_key = 'maintenance_requests';

comment on view public.v_maintenance_requests_list is
  'Read-only expansion of arms_client_store.maintenance_requests JSON for Table Editor browsing';

grant select on public.v_maintenance_requests_list to anon, authenticated;
