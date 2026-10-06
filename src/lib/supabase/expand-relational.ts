import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { ArmsClientStoreKey } from "@/lib/supabase/client-store";

/** Keys that have a matching expand_arms_store_key branch in SQL migration 013. */
const EXPANDABLE_KEYS = new Set<ArmsClientStoreKey>([
  "ops_branches",
  "maintenance_requests",
  "device_catalog",
  "managed_users",
  "shipping_batches",
  "audit_events",
  "technician_work",
  "spare_inventory",
  "waybills",
]);

/**
 * Mirror one JSON store key into normalized app_* tables (SQL RPC).
 * Failures are logged only — never block the primary arms_client_store sync.
 */
export async function expandStoreKeyToRelational(
  storeKey: ArmsClientStoreKey,
): Promise<void> {
  if (!isSupabaseConfigured() || typeof window === "undefined") return;
  if (!EXPANDABLE_KEYS.has(storeKey)) return;

  try {
    const supabase = createClient();
    const { error } = await supabase.rpc("expand_arms_store_key", {
      p_key: storeKey,
    });
    if (error) {
      // RPC missing until migration 013 is applied — ignore quietly.
      if (/function .* does not exist|PGRST202|42883/i.test(error.message)) {
        return;
      }
      console.warn(`[arms] expandStoreKeyToRelational(${storeKey})`, error.message);
    }
  } catch (error) {
    console.warn(`[arms] expandStoreKeyToRelational(${storeKey})`, error);
  }
}

/**
 * Expand all client-store keys into app_* tables after hydrate.
 * Safe no-op if migration 013 is not applied yet.
 */
export async function expandAllClientStoreToRelational(): Promise<void> {
  if (!isSupabaseConfigured() || typeof window === "undefined") return;

  try {
    const supabase = createClient();
    const { error } = await supabase.rpc("expand_arms_client_store");
    if (error) {
      if (/function .* does not exist|PGRST202|42883/i.test(error.message)) {
        return;
      }
      console.warn("[arms] expandAllClientStoreToRelational", error.message);
    }
  } catch (error) {
    console.warn("[arms] expandAllClientStoreToRelational", error);
  }
}
