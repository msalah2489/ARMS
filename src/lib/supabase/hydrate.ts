import { isDemoMode } from "@/lib/auth";
import {
  applyRemoteBranches,
  listOpsBranchRecords,
  listOpsBranchRecordsLocal,
  replaceOpsBranchRecords,
} from "@/lib/branches-store";
import {
  applyRemoteMaintenanceRequests,
  listMaintenanceRequestsLocal,
  replaceMaintenanceRequests,
} from "@/lib/branch-store";
import {
  applyRemoteCatalog,
  getCatalogLocal,
  replaceCatalog,
  type DeviceCatalogState,
} from "@/lib/catalog-store";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { pullClientStore, pushClientStore } from "@/lib/supabase/client-store";
import type { MaintenanceRequestRecord, OpsBranchRecord } from "@/types/domain";

const HYDRATED_FLAG = "arms_supabase_hydrated_v1";

let hydratePromise: Promise<boolean> | null = null;

function markHydrated() {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(HYDRATED_FLAG, "1");
  window.dispatchEvent(new CustomEvent("arms-ops-hydrated"));
}

export function wasOpsHydratedThisSession() {
  if (typeof window === "undefined") return false;
  return window.sessionStorage.getItem(HYDRATED_FLAG) === "1";
}

/**
 * Pull shared ops data from Supabase into localStorage cache.
 * If remote is empty and local has data, push local once (bootstrap).
 */
export async function hydrateOpsFromSupabase(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!isSupabaseConfigured() || isDemoMode()) return false;

  if (!hydratePromise) {
    hydratePromise = (async () => {
      try {
        const [remoteBranches, remoteRequests, remoteCatalog] = await Promise.all([
          pullClientStore<OpsBranchRecord[]>("ops_branches", []),
          pullClientStore<MaintenanceRequestRecord[]>("maintenance_requests", []),
          pullClientStore<DeviceCatalogState | Record<string, never>>(
            "device_catalog",
            {},
          ),
        ]);

        const localBranches = listOpsBranchRecordsLocal();
        if (remoteBranches.length > 0) {
          applyRemoteBranches(remoteBranches);
        } else if (localBranches.length > 0) {
          await pushClientStore("ops_branches", localBranches);
        } else {
          // Fresh browser: seed default branches locally and publish once.
          const seeded = listOpsBranchRecords();
          replaceOpsBranchRecords(seeded);
          await pushClientStore("ops_branches", seeded);
        }

        const localRequests = listMaintenanceRequestsLocal({ skipSeed: true });
        if (remoteRequests.length > 0) {
          applyRemoteMaintenanceRequests(remoteRequests);
        } else if (localRequests.length > 0) {
          await pushClientStore("maintenance_requests", localRequests);
        } else {
          replaceMaintenanceRequests([]);
          await pushClientStore("maintenance_requests", []);
        }

        const hasCatalog =
          remoteCatalog &&
          typeof remoteCatalog === "object" &&
          Array.isArray((remoteCatalog as DeviceCatalogState).deviceTypes) &&
          (remoteCatalog as DeviceCatalogState).deviceTypes.length > 0;

        if (hasCatalog) {
          applyRemoteCatalog(remoteCatalog as DeviceCatalogState);
        } else {
          const localCatalog = getCatalogLocal();
          replaceCatalog(localCatalog);
          await pushClientStore("device_catalog", localCatalog);
        }

        markHydrated();
        return true;
      } catch (error) {
        console.error("[arms] hydrateOpsFromSupabase", error);
        hydratePromise = null;
        return false;
      }
    })();
  }

  return hydratePromise;
}
