import {
  DEVICE_STATUS_LABELS,
  listAllRequestDevices,
  listMaintenanceRequests,
} from "@/lib/branch-store";
import { getBrands, getModels } from "@/lib/catalog-store";
import { listOpsBranches } from "@/lib/ops-data";
import { listShippingBatches } from "@/lib/shipping-store";
import { listTechnicianWork } from "@/lib/technician-store";
import { dateInRange, toLocalDateKey } from "@/lib/technician-reports";
import { listManagedUsers } from "@/lib/users-store";
import type { DeviceLifecycleStatus, ShipmentDirection } from "@/types/domain";

/** Shared filter bag for interactive reports. Empty / "all" means no restriction. */
export type ReportFilters = {
  allDates?: boolean;
  dateFrom?: string;
  dateTo?: string;
  brand?: string;
  model?: string;
  color?: string;
  branch?: string;
  lifecycleStatus?: string;
  priority?: "" | "urgent" | "normal";
  customerName?: string;
  requestNumber?: string;
  mobile?: string;
  urgency?: "" | "urgent" | "normal";
  currentStatus?: string;
  direction?: "" | Extract<ShipmentDirection, "to_service" | "return">;
  carrier?: string;
  technician?: string;
  partName?: string;
  movementType?: "" | "receive" | "consume";
  faultCategory?: string;
  faultKind?: "" | "complaint" | "fault";
};

export const ALL_FILTER_VALUE = "all";

export type ReportFilterOption = { value: string; label: string };

export function isAllFilter(value?: string | null) {
  return !value || value === ALL_FILTER_VALUE;
}

export function emptyReportFilters(): ReportFilters {
  return {
    allDates: true,
    dateFrom: "",
    dateTo: "",
    brand: ALL_FILTER_VALUE,
    model: ALL_FILTER_VALUE,
    color: ALL_FILTER_VALUE,
    branch: ALL_FILTER_VALUE,
    lifecycleStatus: ALL_FILTER_VALUE,
    priority: "",
    customerName: ALL_FILTER_VALUE,
    requestNumber: "",
    mobile: "",
    urgency: "",
    currentStatus: ALL_FILTER_VALUE,
    direction: "",
    carrier: ALL_FILTER_VALUE,
    technician: ALL_FILTER_VALUE,
    partName: ALL_FILTER_VALUE,
    movementType: "",
    faultCategory: ALL_FILTER_VALUE,
    faultKind: "",
  };
}

/** True when date is unrestricted or `iso` falls in [dateFrom, dateTo]. Missing iso fails the range. */
export function matchesDateFilter(iso: string | undefined | null, filters: ReportFilters) {
  if (filters.allDates !== false) return true;
  const from = (filters.dateFrom || "").trim();
  const to = (filters.dateTo || "").trim();
  if (!from && !to) return true;
  if (!iso) return false;
  const fromKey = from || "0000-01-01";
  const toKey = to || "9999-12-31";
  const lo = fromKey <= toKey ? fromKey : toKey;
  const hi = fromKey <= toKey ? toKey : fromKey;
  return dateInRange(iso, lo, hi);
}

export function matchesTextFilter(haystack: string | undefined | null, needle: string | undefined) {
  const q = (needle || "").trim().toLowerCase();
  if (!q || q === ALL_FILTER_VALUE) return true;
  return (haystack || "").toLowerCase().includes(q);
}

export function matchesExactFilter(value: string | undefined | null, selected: string | undefined) {
  if (isAllFilter(selected)) return true;
  return (value || "").trim().toLowerCase() === (selected || "").trim().toLowerCase();
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.map((v) => v.trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "ar"),
  );
}

function withAll(options: ReportFilterOption[], allLabel: string): ReportFilterOption[] {
  return [{ value: ALL_FILTER_VALUE, label: allLabel }, ...options];
}

const PRIMARY_LIFECYCLE: DeviceLifecycleStatus[] = [
  "received_at_branch",
  "in_transit_to_service",
  "awaiting_maintenance",
  "in_maintenance",
  "ready_to_return",
  "awaiting_manager_decision",
  "in_return_transit",
  "awaiting_customer",
  "delivered_to_customer",
  "excluded_from_shipment",
];

export function reportBrandOptions(allLabel: string): ReportFilterOption[] {
  const fromCatalog = getBrands().map((b) => b.name);
  const fromDevices = listAllRequestDevices().map(({ device }) => device.brandName || "");
  return withAll(
    uniqueSorted([...fromCatalog, ...fromDevices]).map((name) => ({ value: name, label: name })),
    allLabel,
  );
}

