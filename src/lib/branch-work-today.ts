import {
  listAllRequestDevices,
  listMaintenanceRequests,
  normalizeLifecycleStatus,
} from "@/lib/branch-store";
import { isDeviceQrPrinted } from "@/lib/device-qr";
import { listDevicesEligibleForPickupOutbound } from "@/lib/pickup-receipt-store";

export type BranchWorkTodayCounts = {
  /** أجهزة في الفرع بانتظار الإرسال (تم الاستلام) */
  readyToSend: number;
  /** جاهزة لنموذج المندوب (بعد بوابة QR) */
  eligibleToSend: number;
  /** في الطريق للفرع من الصيانة */
  returningFromService: number;
  /** بانتظار التسليم للعميل */
  awaitingCustomer: number;
  /** طلبات الفرع النشطة */
  openRequests: number;
  /** أجهزة الفرع النشطة (غير المسلَّمة) */
  activeDevices: number;
};

/** Counters for branch «عمل اليوم» action cards. */
export function getBranchWorkTodayCounts(opsBranchId?: string | null): BranchWorkTodayCounts {
  const branchId = opsBranchId?.trim() || null;
  const requests = listMaintenanceRequests(branchId ?? undefined);
  const devices = listAllRequestDevices().filter((item) =>
    branchId ? item.request.opsBranchId === branchId : true,
  );

  let readyToSend = 0;
  let returningFromService = 0;
  let awaitingCustomer = 0;
  let activeDevices = 0;

  for (const { device } of devices) {
    const status = normalizeLifecycleStatus(device.lifecycleStatus);
    if (status !== "delivered_to_customer") activeDevices += 1;
    if (
      status === "received_at_branch" ||
      status === "excluded_from_shipment" ||
      status === "ready_to_send"
    ) {
      readyToSend += 1;
    } else if (status === "in_return_transit") {
      returningFromService += 1;
    } else if (status === "awaiting_customer") {
      awaitingCustomer += 1;
    }
  }

  const eligibleToSend = branchId
    ? listDevicesEligibleForPickupOutbound(branchId).length
    : devices.filter(
        ({ device }) =>
          normalizeLifecycleStatus(device.lifecycleStatus) === "received_at_branch" &&
          isDeviceQrPrinted(device),
      ).length;

  return {
    readyToSend,
    eligibleToSend,
    returningFromService,
    awaitingCustomer,
    openRequests: requests.length,
    activeDevices,
  };
}
