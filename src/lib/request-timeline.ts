/**
 * Unified chronological timeline for a maintenance request (and optionally one device).
 * Built from request / shipping batches / pickup receipts / technician work — no new tables.
 */
import { deviceStatusLabel, normalizeLifecycleStatus } from "@/lib/branch-store";
import { batchesForDevice, batchItemForDevice } from "@/lib/device-stage";
import { listPickupReceipts } from "@/lib/pickup-receipt-store";
import { listShippingBatches } from "@/lib/shipping-store";
import { listTechnicianWork } from "@/lib/technician-store";
import { OUTCOME_LABELS, HOLD_REASON_LABELS } from "@/lib/technician-catalog";
import { requestReturnReasonLabel } from "@/lib/request-return";
import type {
  DraftRequestDevice,
  MaintenanceRequestRecord,
  ShippingBatch,
  TechnicianWorkRecord,
} from "@/types/domain";

export type TimelineEventKind =
  | "request_created"
  | "shipment"
  | "receipt"
  | "work"
  | "status_note"
  | "delivery"
  | "return_link";

export type TimelineEvent = {
  id: string;
  at: string;
  kind: TimelineEventKind;
  title: string;
  detail?: string;
  deviceCode?: string;
  actor?: string;
};

function pushUnique(events: TimelineEvent[], event: TimelineEvent) {
  if (!event.at || !Number.isFinite(Date.parse(event.at))) return;
  if (events.some((e) => e.id === event.id)) return;
  events.push(event);
}

function directionLabel(direction: ShippingBatch["direction"]): string {
  if (direction === "to_service") return "إلى مركز الصيانة";
  if (direction === "return") return "إرجاع للفرع";
  return direction;
}

function collectShippingEvents(
  events: TimelineEvent[],
  request: MaintenanceRequestRecord,
  devices: DraftRequestDevice[],
  batches: ShippingBatch[],
) {
  for (const device of devices) {
    const related = batchesForDevice(batches, device);
    for (const batch of related) {
      const item = batchItemForDevice(batch, device);
      if (!item) continue;

      pushUnique(events, {
        id: `batch-create:${batch.id}:${device.localId}`,
        at: batch.createdAt,
        kind: "shipment",
        title: `إنشاء بوليصة ${batch.batchNumber || batch.shipmentNumber}`,
        detail: `${directionLabel(batch.direction)} · ${batch.carrier || "—"} · ${device.deviceCode}`,
        deviceCode: device.deviceCode,
        actor: batch.createdByName,
      });

      if (batch.handedToCarrierAt) {
        pushUnique(events, {
          id: `batch-hand:${batch.id}:${device.localId}`,
          at: batch.handedToCarrierAt,
          kind: "shipment",
          title: `تسليم لشركة الشحن`,
          detail: `${batch.carrier || "—"} · ${directionLabel(batch.direction)} · ${device.deviceCode}`,
          deviceCode: device.deviceCode,
          actor: batch.handedToCarrierBy ?? undefined,
        });
      }

      if (batch.receivedAt) {
        pushUnique(events, {
          id: `batch-recv:${batch.id}:${device.localId}`,
          at: batch.receivedAt,
          kind: "shipment",
          title:
            batch.direction === "return"
              ? "استلام الإرجاع في الفرع (بوليصة)"
              : "استلام في مركز الصيانة",
          detail: `${batch.batchNumber || batch.shipmentNumber} · ${device.deviceCode}`,
          deviceCode: device.deviceCode,
          actor: batch.receivedByName ?? undefined,
        });
      }

      if (item.removedAt) {
        pushUnique(events, {
          id: `batch-rm:${batch.id}:${item.id}`,
          at: item.removedAt,
          kind: "status_note",
          title: "استبعاد من الشحنة",
          detail: item.removalReason?.trim() || device.deviceCode,
          deviceCode: device.deviceCode,
          actor: item.removedBy ?? undefined,
        });
      }

      if (item.branchReceivedAt) {
        const outcome =
          item.branchReceiveOutcome === "damaged"
            ? "تالف"
            : item.branchReceiveOutcome === "not_received"
              ? "لم يُستلم"
              : "سليم";
        pushUnique(events, {
          id: `branch-recv:${batch.id}:${item.id}`,
          at: item.branchReceivedAt,
          kind: "delivery",
          title: `استلام الفرع للجهاز (${outcome})`,
          detail: item.branchReceiveReason?.trim() || device.deviceCode,
          deviceCode: device.deviceCode,
          actor: item.branchReceivedBy ?? undefined,
        });
      }
    }
  }

  // Also scan batches that reference request devices by request id via pickup receipts later.
  void request;
}

