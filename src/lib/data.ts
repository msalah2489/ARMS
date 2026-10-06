import { isDemoMode } from "@/lib/auth";
import {
  demoSpareParts,
} from "@/lib/demo-data";
import {
  localizedDemoBranches,
  localizedDemoCustomers,
  localizedDemoDevices,
  localizedDemoRequests,
} from "@/lib/i18n/demo-locale";
import {
  listOpsBranches,
  listOpsCustomers,
  listOpsDevices,
  listOpsServiceRequests,
} from "@/lib/ops-data";
import { getStoredLocale, type AppLocale } from "@/lib/preferences";
import { listInventoryBalances } from "@/lib/spare-inventory-store";
import { createClient } from "@/lib/supabase/client";
import { getSupabaseConfigProblem, isSupabaseConfigured } from "@/lib/supabase/config";
import { hydrateOpsFromSupabase, wasOpsHydratedThisSession } from "@/lib/supabase/hydrate";
import { getArmsSyncStatus, setArmsSyncStatus } from "@/lib/supabase/sync-status";
import type {
  Branch,
  Customer,
  DashboardStats,
  Device,
  DeviceStatus,
  ServiceRequest,
  SparePart,
} from "@/types/domain";

function resolveLocale(locale?: AppLocale): AppLocale {
  return locale ?? getStoredLocale();
}

async function ensureOpsHydrated() {
  if (typeof window === "undefined") return;
  const problem = getSupabaseConfigProblem();
  if (problem) {
    setArmsSyncStatus({ state: "config_error", code: problem });
    return;
  }
  if (!isSupabaseConfigured() || isDemoMode()) return;
  // Session cache: hydrateOpsFromSupabase returns immediately when already hydrated.
  await hydrateOpsFromSupabase();
}

/**
 * Prefer ops (branch workflow) cache only when cloud hydrate succeeded,
 * or when running without cloud (demo). Never treat orphan localStorage as
 * platform data when Supabase keys are missing/invalid or auth failed.
 */
function canUseOpsLocalCache(): boolean {
  if (typeof window === "undefined") return false;
  if (isDemoMode()) return true;

  const problem = getSupabaseConfigProblem();
  if (problem) return false;

  if (!isSupabaseConfigured()) return true;

  const sync = getArmsSyncStatus();
  if (sync.state === "config_error" || sync.state === "auth_error") return false;
  if (!wasOpsHydratedThisSession()) {
    // Transient network/API errors: keep local cache + banner; otherwise wait.
    return sync.state === "error";
  }
  return true;
}

function clientOpsDevices(): Device[] | null {
  if (!canUseOpsLocalCache()) return null;
  const rows = listOpsDevices();
  return rows.length > 0 ? rows : null;
}

function clientOpsCustomers(): Customer[] | null {
  if (!canUseOpsLocalCache()) return null;
  const rows = listOpsCustomers();
  return rows.length > 0 ? rows : null;
}

function clientOpsBranches(locale?: AppLocale): Branch[] | null {
  if (!canUseOpsLocalCache()) return null;
  const rows = listOpsBranches(resolveLocale(locale));
  return rows.length > 0 ? rows : null;
}

export async function getCustomers(locale?: AppLocale): Promise<Customer[]> {
  await ensureOpsHydrated();

  if (isDemoMode()) return localizedDemoCustomers(resolveLocale(locale));

  const ops = clientOpsCustomers();
  if (ops) return ops;

  if (!isSupabaseConfigured()) {
    return getSupabaseConfigProblem() ? [] : localizedDemoCustomers(resolveLocale(locale));
  }

  try {
    const supabase = createClient();
    const { data, error } = await supabase.from("customers").select("*, branches(count), devices(count)");
    if (error) throw error;

    return (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      contactName: row.contact_name ?? "",
      phone: row.phone ?? "",
      email: row.email ?? "",
      address: row.address ?? "",
      branchCount: Array.isArray(row.branches) ? Number(row.branches[0]?.count ?? 0) : 0,
      deviceCount: Array.isArray(row.devices) ? Number(row.devices[0]?.count ?? 0) : 0,
    }));
  } catch (error) {
    console.error(error);
    return [];
  }
}