export function reportModelOptions(allLabel: string, brand?: string): ReportFilterOption[] {
  const brandFilter = isAllFilter(brand) ? "" : (brand || "").trim().toLowerCase();
  const brands = getBrands();
  const brandId = brandFilter
    ? brands.find((b) => b.name.trim().toLowerCase() === brandFilter)?.id
    : undefined;

  const fromCatalog = getModels()
    .filter((m) => !brandId || m.brandId === brandId)
    .map((m) => m.name);
  const fromDevices = listAllRequestDevices()
    .filter(
      ({ device }) =>
        !brandFilter || (device.brandName || "").trim().toLowerCase() === brandFilter,
    )
    .map(({ device }) => device.modelName || "");

  return withAll(
    uniqueSorted([...fromCatalog, ...fromDevices]).map((name) => ({ value: name, label: name })),
    allLabel,
  );
}

export function reportColorOptions(allLabel: string): ReportFilterOption[] {
  const fromDevices = listAllRequestDevices().map(({ device }) => device.color || "");
  const fromCatalog = getModels().flatMap((model) => model.colors ?? (model.color ? [model.color] : []));
  return withAll(
    uniqueSorted([...fromDevices, ...fromCatalog]).map((name) => ({ value: name, label: name })),
    allLabel,
  );
}

export function reportBranchOptions(allLabel: string, opsBranchId?: string | null): ReportFilterOption[] {
  if (opsBranchId) {
    const scoped = listMaintenanceRequests(opsBranchId)
      .map((r) => r.opsBranchName || "")
      .filter(Boolean);
    const names = uniqueSorted(scoped);
    return withAll(
      names.map((name) => ({ value: name, label: name })),
      allLabel,
    );
  }
  const fromOps = listOpsBranches("ar").map((b) => b.name);
  const fromRequests = listMaintenanceRequests().map((r) => r.opsBranchName || "");
  return withAll(
    uniqueSorted([...fromOps, ...fromRequests]).map((name) => ({ value: name, label: name })),
    allLabel,
  );
}

export function reportLifecycleOptions(allLabel: string): ReportFilterOption[] {
  return withAll(
    PRIMARY_LIFECYCLE.map((status) => ({
      value: status,
      label: DEVICE_STATUS_LABELS[status] ?? status,
    })),
    allLabel,
  );
}

export function reportCustomerNameOptions(
  allLabel: string,
  opsBranchId?: string | null,
): ReportFilterOption[] {
  const names = listMaintenanceRequests(opsBranchId).map((r) => r.contactName || "");
  return withAll(
    uniqueSorted(names).map((name) => ({ value: name, label: name })),
    allLabel,
  );
}

export function reportCarrierOptions(allLabel: string, opsBranchId?: string | null): ReportFilterOption[] {
  const carriers = listShippingBatches(opsBranchId).map((b) => b.carrier || "");
  return withAll(
    uniqueSorted(carriers).map((name) => ({ value: name, label: name })),
    allLabel,
  );
}

export function reportTechnicianOptions(allLabel: string): ReportFilterOption[] {
  const fromUsers = listManagedUsers()
    .filter((u) => u.role === "technician" || u.role === "mobile_technician")
    .map((u) => u.fullName || u.username || "");
  const fromWork = listTechnicianWork().map((w) => w.technicianName || "");
  return withAll(
    uniqueSorted([...fromUsers, ...fromWork]).map((name) => ({ value: name, label: name })),
    allLabel,
  );
}

export function reportPartNameOptions(allLabel: string): ReportFilterOption[] {
  const fromWork = listTechnicianWork().flatMap(
    (w) => w.sparePartsUsed?.map((p) => p.partName) ?? [],
  );
  const fromModels = getModels().flatMap((m) => m.spareParts?.map((p) => p.name) ?? []);
  return withAll(
    uniqueSorted([...fromWork, ...fromModels]).map((name) => ({ value: name, label: name })),
    allLabel,
  );
}

export function reportFaultCategoryOptions(
  allLabel: string,
  opsBranchId?: string | null,
): ReportFilterOption[] {
  const work = listTechnicianWork();
  const labels: string[] = [];
  for (const { request, device } of listAllRequestDevices()) {
    if (opsBranchId && request.opsBranchId !== opsBranchId) continue;
    if (device.fault?.trim()) labels.push(device.fault.trim());
    const latest = work
      .filter((item) => item.requestId === request.id && item.deviceLocalId === device.localId)
      .sort((a, b) =>
        (b.finishedAt ?? b.startedAt).localeCompare(a.finishedAt ?? a.startedAt),
      )[0];
    if (latest?.faultCause?.trim()) labels.push(latest.faultCause.trim());
  }
  return withAll(
    uniqueSorted(labels).map((name) => ({ value: name, label: name })),
    allLabel,
  );
}

export function reportRequestStatusOptions(
  allLabel: string,
  statuses: string[],
): ReportFilterOption[] {
  return withAll(
    uniqueSorted(statuses).map((name) => ({ value: name, label: name })),
    allLabel,
  );
}

export function todayFilterDate() {
  return toLocalDateKey(new Date());
}