function collectPickupEvents(
  events: TimelineEvent[],
  request: MaintenanceRequestRecord,
  devices: DraftRequestDevice[],
) {
  const deviceIds = new Set(devices.map((d) => d.localId));
  const codes = new Set(devices.map((d) => d.deviceCode));
  const receipts = listPickupReceipts({ opsBranchId: request.opsBranchId });

  for (const receipt of receipts) {
    const lines = receipt.lines.filter(
      (line) =>
        deviceIds.has(line.deviceLocalId) ||
        codes.has(line.deviceCode) ||
        line.requestId === request.id,
    );
    if (!lines.length) continue;

    const deviceCodes = lines.map((l) => l.deviceCode).join("، ");

    pushUnique(events, {
      id: `pickup-create:${receipt.id}`,
      at: receipt.createdAt,
      kind: "receipt",
      title: `نموذج استلام ${receipt.receiptNumber}`,
      detail: `${receipt.direction === "branch_to_center" ? "فرع → مركز" : "مركز → فرع"} · ${deviceCodes}`,
      actor: receipt.createdByName,
    });

    if (receipt.submittedAt) {
      pushUnique(events, {
        id: `pickup-sub:${receipt.id}`,
        at: receipt.submittedAt,
        kind: "receipt",
        title: "إرسال النموذج للمندوب",
        detail: receipt.assignedCourierName || undefined,
        actor: receipt.createdByName,
      });
    }

    if (receipt.courierReviewedAt) {
      pushUnique(events, {
        id: `pickup-rev:${receipt.id}`,
        at: receipt.courierReviewedAt,
        kind: "receipt",
        title: "مراجعة المندوب",
        detail: receipt.status,
        actor: receipt.courierReviewedByName ?? receipt.assignedCourierName,
      });
    }

    if (receipt.handoverRequestedAt) {
      pushUnique(events, {
        id: `pickup-ho-req:${receipt.id}`,
        at: receipt.handoverRequestedAt,
        kind: "receipt",
        title: "طلب تسليم للصيانة",
        actor: receipt.handoverRequestedByName ?? undefined,
      });
    }

    if (receipt.handoverApprovedAt) {
      pushUnique(events, {
        id: `pickup-ho-ok:${receipt.id}`,
        at: receipt.handoverApprovedAt,
        kind: "receipt",
        title: "اعتماد تسليم المندوب",
        actor: receipt.handoverApprovedByName ?? undefined,
      });
    }

    if (receipt.branchReceivedAt) {
      pushUnique(events, {
        id: `pickup-branch:${receipt.id}`,
        at: receipt.branchReceivedAt,
        kind: "delivery",
        title: "تأكيد استلام الفرع (نموذج)",
        detail: deviceCodes,
        actor: receipt.branchReceivedByName ?? undefined,
      });
    }
  }
}