export async function getBranches(locale?: AppLocale): Promise<Branch[]> {
  await ensureOpsHydrated();

  if (isDemoMode()) return localizedDemoBranches(resolveLocale(locale));

  const ops = clientOpsBranches(locale);
  if (ops) return ops;

  if (!isSupabaseConfigured()) {
    return getSupabaseConfigProblem() ? [] : localizedDemoBranches(resolveLocale(locale));
  }

  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("branches")
      .select("id, customer_id, name, code, address, phone, customers(name)");
    if (error) throw error;

    return (data ?? []).map((row) => ({
      id: row.id,
      customerId: row.customer_id,
      customerName: (row.customers as { name?: string } | null)?.name ?? "",
      name: row.name,
      code: row.code ?? "",
      address: row.address ?? "",
      phone: row.phone ?? "",
    }));
  } catch (error) {
    console.error(error);
    return [];
  }
}

export async function getDevices(locale?: AppLocale): Promise<Device[]> {
  await ensureOpsHydrated();

  if (isDemoMode()) return localizedDemoDevices(resolveLocale(locale));

  const ops = clientOpsDevices();
  if (ops) return ops;

  if (!isSupabaseConfigured()) {
    return getSupabaseConfigProblem() ? [] : localizedDemoDevices(resolveLocale(locale));
  }

  try {
    const supabase = createClient();
    const { data, error } = await supabase.from("devices").select(
      "id, device_code, serial_number, brand, color, status, current_location, qr_code, device_models(name), customers(name), branches(name)",
    );
    if (error) throw error;

    return (data ?? []).map((row) => ({
      id: row.id,
      deviceCode: row.device_code,
      serialNumber: row.serial_number,
      modelName: (row.device_models as { name?: string } | null)?.name ?? "",
      brand: row.brand ?? "",
      color: row.color ?? "",
      customerName: (row.customers as { name?: string } | null)?.name ?? "",
      branchName: (row.branches as { name?: string } | null)?.name ?? "",
      status: row.status as DeviceStatus,
      currentLocation: row.current_location ?? "",
      qrCode: row.qr_code ?? row.device_code,
    }));
  } catch (error) {
    console.error(error);
    return [];
  }
}

export async function getServiceRequests(locale?: AppLocale): Promise<ServiceRequest[]> {
  await ensureOpsHydrated();

  if (isDemoMode()) return localizedDemoRequests(resolveLocale(locale));

  // Ops cache mirrors app_maintenance_requests after hydrate.
  // Never fall back to classic CRM `service_requests` (often empty / unused).
  if (canUseOpsLocalCache()) {
    return listOpsServiceRequests();
  }

  // Broken/missing cloud keys or auth failure: empty list + sync banner.
  return [];
}

export async function getSpareParts(): Promise<SparePart[]> {
  if (isDemoMode()) return demoSpareParts;

  if (!isSupabaseConfigured()) return demoSpareParts;

  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("spare_parts")
      .select("id, part_code, name, brand, stock_quantity, minimum_stock, unit");
    if (error) throw error;

    return (data ?? []).map((row) => ({
      id: row.id,
      partCode: row.part_code,
      name: row.name,
      brand: row.brand ?? "",
      stockQuantity: Number(row.stock_quantity ?? 0),
      minimumStock: Number(row.minimum_stock ?? 0),
      unit: row.unit ?? "pcs",
    }));
  } catch (error) {
    console.error(error);
    return [];
  }
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const requests = await getServiceRequests();
  const devices = await getDevices();
  const inventory =
    typeof window !== "undefined"
      ? listInventoryBalances()
      : [];

  // Prefer local spare inventory; skip classic spare_parts network round-trip when possible.
  const parts = inventory.length > 0 ? [] : await getSpareParts();

  const openStatuses = new Set([
    "new",
    "in_review",
    "assigned",
    "in_progress",
    "waiting_parts",
    "dispatched",
    "at_service_center",
    "testing",
  ]);
  const month = new Date().toISOString().slice(0, 7);

  return {
    openRequests: requests.filter((item) => openStatuses.has(item.status)).length,
    devicesUnderMaintenance: devices.filter((item) => item.status === "under_maintenance").length,
    dispatchedDevices: devices.filter((item) =>
      ["sent_to_service_center", "under_service_center_maintenance"].includes(item.status),
    ).length,
    lowStockParts:
      inventory.length > 0
        ? inventory.filter((item) => item.quantity <= 2).length
        : parts.filter((item) => item.stockQuantity <= item.minimumStock).length,
    activeDevices: devices.filter((item) => item.status === "active").length,
    completedThisMonth: requests.filter(
      (item) =>
        ["completed", "closed"].includes(item.status) && item.requestedAt.startsWith(month),
    ).length,
  };
}
