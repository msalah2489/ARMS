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
import {
  applyRemoteManagedUsers,
  ensureBootstrapAdminIfEmpty,
  listManagedUsersLocal,
  mergeManagedUserLists,
} from "@/lib/users-store";
import {
  pullAppAuditEvents,
  pullAppBranches,
  pullAppCatalog,
  pullAppMaintenanceRequests,
  pullAppShippingBatches,
  pullAppSpareInventory,
  pullAppTechnicianWork,
  pullAppUsers,
  pullAppWaybills,
  pushAppUsers,
} from "@/lib/supabase/app-sync";
import { getSupabaseConfigProblem, isSupabaseConfigured } from "@/lib/supabase/config";
import {
  isAuthLikeSupabaseError,
  setArmsSyncStatus,
} from "@/lib/supabase/sync-status";

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

function catalogHasRows(catalog: DeviceCatalogState | null | undefined) {
  if (!catalog || typeof catalog !== "object") return false;
  return (
    (Array.isArray(catalog.deviceTypes) && catalog.deviceTypes.length > 0) ||
    (Array.isArray(catalog.brands) && catalog.brands.length > 0) ||
    (Array.isArray(catalog.models) && catalog.models.length > 0)
  );
}

function spareHasRows(spare: SpareInventoryState | null | undefined) {
  if (!spare || typeof spare !== "object") return false;
  return (
    (spare.balances?.length ?? 0) > 0 ||
    (spare.receipts?.length ?? 0) > 0 ||
    (spare.movements?.length ?? 0) > 0
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
 * Reconcile one store:
 * - remote has data → overwrite local (remote is source of truth)
 * - remote empty → clear local (never upload leftover demo/seed; never re-seed)
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
 * Pull shared ops data from normalized app_* tables into localStorage cache.
 * Remote is source of truth after hydrate. Demo seed is never injected here.
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
          pullAppBranches(),
          pullAppMaintenanceRequests(),
          pullAppCatalog(),
          pullAppUsers(),
          pullAppShippingBatches(),
          pullAppAuditEvents(),
          pullAppTechnicianWork(),
          pullAppSpareInventory(),
          pullAppWaybills(),
        ]);

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
          remoteValue: remoteCatalog,
          emptyValue: EMPTY_CATALOG,
          apply: (value) => {
            if (catalogHasRows(value)) applyRemoteCatalog(value);
            else replaceCatalog(EMPTY_CATALOG);
          },
        });

        // Users: NEVER discard local-only accounts when remote is a subset (e.g. only admin).
        // Merge by id (union). Prefer local when local is larger / has extras so passwords survive.
        // Upsert catch-up without orphan prune — incomplete remote must not wipe localStorage.
        {
          const local = listManagedUsersLocal();
          const remoteIds = new Set(remoteUsers.map((user) => user.id));
          const localOnly = local.filter((user) => user.id && !remoteIds.has(user.id));
          const localIsSuperset =
            localOnly.length > 0 || (local.length > 0 && local.length > remoteUsers.length);

          if (remoteUsers.length === 0) {
            // Remote empty: keep/seed local, then upsert so cloud gets local cache / admin.
            const localUsers = ensureBootstrapAdminIfEmpty();
            if (localUsers.length > 0) {
              await pushAppUsers(localUsers, { pruneOrphans: false });
            }
          } else if (localIsSuperset) {
            const merged = mergeManagedUserLists(remoteUsers, local, { preferLocal: true });
            applyRemoteManagedUsers(merged);
            await pushAppUsers(merged, { pruneOrphans: false });
          } else if (localOnly.length > 0) {
            const merged = mergeManagedUserLists(remoteUsers, local, { preferLocal: false });
            applyRemoteManagedUsers(merged);
            await pushAppUsers(merged, { pruneOrphans: false });
          } else {
            applyRemoteManagedUsers(remoteUsers);
          }
        }

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
          remoteValue: remoteSpare,
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
