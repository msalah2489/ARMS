import {
  deviceLocationLabel,
  deviceStatusLabel,
  listAllRequestDevices,
  listMaintenanceRequests,
  locationForLifecycleStatus,
  normalizeLifecycleStatus,
} from "@/lib/branch-store";
import { getBrands, getDeviceTypes, getModelById } from "@/lib/catalog-store";
import { listShippingBatches } from "@/lib/shipping-store";
import { listStockMovements } from "@/lib/spare-inventory-store";
import { listTechnicianWork } from "@/lib/technician-store";
import type {
  DeviceLifecycleStatus,
  DraftRequestDevice,
  MaintenanceRequestRecord,
  ShippingBatch,
  TechnicianWorkRecord,
} from "@/types/domain";

export type MaintenanceRequestReportRow = {
  requestNumber: string;
  customerName: string;
  mobile: string;
  branch: string;
  deviceCount: number;
  urgency: "urgent" | "normal";
  currentStatus: string;
  statusDate: string;
};

export type DeviceReportRow = {
  deviceCode: string;
  deviceType: string;
  brand: string;
  model: string;
  serial: string;
  requestNumber: string;
  customer: string;
  branch: string;
  fault: string;
  currentLocation: string;
  urgency: "urgent" | "normal";
  requestCreatedAt: string;
  sentToServiceAt: string;
  deliveredToCustomerAt: string;
  lifecycleStatus: DeviceLifecycleStatus;
};

export type SpareConsumeReportRow = {
  date: string;
  technician: string;
  deviceName: string;
  color: string;
  partName: string;
  qty: number;
};

export type SpareStockMovementReportRow = {
  date: string;
  partType: string;
  brand: string;
  deviceType: string;
  movementType: "receive" | "consume";
  qty: number;
  receiptNumber: string;
};

export type FaultAnalysisBucket = {
  label: string;
  count: number;
  device: string;
};

export type FaultAnalysisReport = {
  complaints: FaultAnalysisBucket[];
  faults: FaultAnalysisBucket[];
};

const SENT_PATH_STATUSES = new Set<DeviceLifecycleStatus>([
  "in_transit_to_service",
  "awaiting_maintenance",
  "in_maintenance",
  "ready_to_return",
  "awaiting_manager_decision",
  "in_return_transit",
]);

function deviceDisplayName(device: DraftRequestDevice) {
  return [device.deviceTypeName, device.brandName, device.modelName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" · ") || device.deviceCode;
}

function latestWorkForDevice(
  work: TechnicianWorkRecord[],
  requestId: string,
  deviceLocalId: string,
) {
  return work
    .filter((item) => item.requestId === requestId && item.deviceLocalId === deviceLocalId)
    .sort((a, b) =>
      (b.finishedAt ?? b.startedAt).localeCompare(a.finishedAt ?? a.startedAt),
    )[0];
}

function batchesForDevice(batches: ShippingBatch[], device: DraftRequestDevice) {
  return batches.filter((batch) =>
    batch.items.some(
      (item) =>
        item.requestDeviceId === device.localId || item.deviceCode === device.deviceCode,
    ),
  );
}

function batchItemForDevice(batch: ShippingBatch, device: DraftRequestDevice) {
  return batch.items.find(
    (item) =>
      item.requestDeviceId === device.localId || item.deviceCode === device.deviceCode,
  );
}

function sentToServiceDate(batches: ShippingBatch[], device: DraftRequestDevice) {
  const outbound = batchesForDevice(batches, device)
    .filter((batch) => batch.direction === "to_service")
    .sort((a, b) =>
      (a.handedToCarrierAt ?? a.createdAt).localeCompare(b.handedToCarrierAt ?? b.createdAt),
    );
  const first = outbound[0];
  if (!first) return "";
  return first.handedToCarrierAt ?? first.createdAt;
}

function deliveredToCustomerDate(
  batches: ShippingBatch[],
  device: DraftRequestDevice,
  work: TechnicianWorkRecord | undefined,
) {
  const status = normalizeLifecycleStatus(device.lifecycleStatus);
  if (status !== "delivered_to_customer" && status !== "closed") return "";

  const returns = batchesForDevice(batches, device)
    .filter((batch) => batch.direction === "return")
    .sort((a, b) => (b.receivedAt ?? b.createdAt).localeCompare(a.receivedAt ?? a.createdAt));

  for (const batch of returns) {
    const item = batchItemForDevice(batch, device);
    if (item?.branchReceivedAt) return item.branchReceivedAt;
    if (batch.receivedAt) return batch.receivedAt;
  }

  return work?.finishedAt ?? "";
}

