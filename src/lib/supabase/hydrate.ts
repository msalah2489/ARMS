import { isDemoMode } from "@/lib/auth";
import { applyRemoteBranches } from "@/lib/branches-store";
import {
  applyRemoteMaintenanceRequests,
  applyRemoteWaybills,
  listMaintenanceRequestsLocal,
} from "@/lib/branch-store";
import type { MaintenanceRequestRecord } from "@/types/domain";
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
import { readSession, writeSession } from "@/lib/session";
import {
  applyRemoteManagedUsers,
  ensureBootstrapAdminIfEmpty,
  findManagedUserForSession,
  listManagedUsersLocal,
  managedUserToProfile,
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
  pushAppMaintenanceRequests,
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

/** Soft background refresh interval (stale-while-revalidate). */
const REVALIDATE_MS = 90_000;

let hydratePromise: Promise<boolean> | null = null;
let hydrateInFlight = false;
let lastSuccessAt = 0;
let backgroundRevalidateTimer: ReturnType<typeof setTimeout> | null = null;

export type HydrateOptions = {
  /** Bypass session cache and pull from network. */
  force?: boolean;
};

function refreshSessionProfileFromUsers() {
  const session = readSession();
  if (!session) return;
  const managed = findManagedUserForSession(session);
  if (!managed) return;
  writeSession(managedUserToProfile(managed));
}

function markHydrated() {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(HYDRATED_FLAG, "1");
  lastSuccessAt = Date.now();
  refreshSessionProfileFromUsers();
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

/** Clear session hydrate markers (e.g. on sign-out) so the next login pulls fresh data. */
export function clearOpsHydrateSession() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(HYDRATED_FLAG);
  lastSuccessAt = 0;
  hydratePromise = null;
  hydrateInFlight = false;
  if (backgroundRevalidateTimer) {
    clearTimeout(backgroundRevalidateTimer);
    backgroundRevalidateTimer = null;
  }
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

async function runHydratePull(): Promise<boolean> {
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

    reconcilePayload({
      remoteHas: remoteBranches.length > 0,
      remoteValue: remoteBranches,
      emptyValue: [],
      apply: applyRemoteBranches,
    });

    // Requests: keep local-only rows (just saved, push still in flight) so a
    // background re-pull cannot hide a brand-new request from the UI.
    {
      const local = listMaintenanceRequestsLocal({ skipSeed: true });
      if (remoteRequests.length === 0) {
        if (local.length > 0) {
          await pushAppMaintenanceRequests(local);
        } else {
          applyRemoteMaintenanceRequests([]);
        }
      } else {
        const remoteIds = new Set(remoteRequests.map((row) => row.id));
        const localOnly = local.filter((row) => row.id && !remoteIds.has(row.id));
        const merged: MaintenanceRequestRecord[] =
          localOnly.length > 0
            ? [...localOnly, ...remoteRequests].sort((a, b) =>
                b.receivedAt.localeCompare(a.receivedAt),
              )
            : remoteRequests;
        applyRemoteMaintenanceRequests(merged);
        if (localOnly.length > 0) {
          await pushAppMaintenanceRequests(merged);
        }
      }
    }

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
    const message = error instanceof Error ? error.message : String(error);
    if (isAuthLikeSupabaseError(error) || /invalid api key/i.test(message)) {
      setArmsSyncStatus({ state: "auth_error", message });
    } else {
      setArmsSyncStatus({ state: "error", message });
    }
    return false;
  }
}

function startHydratePull(): Promise<boolean> {
  if (!hydratePromise) {
    hydrateInFlight = true;
    hydratePromise = runHydratePull()
      .then((ok) => {
        // Keep resolved promise so later awaits are instant; clear only on hard failure.
        if (!ok && !wasOpsHydratedThisSession()) {
          hydratePromise = null;
        }
        return ok;
      })
      .finally(() => {
        hydrateInFlight = false;
      });
  }
  return hydratePromise;
}

function scheduleBackgroundRevalidate() {
  if (typeof window === "undefined") return;
  if (backgroundRevalidateTimer || hydrateInFlight) return;

  const age = lastSuccessAt > 0 ? Date.now() - lastSuccessAt : REVALIDATE_MS;
  const delay = Math.max(0, REVALIDATE_MS - age);

  backgroundRevalidateTimer = setTimeout(() => {
    backgroundRevalidateTimer = null;
    if (hydrateInFlight) return;
    // Drop cached promise so a soft re-pull can run; session flag keeps UI non-blocking.
    hydratePromise = null;
    void startHydratePull();
  }, delay);
}

/**
 * Pull shared ops data from normalized app_* tables into localStorage cache.
 * Remote is source of truth after hydrate. Demo seed is never injected here.
 *
 * Session cache: after a successful hydrate, later calls return immediately
 * (stale-while-revalidate via a debounced background refresh).
 */
export async function hydrateOpsFromSupabase(options?: HydrateOptions): Promise<boolean> {
  if (typeof window === "undefined") return false;

  const configProblem = getSupabaseConfigProblem();
  if (configProblem) {
    setArmsSyncStatus({ state: "config_error", code: configProblem });
    return false;
  }

  if (!isSupabaseConfigured() || isDemoMode()) return false;

  const force = Boolean(options?.force);

  // Already hydrated this tab session → never block navigation on a full re-pull.
  if (!force && wasOpsHydratedThisSession()) {
    // In-memory success this page life: optional soft revalidate when stale.
    if (lastSuccessAt === 0 || Date.now() - lastSuccessAt >= REVALIDATE_MS) {
      scheduleBackgroundRevalidate();
    }
    return true;
  }

  // In-flight or completed pull in this JS context.
  if (!force && hydratePromise) {
    return hydratePromise;
  }

  if (force) {
    hydratePromise = null;
  }

  return startHydratePull();
}
