import { isDemoMode } from "@/lib/auth";
import {
  applyRemoteBranches,
  listOpsBranchRecords,
  listOpsBranchRecordsLocal,
  replaceOpsBranchRecords,
} from "@/lib/branches-store";
import {
  applyRemoteMaintenanceRequests,
  applyRemoteWaybills,
  listMaintenanceRequestsLocal,
  listWaybillsLocal,
  replaceMaintenanceRequests,
  replaceWaybills,
} from "@/lib/branch-store";
import {
  applyRemoteCatalog,
  getCatalogLocal,
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
  replaceTechnicianWork,
} from "@/lib/technician-store";
import {
  applyRemoteManagedUsers,
  listManagedUsersLocal,
  replaceManagedUsers,
  seedManagedUsersIfEmpty,
} from "@/lib/users-store";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { pullClientStore, pushClientStore } from "@/lib/supabase/client-store";
import type {
  ManagedUser,
  MaintenanceRequestRecord,
  OpsBranchRecord,
  ShippingBatch,
  TechnicianWorkRecord,
  WaybillRecord,
} from "@/types/domain";

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
 * Does NOT sync language/theme preferences.
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
          pullClientStore<OpsBranchRecord[]>("ops_branches", []),
          pullClientStore<MaintenanceRequestRecord[]>("maintenance_requests", []),
          pullClientStore<DeviceCatalogState | Record<string, never>>(
            "device_catalog",
            {},
          ),
          pullClientStore<ManagedUser[]>("managed_users", []),
          pullClientStore<ShippingBatch[]>("shipping_batches", []),
          pullClientStore<Array<Record<string, unknown>>>("audit_events", []),
          pullClientStore<TechnicianWorkRecord[]>("technician_work", []),
          pullClientStore<SpareInventoryState | Record<string, never>>(
            "spare_inventory",
            {},
          ),
          pullClientStore<WaybillRecord[]>("waybills", []),
        ]);

        const localBranches = listOpsBranchRecordsLocal();
        if (remoteBranches.length > 0) {
          applyRemoteBranches(remoteBranches);
        } else if (localBranches.length > 0) {
          await pushClientStore("ops_branches", localBranches);
        } else {
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

        const localUsers = listManagedUsersLocal();
        if (remoteUsers.length > 0) {
          applyRemoteManagedUsers(remoteUsers);
        } else if (localUsers.length > 0) {
          await pushClientStore("managed_users", localUsers);
        } else {
          const seeded = seedManagedUsersIfEmpty();
          replaceManagedUsers(seeded);
          await pushClientStore("managed_users", seeded);
        }

        const localBatches = listShippingBatchesLocal();
        const localAudit = listAuditEventsLocal();
        if (remoteBatches.length > 0 || remoteAudit.length > 0) {
          applyRemoteShippingState({
            batches: remoteBatches,
            audit: remoteAudit,
          });
        } else if (localBatches.length > 0 || localAudit.length > 0) {
          await Promise.all([
            pushClientStore("shipping_batches", localBatches),
            pushClientStore("audit_events", localAudit),
          ]);
        } else {
          replaceShippingState({ batches: [], audit: [] });
          await Promise.all([
            pushClientStore("shipping_batches", []),
            pushClientStore("audit_events", []),
          ]);
        }

        const localWork = listTechnicianWorkLocal();
        if (remoteWork.length > 0) {
          applyRemoteTechnicianWork(remoteWork);
        } else if (localWork.length > 0) {
          await pushClientStore("technician_work", localWork);
        } else {
          replaceTechnicianWork([]);
          await pushClientStore("technician_work", []);
        }

        const hasSpare =
          remoteSpare &&
          typeof remoteSpare === "object" &&
          (Array.isArray((remoteSpare as SpareInventoryState).balances) ||
            Array.isArray((remoteSpare as SpareInventoryState).receipts) ||
            Array.isArray((remoteSpare as SpareInventoryState).movements)) &&
          ((remoteSpare as SpareInventoryState).balances?.length > 0 ||
            (remoteSpare as SpareInventoryState).receipts?.length > 0 ||
            (remoteSpare as SpareInventoryState).movements?.length > 0);

        if (hasSpare) {
          applyRemoteSpareInventory(remoteSpare as SpareInventoryState);
        } else {
          const localSpare = getSpareInventoryLocal();
          const localHas =
            localSpare.balances.length > 0 ||
            localSpare.receipts.length > 0 ||
            localSpare.movements.length > 0;
          if (localHas) {
            await pushClientStore("spare_inventory", localSpare);
          } else {
            replaceSpareInventory({ balances: [], receipts: [], movements: [] });
            await pushClientStore("spare_inventory", {
              balances: [],
              receipts: [],
              movements: [],
            });
          }
        }

        const localWaybills = listWaybillsLocal();
        if (remoteWaybills.length > 0) {
          applyRemoteWaybills(remoteWaybills);
        } else if (localWaybills.length > 0) {
          await pushClientStore("waybills", localWaybills);
        } else {
          replaceWaybills([]);
          await pushClientStore("waybills", []);
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
