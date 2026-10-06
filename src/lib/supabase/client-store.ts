import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { isAuthLikeSupabaseError, setArmsSyncStatus } from "@/lib/supabase/sync-status";

export type ArmsClientStoreKey =
  | "ops_branches"
  | "maintenance_requests"
  | "device_catalog"
  | "managed_users"
  | "shipping_batches"
  | "audit_events"
  | "technician_work"
  | "spare_inventory"
  | "waybills";

function reportStoreError(storeKey: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (isAuthLikeSupabaseError(error) || /invalid api key/i.test(message)) {
    setArmsSyncStatus({ state: "auth_error", message: `${storeKey}: ${message}` });
  }
}

export async function pullClientStore<T>(
  storeKey: ArmsClientStoreKey,
  fallback: T,
): Promise<T> {
  if (!isSupabaseConfigured() || typeof window === "undefined") return fallback;

  try {
    return await pullClientStoreStrict(storeKey, fallback);
  } catch (error) {
    console.error(`[arms] pullClientStore(${storeKey})`, error);
    reportStoreError(storeKey, error);
    return fallback;
  }
}

/** Like pullClientStore but throws on network/RLS errors (hydrate must not wipe cache). */
export async function pullClientStoreStrict<T>(
  storeKey: ArmsClientStoreKey,
  fallback: T,
): Promise<T> {
  if (!isSupabaseConfigured() || typeof window === "undefined") return fallback;

  const supabase = createClient();
  const { data, error } = await supabase
    .from("arms_client_store")
    .select("payload")
    .eq("store_key", storeKey)
    .maybeSingle();

  if (error) {
    reportStoreError(storeKey, error);
    throw error;
  }
  if (data?.payload === undefined || data?.payload === null) return fallback;
  return data.payload as T;
}

export async function pushClientStore<T>(
  storeKey: ArmsClientStoreKey,
  payload: T,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isSupabaseConfigured() || typeof window === "undefined") {
    return { ok: false, error: "Supabase is not configured." };
  }

  try {
    const supabase = createClient();
    const { error } = await supabase.from("arms_client_store").upsert(
      {
        store_key: storeKey,
        payload,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "store_key" },
    );
    if (error) throw error;
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[arms] pushClientStore(${storeKey})`, error);
    reportStoreError(storeKey, error);
    return { ok: false, error: message };
  }
}
