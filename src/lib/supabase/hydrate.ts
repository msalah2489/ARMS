import { isDemoMode } from "@/lib/auth";
import { applyRemoteBranches } from "@/lib/branches-store";
import {
  applyRemoteMaintenanceRequests,
  applyRemoteWaybills,
  listMaintenanceRequestsLocal,
} from "@/lib/branch-store";
import {
  applyRemoteCatalog,
  replaceCatalog,
  type DeviceCatalogState,
} from "@/lib/catalog-store";
import {
  applyRemoteShippingState,
  replaceShippingState,
} from "@/lib/shipping-store";
import {
  applyRemoteSpareInventory,
  replaceSpareInventory,
  type SpareInventoryState,
} from "@/lib/spare-inventory-store";
import { applyRemoteTechnicianWork } from "@/lib/technician-store";
import { applyRemoteManagedUsers } from "@/lib/users-store";
import { getSupabaseConfigProblem, isSupabaseConfigured } from "@/lib/supabase/config";
import { pullClientStoreStrict } from "@/lib/supabase/client-store";
import { expandAllClientStoreToRelational } from "@/lib/supabase/expand-relational";
import {
  isAuthLikeSupabaseError,
  setArmsSyncStatus,
} from "@/lib/supabase/sync-status";
import type {
  ManagedUser,
  MaintenanceRequestRecord,
  OpsBranchRecord,
  ShippingBatch,
  TechnicianWorkRecord,
  WaybillRecord,
} from "@/types/domain";

const HYDRATED_FLAG = "arms_supabase_hydrated_v1";
/** Legacy flags kept so older browsers stop retrying obsolete local→remote bootstrap. */
const BOOTSTRAP_FLAG = "arms_supabase_ops_bootstrapped_v1";
const BOOTSTRAP_OK_FLAG = "arms_supabase_ops_bootstrap_ok_v1";

let hydratePromise: Promise<boolean> | null = null;

function markHydrated() {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(HYDRATED_FLAG, "1");
  window.dispatchEvent(new CustomEvent("arms-ops-hydrated"));
}

function markBootstrapConfirmed() {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(BOOTSTRAP_FLAG, "1");
  window.localStorage.setItem(BOOTSTRAP_OK_FLAG, "1");
}

export function wasOpsHydratedThisSession() {
  if (typeof window === "undefined") return false;
  return window.sessionStorage.getItem(HYDRATED_FLAG) === "1";
}

function catalogHasRows(catalog: DeviceCatalogState | Record<string, never> | null | undefined) {
  if (!catalog || typeof catalog !== "object") return false;
  const state = catalog as DeviceCatalogState;
  return (
    (Array.isArray(state.deviceTypes) && state.deviceTypes.length > 0) ||
    (Array.isArray(state.brands) && state.brands.length > 0) ||
    (Array.isArray(state.models) && state.models.length > 0)
  );
}

function spareHasRows(spare: SpareInventoryState | Record<string, never> | null | undefined) {
  if (!spare || typeof spare !== "object") return false;
  const state = spare as SpareInventoryState;
  return (
    (state.balances?.length ?? 0) > 0 ||
    (state.receipts?.length ?? 0) > 0 ||
    (state.movements?.length ?? 0) > 0
  );
}

const EMPTY_CATALOG: DeviceCatalogState = {
  deviceTypes: [],
  brands: [],
  models: [],
};

const EMPTY_SPARE: SpareInventoryState = {
  balances: [],
  receipts: [],
  movements: [],
};

/**
 * Reconcile one store key:
 * - remote has data → overwrite local (remote is source of truth)
 * - remote empty → clear local (never upload leftover demo/seed; never re-seed)
 * New writes already push via schedulePersist; hydrate must not inject code seeds.
 */
function reconcilePayload<T>(options: {
  remoteHas: boolean;
  remoteValue: T;
  emptyValue: T;
  apply: (value: T) => void;
}) {
  if (options.remoteHas) {
    options.apply(options.remoteValue);
    return;
  }
  options.apply(options.emptyValue);
}

/**
 * Pull shared ops data from Supabase into localStorage cache.
 * Remote is source of truth after hydrate. Demo seed is never injected here.
 * Language/theme preferences are not synced.
 */