function currentStatusDate(input: {
  request: MaintenanceRequestRecord;
  device: DraftRequestDevice;
  batches: ShippingBatch[];
  work: TechnicianWorkRecord | undefined;
}) {
  const { request, device, batches, work } = input;
  const status = normalizeLifecycleStatus(device.lifecycleStatus);
  const related = batchesForDevice(batches, device);

  switch (status) {
    case "received_at_branch":
      return request.receivedAt;
    case "excluded_from_shipment": {
      const removed = related
        .flatMap((batch) => batch.items)
        .filter(
          (item) =>
            (item.requestDeviceId === device.localId || item.deviceCode === device.deviceCode) &&
            item.removedAt,
        )
        .sort((a, b) => String(b.removedAt).localeCompare(String(a.removedAt)))[0];
      return removed?.removedAt ?? request.receivedAt;
    }
    case "in_transit_to_service": {
      const batch = related
        .filter((item) => item.direction === "to_service")
        .sort((a, b) =>
          (b.handedToCarrierAt ?? b.createdAt).localeCompare(a.handedToCarrierAt ?? a.createdAt),
        )[0];
      return batch?.handedToCarrierAt ?? batch?.createdAt ?? request.receivedAt;
    }
    case "awaiting_maintenance": {
      const batch = related
        .filter((item) => item.direction === "to_service")
        .sort((a, b) =>
          String(b.receivedAt ?? b.createdAt).localeCompare(String(a.receivedAt ?? a.createdAt)),
        )[0];
      return batch?.receivedAt ?? batch?.handedToCarrierAt ?? request.receivedAt;
    }
    case "in_maintenance":
      return work?.startedAt ?? request.receivedAt;
    case "ready_to_return":
    case "awaiting_manager_decision":
      return work?.finishedAt ?? work?.startedAt ?? request.receivedAt;
    case "in_return_transit": {
      const batch = related
        .filter((item) => item.direction === "return")
        .sort((a, b) =>
          (b.handedToCarrierAt ?? b.createdAt).localeCompare(a.handedToCarrierAt ?? a.createdAt),
        )[0];
      return batch?.handedToCarrierAt ?? batch?.createdAt ?? request.receivedAt;
    }
    case "awaiting_customer": {
      for (const batch of related
        .filter((item) => item.direction === "return")
        .sort((a, b) =>
          String(b.receivedAt ?? b.createdAt).localeCompare(String(a.receivedAt ?? a.createdAt)),
        )) {
        const item = batchItemForDevice(batch, device);
        if (item?.branchReceivedAt) return item.branchReceivedAt;
        if (batch.receivedAt) return batch.receivedAt;
      }
      return request.receivedAt;
    }
    case "delivered_to_customer":
    case "closed":
      return (
        deliveredToCustomerDate(batches, device, work) ||
        work?.finishedAt ||
        request.receivedAt
      );
    default:
      return request.receivedAt;
  }
}