function collectWorkEvents(
  events: TimelineEvent[],
  request: MaintenanceRequestRecord,
  devices: DraftRequestDevice[],
  work: TechnicianWorkRecord[],
) {
  const deviceIds = new Set(devices.map((d) => d.localId));
  for (const record of work) {
    if (record.requestId !== request.id && !deviceIds.has(record.deviceLocalId)) {
      continue;
    }
    if (record.requestId !== request.id) continue;

    pushUnique(events, {
      id: `work-start:${record.id}`,
      at: record.startedAt,
      kind: "work",
      title: "بدء أعمال الصيانة",
      detail: record.deviceCode,
      deviceCode: record.deviceCode,
      actor: record.technicianName,
    });

    if (record.finishedAt) {
      let result = "";
      if (record.status === "held" && record.holdReason) {
        result =
          HOLD_REASON_LABELS[record.holdReason] ??
          record.holdReason;
      } else if (record.outcome) {
        result = OUTCOME_LABELS[record.outcome] ?? record.outcome;
      } else if (record.status === "completed") {
        result = "مكتمل";
      }
      pushUnique(events, {
        id: `work-end:${record.id}`,
        at: record.finishedAt,
        kind: "work",
        title: record.status === "held" ? "تعليق / استبعاد" : "إنهاء الصيانة",
        detail: [result, record.faultCause?.trim()].filter(Boolean).join(" — ") || record.deviceCode,
        deviceCode: record.deviceCode,
        actor: record.technicianName,
      });
    }
  }

  for (const device of devices) {
    if (device.maintenanceStartedAt) {
      pushUnique(events, {
        id: `dev-start:${device.localId}`,
        at: device.maintenanceStartedAt,
        kind: "work",
        title: "تسجيل بدء صيانة الجهاز",
        detail: device.deviceCode,
        deviceCode: device.deviceCode,
        actor: device.assignedTechnicianName ?? undefined,
      });
    }
    if (device.maintenanceFinishedAt) {
      pushUnique(events, {
        id: `dev-end:${device.localId}`,
        at: device.maintenanceFinishedAt,
        kind: "work",
        title: "تسجيل انتهاء صيانة الجهاز",
        detail: `${device.deviceCode} · ${deviceStatusLabel(normalizeLifecycleStatus(device.lifecycleStatus), "technician")}`,
        deviceCode: device.deviceCode,
      });
    }
    if (device.qrPrintedAt) {
      pushUnique(events, {
        id: `qr:${device.localId}`,
        at: device.qrPrintedAt,
        kind: "status_note",
        title: "طباعة ملصق QR",
        detail: device.deviceCode,
        deviceCode: device.deviceCode,
      });
    }
  }
}

/**
 * Build a sorted timeline for a request. Pass `deviceLocalId` to focus on one device
 * while still showing request-level events.
 */
export function buildRequestTimeline(
  request: MaintenanceRequestRecord,
  options?: { deviceLocalId?: string },
): TimelineEvent[] {
  const devices = options?.deviceLocalId
    ? request.devices.filter((d) => d.localId === options.deviceLocalId)
    : request.devices;

  const events: TimelineEvent[] = [];
  const batches = listShippingBatches();
  const work = listTechnicianWork();

  pushUnique(events, {
    id: `req:${request.id}`,
    at: request.receivedAt,
    kind: "request_created",
    title: "استلام طلب الصيانة",
    detail: `${request.requestNumber} · ${request.contactName} · ${devices.length} جهاز`,
    actor: request.branchStaffName,
  });

  for (const link of request.linkEvents ?? []) {
    const reason = requestReturnReasonLabel(
      link.reason,
      link.kind === "reopened" ? "reopen" : "follow_up",
    );
    const notePart = link.note?.trim() ? ` · ${link.note.trim()}` : "";
    const related =
      link.relatedRequestNumber || link.relatedRequestId
        ? ` · ${link.relatedRequestNumber || link.relatedRequestId}`
        : "";
    let title = "حدث ربط / إرجاع";
    if (link.kind === "follow_up_created") title = "إنشاء طلب متابعة مرتبط";
    else if (link.kind === "follow_up_linked") title = "ربط طلب متابعة لاحق";
    else if (link.kind === "reopened") title = "إعادة فتح الطلب";
    pushUnique(events, {
      id: `link:${link.id}`,
      at: link.at,
      kind: "return_link",
      title,
      detail: `${reason}${related}${notePart}`,
      actor: link.actorName,
    });
  }

  collectShippingEvents(events, request, devices, batches);
  collectPickupEvents(events, request, devices);
  collectWorkEvents(events, request, devices, work);

  return events.sort((a, b) => {
    const cmp = a.at.localeCompare(b.at);
    if (cmp !== 0) return cmp;
    return a.id.localeCompare(b.id);
  });
}