export async function hydrateOpsFromSupabase(): Promise<boolean> {
  if (typeof window === "undefined") return false;

  const configProblem = getSupabaseConfigProblem();
  if (configProblem) {
    setArmsSyncStatus({ state: "config_error", code: configProblem });
    return false;
  }

  if (!isSupabaseConfigured() || isDemoMode()) return false;

  if (!hydratePromise) {
    hydratePromise = (async () => {
      try {
        const [
          remoteBranches,
          remoteRequests,
          remoteCatalog,
          remoteUsers,
          remoteBatches,
          remoteAudit,
          remoteWork,
          remoteSpare,
          remoteWaybills,
        ] = await Promise.all([
          pullClientStoreStrict<OpsBranchRecord[]>("ops_branches", []),
          pullClientStoreStrict<MaintenanceRequestRecord[]>("maintenance_requests", []),
          pullClientStoreStrict<DeviceCatalogState | Record<string, never>>(
            "device_catalog",
            {},
          ),
          pullClientStoreStrict<ManagedUser[]>("managed_users", []),
          pullClientStoreStrict<ShippingBatch[]>("shipping_batches", []),
          pullClientStoreStrict<Array<Record<string, unknown>>>("audit_events", []),
          pullClientStoreStrict<TechnicianWorkRecord[]>("technician_work", []),
          pullClientStoreStrict<SpareInventoryState | Record<string, never>>(
            "spare_inventory",
            {},
          ),
          pullClientStoreStrict<WaybillRecord[]>("waybills", []),
        ]);

        // Ensure seed path is never taken during hydrate (skipSeed: true).
        void listMaintenanceRequestsLocal({ skipSeed: true });

        reconcilePayload({
          remoteHas: remoteBranches.length > 0,
          remoteValue: remoteBranches,
          emptyValue: [],
          apply: applyRemoteBranches,
        });

        reconcilePayload({
          remoteHas: remoteRequests.length > 0,
          remoteValue: remoteRequests,
          emptyValue: [],
          apply: applyRemoteMaintenanceRequests,
        });

        reconcilePayload({
          remoteHas: catalogHasRows(remoteCatalog),
          remoteValue: {
            deviceTypes: (remoteCatalog as DeviceCatalogState).deviceTypes ?? [],
            brands: (remoteCatalog as DeviceCatalogState).brands ?? [],
            models: (remoteCatalog as DeviceCatalogState).models ?? [],
          },
          emptyValue: EMPTY_CATALOG,
          apply: (value) => {
            if (catalogHasRows(value)) applyRemoteCatalog(value);
            else replaceCatalog(EMPTY_CATALOG);
          },
        });

        reconcilePayload({
          remoteHas: remoteUsers.length > 0,
          remoteValue: remoteUsers,
          emptyValue: [],
          apply: applyRemoteManagedUsers,
        });

        const remoteShippingHas = remoteBatches.length > 0 || remoteAudit.length > 0;
        if (remoteShippingHas) {
          applyRemoteShippingState({
            batches: remoteBatches,
            audit: remoteAudit,
          });
        } else {
          replaceShippingState({ batches: [], audit: [] });
        }

        reconcilePayload({
          remoteHas: remoteWork.length > 0,
          remoteValue: remoteWork,
          emptyValue: [],
          apply: applyRemoteTechnicianWork,
        });

        reconcilePayload({
          remoteHas: spareHasRows(remoteSpare),
          remoteValue: {
            balances: (remoteSpare as SpareInventoryState).balances ?? [],
            receipts: (remoteSpare as SpareInventoryState).receipts ?? [],
            movements: (remoteSpare as SpareInventoryState).movements ?? [],
          },
          emptyValue: EMPTY_SPARE,
          apply: (value) => {
            if (spareHasRows(value)) applyRemoteSpareInventory(value);
            else replaceSpareInventory(EMPTY_SPARE);
          },
        });

        reconcilePayload({
          remoteHas: remoteWaybills.length > 0,
          remoteValue: remoteWaybills,
          emptyValue: [],
          apply: applyRemoteWaybills,
        });

        markBootstrapConfirmed();
        markHydrated();
        setArmsSyncStatus({ state: "ok" });
        void expandAllClientStoreToRelational();
        return true;
      } catch (error) {
        console.error("[arms] hydrateOpsFromSupabase", error);
        hydratePromise = null;
        const message = error instanceof Error ? error.message : String(error);
        if (isAuthLikeSupabaseError(error) || /invalid api key/i.test(message)) {
          setArmsSyncStatus({ state: "auth_error", message });
        } else {
          setArmsSyncStatus({ state: "error", message });
        }
        return false;
      }
    })();
  }

  return hydratePromise;
}
