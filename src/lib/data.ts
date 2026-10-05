import { isDemoMode } from "@/lib/auth";
import {
  demoBranches,
  demoCustomers,
  demoDevices,
  demoRequests,
  demoSpareParts,
  demoStats,
} from "@/lib/demo-data";
import { createClient } from "@/lib/supabase/client";
import type {
  Branch,
  Customer,
  DashboardStats,
  Device,
  DeviceStatus,
  RequestPriority,
  ServiceRequest,
  ServiceRequestStatus,
  SparePart,
} from "@/types/domain";

export async function getCustomers(): Promise<Customer[]> {
  if (isDemoMode()) return demoCustomers;

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
    return demoCustomers;
  }
}

export async function getBranches(): Promise<Branch[]> {
  if (isDemoMode()) return demoBranches;

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
    return demoBranches;
  }
}

export async function getDevices(): Promise<Device[]> {
  if (isDemoMode()) return demoDevices;

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
    return demoDevices;
  }
}

export async function getServiceRequests(): Promise<ServiceRequest[]> {
  if (isDemoMode()) return demoRequests;

  try {
    const supabase = createClient();
    const { data, error } = await supabase.from("service_requests").select(
      "id, request_number, reported_problem, priority, status, requested_at, customers(name), branches(name), devices(device_code, serial_number)",
    );
    if (error) throw error;

    return (data ?? []).map((row) => ({
      id: row.id,
      requestNumber: row.request_number,
      customerName: (row.customers as { name?: string } | null)?.name ?? "",
      branchName: (row.branches as { name?: string } | null)?.name ?? "",
      deviceCode: (row.devices as { device_code?: string } | null)?.device_code ?? "",
      serialNumber: (row.devices as { serial_number?: string } | null)?.serial_number ?? "",
      reportedProblem: row.reported_problem ?? "",
      priority: row.priority as RequestPriority,
      status: row.status as ServiceRequestStatus,
      assignedTechnician: null,
      requestedAt: row.requested_at,
    }));
  } catch (error) {
    console.error(error);
    return demoRequests;
  }
}

export async function getSpareParts(): Promise<SparePart[]> {
  if (isDemoMode()) return demoSpareParts;

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
    return demoSpareParts;
  }
}

export async function getDashboardStats(): Promise<DashboardStats> {
  if (isDemoMode()) return demoStats;

  const [requests, devices, parts] = await Promise.all([
    getServiceRequests(),
    getDevices(),
    getSpareParts(),
  ]);

  const openStatuses = new Set(["new", "in_review", "assigned", "in_progress", "waiting_parts", "dispatched", "at_service_center", "testing"]);
  const month = new Date().toISOString().slice(0, 7);

  return {
    openRequests: requests.filter((item) => openStatuses.has(item.status)).length,
    devicesUnderMaintenance: devices.filter((item) => item.status === "under_maintenance").length,
    dispatchedDevices: devices.filter((item) =>
      ["sent_to_service_center", "under_service_center_maintenance"].includes(item.status),
    ).length,
    lowStockParts: parts.filter((item) => item.stockQuantity <= item.minimumStock).length,
    activeDevices: devices.filter((item) => item.status === "active").length,
    completedThisMonth: requests.filter(
      (item) =>
        ["completed", "closed"].includes(item.status) && item.requestedAt.startsWith(month),
    ).length,
  };
}
