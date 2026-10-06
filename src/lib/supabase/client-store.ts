import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

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

export async function pullClientStore<T>(
  storeKey: ArmsClientStoreKey,
  fallback: T,
): Promise<T> {
  if (!isSupabaseConfigured() || typeof window === "undefined") return fallback;

  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("arms_client_store")
      .select("payload")
      .eq("store_key", storeKey)
      .maybeSingle();

    if (error) throw error;
    if (data?.payload === undefined || data?.payload === null) return fallback;
    return data.payload as T;
  } catch (error) {
    console.error(`[arms] pullClientStore(${storeKey})`, error);
    return fallback;
  }
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
    return { ok: false, error: message };
  }
}
