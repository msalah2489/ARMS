import { isDemoMode } from "@/lib/auth";
import {
  applyRemoteBranches,
  listOpsBranchRecordsLocal,
} from "@/lib/branches-store";
import {
  applyRemoteMaintenanceRequests,
  applyRemoteWaybills,
  listMaintenanceRequestsLocal,
  listWaybillsLocal,
} from "@/lib/branch-store";
import {
  applyRemoteCatalog,
  getCatalogLocalRaw,
  replaceCatalog,
  type DeviceCatalogState,
} from "@/lib/catalog-store";
import {
  applyRemoteShippingState,
  listAuditEventsLocal,
  listShippingBatchesLocal,
  replaceShippingState,
} from "@/lib/shipping-store";
import {
  applyRemoteSpareInventory,
  getSpareInventoryLocal,
  replaceSpareInventory,
  type SpareInventoryState,
} from "@/lib/spare-inventory-store";
import {
  applyRemoteTechnicianWork,
  listTechnicianWorkLocal,
} from "@/lib/technician-store";
import {
  applyRemoteManagedUsers,
  listManagedUsersLocal,
} from "@/lib/users-store";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { pullClientStoreStrict, pushClientStore } from "@/lib/supabase/client-store";
import type {
  ManagedUser,
  MaintenanceRequestRecord,
  OpsBranchRecord,
  ShippingBatch,
  TechnicianWorkRecord,
  WaybillRecord,
} from "@/types/domain";

const HYDRATED_FLAG = "arms_supabase_hydrated_v1";
/** One-time local→remote bootstrap so orphan localStorage is not shown forever. */
const BOOTSTRAP_FLAG = "arms_supabase_ops_bootstrapped_v1";

let hydratePromise: Promise<boolean> | null = null;

function markHydrated() {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(HYDRATED_FLAG, "1");
  window.dispatchEvent(new CustomEvent("arms-ops-hydrated"));
}

function isBootstrapped() {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(BOOTSTRAP_FLAG) === "1";
}

function markBootstrapped() {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(BOOTSTRAP_FLAG, "1");
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
 * - remote empty + local has data + not yet bootstrapped → upload local once
 * - otherwise → clear local to match empty remote (never re-seed demo)
 */
async function reconcilePayload<T>(options: {
  key: Parameters<typeof pushClientStore>[0];
  remoteHas: boolean;
  localHas: boolean;
  remoteValue: T;
  localValue: T;
  emptyValue: T;
  apply: (value: T) => void;
}) {
  const bootstrapped = isBootstrapped();

  if (options.remoteHas) {
    options.apply(options.remoteValue);
    return;
  }

  if (options.localHas && !bootstrapped) {
    await pushClientStore(options.key, options.localValue);
    options.apply(options.localValue);
    return;
  }

  // Remote empty/null is truth — clear local orphans; never re-seed demo.
  options.apply(options.emptyValue);
}

/**
 * Pull shared ops data from Supabase into localStorage cache.
 * Remote is source of truth after hydrate. Demo seed is never injected here.
 * Language/theme preferences are not synced.
 */
export async function hydrateOpsFromSupabase(): Promise<boolean> {
  if (typeof window === "undefined") return false;
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

        const localBranches = listOpsBranchRecordsLocal();
        await reconcilePayload({
          key: "ops_branches",
          remoteHas: remoteBranches.length > 0,
          localHas: localBranches.length > 0,
          remoteValue: remoteBranches,
          localValue: localBranches,
          emptyValue: [],
          apply: applyRemoteBranches,
        });

        const localRequests = listMaintenanceRequestsLocal({ skipSeed: true });
        await reconcilePayload({
          key: "maintenance_requests",
          remoteHas: remoteRequests.length > 0,
          localHas: localRequests.length > 0,
          remoteValue: remoteRequests,
          localValue: localRequests,
          emptyValue: [],
          apply: applyRemoteMaintenanceRequests,
        });

        const localCatalogRaw = getCatalogLocalRaw();
        const localCatalog: DeviceCatalogState = localCatalogRaw ?? EMPTY_CATALOG;
        await reconcilePayload({
          key: "device_catalog",
          remoteHas: catalogHasRows(remoteCatalog),
          localHas: catalogHasRows(localCatalog),
          remoteValue: {
            deviceTypes: (remoteCatalog as DeviceCatalogState).deviceTypes ?? [],
            brands: (remoteCatalog as DeviceCatalogState).brands ?? [],
            models: (remoteCatalog as DeviceCatalogState).models ?? [],
          },
          localValue: localCatalog,
          emptyValue: EMPTY_CATALOG,
          apply: (value) => {
            if (catalogHasRows(value)) applyRemoteCatalog(value);
            else replaceCatalog(EMPTY_CATALOG);
          },
        });

        const localUsers = listManagedUsersLocal();
        await reconcilePayload({
          key: "managed_users",
          remoteHas: remoteUsers.length > 0,
          localHas: localUsers.length > 0,
          remoteValue: remoteUsers,
          localValue: localUsers,
          emptyValue: [],
          apply: applyRemoteManagedUsers,
        });

        const localBatches = listShippingBatchesLocal();
        const localAudit = listAuditEventsLocal();
        const remoteShippingHas = remoteBatches.length > 0 || remoteAudit.length > 0;
        const localShippingHas = localBatches.length > 0 || localAudit.length > 0;
        const bootstrapped = isBootstrapped();

        if (remoteShippingHas) {
          applyRemoteShippingState({
            batches: remoteBatches,
            audit: remoteAudit,
          });
        } else if (localShippingHas && !bootstrapped) {
          await Promise.all([
            pushClientStore("shipping_batches", localBatches),
            pushClientStore("audit_events", localAudit),
          ]);
        } else {
          replaceShippingState({ batches: [], audit: [] });
        }

        const localWork = listTechnicianWorkLocal();
        await reconcilePayload({
          key: "technician_work",
          remoteHas: remoteWork.length > 0,
          localHas: localWork.length > 0,
          remoteValue: remoteWork,
          localValue: localWork,
          emptyValue: [],
          apply: applyRemoteTechnicianWork,
        });

        const localSpare = getSpareInventoryLocal();
        await reconcilePayload({
          key: "spare_inventory",
          remoteHas: spareHasRows(remoteSpare),
          localHas: spareHasRows(localSpare),
          remoteValue: {
            balances: (remoteSpare as SpareInventoryState).balances ?? [],
            receipts: (remoteSpare as SpareInventoryState).receipts ?? [],
            movements: (remoteSpare as SpareInventoryState).movements ?? [],
          },
          localValue: localSpare,
          emptyValue: EMPTY_SPARE,
          apply: (value) => {
            if (spareHasRows(value)) applyRemoteSpareInventory(value);
            else replaceSpareInventory(EMPTY_SPARE);
          },
        });

        const localWaybills = listWaybillsLocal();
        await reconcilePayload({
          key: "waybills",
          remoteHas: remoteWaybills.length > 0,
          localHas: localWaybills.length > 0,
          remoteValue: remoteWaybills,
          localValue: localWaybills,
          emptyValue: [],
          apply: applyRemoteWaybills,
        });

        markBootstrapped();
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