function summarizeRequestStatus(
  request: MaintenanceRequestRecord,
  batches: ShippingBatch[],
  work: TechnicianWorkRecord[],
) {
  if (!request.devices.length) {
    return { label: "—", date: request.receivedAt };
  }

  const ranked = request.devices
    .map((device) => {
      const status = normalizeLifecycleStatus(device.lifecycleStatus);
      const latest = latestWorkForDevice(work, request.id, device.localId);
      return {
        status,
        label: deviceStatusLabel(status),
        date: currentStatusDate({ request, device, batches, work: latest }),
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  const uniqueLabels = [...new Set(ranked.map((item) => item.label))];
  return {
    label: uniqueLabels.join(" · "),
    date: ranked[0]?.date ?? request.receivedAt,
  };
}

function buildDeviceRow(
  request: MaintenanceRequestRecord,
  device: DraftRequestDevice,
  batches: ShippingBatch[],
  work: TechnicianWorkRecord[],
): DeviceReportRow {
  const latest = latestWorkForDevice(work, request.id, device.localId);
  const status = normalizeLifecycleStatus(device.lifecycleStatus);
  return {
    deviceCode: device.deviceCode,
    deviceType: device.deviceTypeName || "—",
    brand: device.brandName || "—",
    model: device.modelName || "—",
    serial: device.serialNumber || "—",
    requestNumber: request.requestNumber,
    customer: request.contactName || "—",
    branch: request.opsBranchName || "—",
    fault: device.fault?.trim() || request.generalNotes?.trim() || "—",
    currentLocation: deviceLocationLabel(
      device.currentLocation || locationForLifecycleStatus(status),
    ),
    urgency: request.priority === "urgent" ? "urgent" : "normal",
    requestCreatedAt: request.receivedAt,
    sentToServiceAt: sentToServiceDate(batches, device),
    deliveredToCustomerAt: deliveredToCustomerDate(batches, device, latest),
    lifecycleStatus: status,
  };
}

/** Excluded / failed / unable / scrapped — lifecycle + technician outcomes. */
export function isExcludedOrFailedDevice(
  request: MaintenanceRequestRecord,
  device: DraftRequestDevice,
  work: TechnicianWorkRecord[],
) {
  const status = normalizeLifecycleStatus(device.lifecycleStatus);
  if (status === "excluded_from_shipment" || status === "closed") return true;

  const latest = latestWorkForDevice(work, request.id, device.localId);
  if (!latest) return false;

  if (latest.outcome === "not_repairable") return true;
  if (
    latest.status === "held" &&
    (latest.holdReason === "unrepairable_fault" || latest.holdReason === "fully_damaged")
  ) {
    return true;
  }
  if (
    status === "awaiting_manager_decision" &&
    (latest.outcome === "issue_persists" ||
      latest.holdReason === "unrepairable_fault" ||
      latest.holdReason === "fully_damaged")
  ) {
    return true;
  }
  return false;
}

export function isSentPathDevice(status: string | null | undefined) {
  return SENT_PATH_STATUSES.has(normalizeLifecycleStatus(status));
}

function scopedRequests(opsBranchId?: string | null) {
  return listMaintenanceRequests(opsBranchId);
}

export function buildMaintenanceRequestReport(
  opsBranchId?: string | null,
): MaintenanceRequestReportRow[] {
  const batches = listShippingBatches(opsBranchId);
  const work = listTechnicianWork();
  return scopedRequests(opsBranchId)
    .map((request) => {
      const summary = summarizeRequestStatus(request, batches, work);
      return {
        requestNumber: request.requestNumber,
        customerName: request.contactName || "—",
        mobile: request.customerMobile || "—",
        branch: request.opsBranchName || "—",
        deviceCount: request.devices.length,
        urgency: request.priority === "urgent" ? "urgent" : "normal",
        currentStatus: summary.label,
        statusDate: summary.date,
      } satisfies MaintenanceRequestReportRow;
    })
    .sort((a, b) => b.statusDate.localeCompare(a.statusDate));
}

export function buildDevicesReport(opsBranchId?: string | null): DeviceReportRow[] {
  const batches = listShippingBatches(opsBranchId);
  const work = listTechnicianWork();
  return listAllRequestDevices()
    .filter(({ request }) => !opsBranchId || request.opsBranchId === opsBranchId)
    .map(({ request, device }) => buildDeviceRow(request, device, batches, work))
    .sort((a, b) => a.deviceCode.localeCompare(b.deviceCode, "ar"));
}

export function buildSentDevicesReport(opsBranchId?: string | null): DeviceReportRow[] {
  return buildDevicesReport(opsBranchId).filter((row) => isSentPathDevice(row.lifecycleStatus));
}

export function buildExcludedDevicesReport(opsBranchId?: string | null): DeviceReportRow[] {
  const batches = listShippingBatches(opsBranchId);
  const work = listTechnicianWork();
  return listAllRequestDevices()
    .filter(({ request, device }) => {
      if (opsBranchId && request.opsBranchId !== opsBranchId) return false;
      return isExcludedOrFailedDevice(request, device, work);
    })
    .map(({ request, device }) => buildDeviceRow(request, device, batches, work))
    .sort((a, b) => a.deviceCode.localeCompare(b.deviceCode, "ar"));
}

function consumeLinesFromWork(opsBranchId?: string | null): SpareConsumeReportRow[] {
  const deviceIndex = new Map(
    listAllRequestDevices().map(({ request, device }) => [
      `${request.id}::${device.localId}`,
      { request, device },
    ]),
  );

  const rows: SpareConsumeReportRow[] = [];
  for (const record of listTechnicianWork()) {
    const match = deviceIndex.get(`${record.requestId}::${record.deviceLocalId}`);
    if (opsBranchId && match && match.request.opsBranchId !== opsBranchId) continue;
    if (!record.sparePartsUsed?.length) continue;

    const deviceName = match
      ? deviceDisplayName(match.device)
      : record.deviceCode;
    const date = record.finishedAt ?? record.startedAt;

    for (const part of record.sparePartsUsed) {
      if (!part.qty || part.qty <= 0) continue;
      rows.push({
        date,
        technician: record.technicianName || "—",
        deviceName,
        color: part.color?.trim() || match?.device.color?.trim() || "—",
        partName: part.partName,
        qty: part.qty,
      });
    }
  }
  return rows;
}

function consumeLinesFromMovements(): SpareConsumeReportRow[] {
  return listStockMovements()
    .filter((item) => item.type === "consume")
    .map((item) => ({
      date: item.createdAt,
      technician: item.actorName || "—",
      deviceName: item.modelName || "—",
      color: item.color?.trim() || "—",
      partName: item.partName,
      qty: item.quantity,
    }));
}

/** Detail consumption rows (work records preferred; movements fill gaps). */
export function buildSpareConsumeDetailReport(
  opsBranchId?: string | null,
): SpareConsumeReportRow[] {
  const fromWork = consumeLinesFromWork(opsBranchId);
  if (fromWork.length) {
    return fromWork.sort((a, b) => b.date.localeCompare(a.date));
  }
  // Movements are global; branch filter cannot apply without request linkage.
  if (opsBranchId) return [];
  return consumeLinesFromMovements().sort((a, b) => b.date.localeCompare(a.date));
}

/** Totals by technician + part (+ device + color). */
export function buildSpareConsumeByTechnicianReport(
  opsBranchId?: string | null,
): SpareConsumeReportRow[] {
  const map = new Map<string, SpareConsumeReportRow>();
  for (const row of buildSpareConsumeDetailReport(opsBranchId)) {
    const key = [
      row.technician.trim().toLowerCase(),
      row.partName.trim().toLowerCase(),
      row.deviceName.trim().toLowerCase(),
      row.color.trim().toLowerCase(),
    ].join("::");
    const existing = map.get(key);
    if (existing) {
      existing.qty += row.qty;
      if (row.date > existing.date) existing.date = row.date;
    } else {
      map.set(key, { ...row });
    }
  }
  return [...map.values()].sort(
    (a, b) =>
      a.technician.localeCompare(b.technician, "ar") ||
      b.qty - a.qty ||
      a.partName.localeCompare(b.partName, "ar"),
  );
}

export function buildSpareStockMovementReport(): SpareStockMovementReportRow[] {
  const brands = getBrands();
  const types = getDeviceTypes();

  return listStockMovements()
    .map((item) => {
      const model = getModelById(item.modelId);
      const brand =
        brands.find((row) => row.id === model?.brandId)?.name ??
        model?.name?.split(" ")[0] ??
        "—";
      const deviceType =
        types.find((row) => row.id === model?.deviceTypeId)?.name ?? "—";
      return {
        date: item.createdAt,
        partType: item.partName,
        brand,
        deviceType,
        movementType: item.type,
        qty: item.quantity,
        receiptNumber: item.type === "receive" ? item.reference?.trim() || "—" : "",
      } satisfies SpareStockMovementReportRow;
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

function bumpBucket(
  map: Map<string, FaultAnalysisBucket>,
  label: string,
  device: string,
) {
  const key = label.trim().toLowerCase() || "—";
  const existing = map.get(key);
  if (existing) {
    existing.count += 1;
    if (!existing.device.includes(device)) {
      existing.device = `${existing.device} · ${device}`;
    }
  } else {
    map.set(key, { label: label.trim() || "—", count: 1, device });
  }
}

export function buildFaultAnalysisReport(opsBranchId?: string | null): FaultAnalysisReport {
  const complaints = new Map<string, FaultAnalysisBucket>();
  const faults = new Map<string, FaultAnalysisBucket>();
  const work = listTechnicianWork();

  for (const { request, device } of listAllRequestDevices()) {
    if (opsBranchId && request.opsBranchId !== opsBranchId) continue;
    const deviceLabel = deviceDisplayName(device);
    const complaint = device.fault?.trim();
    if (complaint) bumpBucket(complaints, complaint, deviceLabel);

    const latest = latestWorkForDevice(work, request.id, device.localId);
    const cause = latest?.faultCause?.trim();
    if (cause) bumpBucket(faults, cause, deviceLabel);
  }

  const sortBuckets = (rows: FaultAnalysisBucket[]) =>
    rows.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "ar"));

  return {
    complaints: sortBuckets([...complaints.values()]),
    faults: sortBuckets([...faults.values()]),
  };
}
