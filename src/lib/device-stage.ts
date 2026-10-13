/**
 * Shared stage-start dating for SLA delay alerts and unified timelines.
 * Derives timestamps from existing request / shipping / work fields (no schema change).
 */
import { normalizeLifecycleStatus } from "@/lib/branch-store";
import type {
  DeviceLifecycleStatus,
  DraftRequestDevice,
  MaintenanceRequestRecord,
  ShippingBatch,
  TechnicianWorkRecord,
} from "@/types/domain";

export const TERMINAL_LIFECYCLE_STATUSES = new Set<DeviceLifecycleStatus>([
  "delivered_to_customer",
  "closed",
]);

export function latestWorkForDevice(
  work: TechnicianWorkRecord[],
  requestId: string,
  deviceLocalId: string,
): TechnicianWorkRecord | undefined {
  return work
    .filter((item) => item.requestId === requestId && item.deviceLocalId === deviceLocalId)
    .sort((a, b) =>
      (b.finishedAt ?? b.startedAt).localeCompare(a.finishedAt ?? a.startedAt),
    )[0];
}

export function batchesForDevice(
  batches: ShippingBatch[],
  device: DraftRequestDevice,
): ShippingBatch[] {
  return batches.filter((batch) =>
    batch.items.some(
      (item) =>
        item.requestDeviceId === device.localId || item.deviceCode === device.deviceCode,
    ),
  );
}

export function batchItemForDevice(batch: ShippingBatch, device: DraftRequestDevice) {
  return batch.items.find(
    (item) =>
      item.requestDeviceId === device.localId || item.deviceCode === device.deviceCode,
  );
}

/** ISO timestamp when the device entered its current lifecycle stage (best-effort). */
export function getDeviceStageStartedAt(input: {
  request: MaintenanceRequestRecord;
  device: DraftRequestDevice;
  batches: ShippingBatch[];
  work: TechnicianWorkRecord | undefined;
}): string {
  const { request, device, batches, work } = input;
  const status = normalizeLifecycleStatus(device.lifecycleStatus);
  const related = batchesForDevice(batches, device);

  switch (status) {
    case "received_at_branch":
    case "ready_to_send":
      return request.receivedAt;
    case "excluded_from_shipment":
    case "excluded": {
      const removed = related
        .flatMap((batch) => batch.items)
        .filter(
          (item) =>
            (item.requestDeviceId === device.localId ||
              item.deviceCode === device.deviceCode) &&
            item.removedAt,
        )
        .sort((a, b) => String(b.removedAt).localeCompare(String(a.removedAt)))[0];
      return removed?.removedAt ?? request.receivedAt;
    }
    case "in_transit_to_service":
    case "handed_to_carrier":
    case "in_shipping": {
      const batch = related
        .filter((item) => item.direction === "to_service")
        .sort((a, b) =>
          (b.handedToCarrierAt ?? b.createdAt).localeCompare(
            a.handedToCarrierAt ?? a.createdAt,
          ),
        )[0];
      return batch?.handedToCarrierAt ?? batch?.createdAt ?? request.receivedAt;
    }
    case "awaiting_maintenance":
    case "at_service_center":
    case "received_at_warehouse": {
      const batch = related
        .filter((item) => item.direction === "to_service")
        .sort((a, b) =>
          String(b.receivedAt ?? b.createdAt).localeCompare(
            String(a.receivedAt ?? a.createdAt),
          ),
        )[0];
      return batch?.receivedAt ?? batch?.handedToCarrierAt ?? request.receivedAt;
    }
    case "in_maintenance":
    case "in_maintenance_at_branch":
    case "under_maintenance":
      return (
        device.maintenanceStartedAt ??
        work?.startedAt ??
        request.receivedAt
      );
    case "ready_to_return":
    case "awaiting_manager_decision":
    case "maintenance_failed":
      return (
        device.maintenanceFinishedAt ??
        work?.finishedAt ??
        work?.startedAt ??
        request.receivedAt
      );
    case "in_return_transit":
    case "returning_from_service": {
      const batch = related
        .filter((item) => item.direction === "return")
        .sort((a, b) =>
          (b.handedToCarrierAt ?? b.createdAt).localeCompare(
            a.handedToCarrierAt ?? a.createdAt,
          ),
        )[0];
      return batch?.handedToCarrierAt ?? batch?.createdAt ?? request.receivedAt;
    }
    case "awaiting_customer":
    case "awaiting_branch_handover": {
      for (const batch of related
        .filter((item) => item.direction === "return")
        .sort((a, b) =>
          String(b.receivedAt ?? b.createdAt).localeCompare(
            String(a.receivedAt ?? a.createdAt),
          ),
        )) {
        const item = batchItemForDevice(batch, device);
        if (item?.branchReceivedAt) return item.branchReceivedAt;
        if (batch.receivedAt) return batch.receivedAt;
      }
      return (
        device.maintenanceFinishedAt ?? work?.finishedAt ?? request.receivedAt
      );
    }
    case "delivered_to_customer":
    case "closed": {
      for (const batch of related
        .filter((item) => item.direction === "return")
        .sort((a, b) =>
          String(b.receivedAt ?? b.createdAt).localeCompare(
            String(a.receivedAt ?? a.createdAt),
          ),
        )) {
        const item = batchItemForDevice(batch, device);
        if (item?.branchReceivedAt) return item.branchReceivedAt;
        if (batch.receivedAt) return batch.receivedAt;
      }
      return work?.finishedAt ?? request.receivedAt;
    }
    default:
      return request.receivedAt;
  }
}

export function daysBetween(fromIso: string, toMs: number = Date.now()): number {
  const from = Date.parse(fromIso);
  if (!Number.isFinite(from)) return 0;
  const ms = Math.max(0, toMs - from);
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}
