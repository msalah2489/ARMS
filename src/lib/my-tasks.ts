/**
 * Role-aware «مهامي اليوم» work queue — actionable items for the signed-in user.
 */
import {
  isBranchRole,
  isMaintenanceManagerRole,
  isPickupCourierRole,
  isSystemAdminRole,
  isTechnicianRole,
  normalizeRole,
} from "@/lib/auth";
import {
  getBranchDailyWorkQueues,
  listNeedMaintenanceDecision,
  listNeedReceiveAtService,
  listReadyToReturnToBranches,
  type BranchSendToServiceItem,
} from "@/lib/dashboard-work-queues";
import { listDelayAlertsForUser, type DelayAlertItem } from "@/lib/delay-alerts";
import {
  PICKUP_RECEIPT_STATUS_LABELS,
  listPickupReceipts,
} from "@/lib/pickup-receipt-store";
import {
  getEligibleQueueForTechnician,
  listTechnicianWork,
} from "@/lib/technician-store";
import { deviceStatusLabel, normalizeLifecycleStatus } from "@/lib/branch-store";
import type { Profile } from "@/types/domain";

export type MyTaskItem = {
  id: string;
  group: string;
  title: string;
  subtitle: string;
  href: string;
  badge?: string;
  urgent?: boolean;
  overdue?: boolean;
};

export type MyTasksResult = {
  groups: Array<{ key: string; label: string; items: MyTaskItem[] }>;
  total: number;
  overdueCount: number;
};

function sendSublabelAr(sub: BranchSendToServiceItem["sendSublabel"]): string {
  switch (sub) {
    case "awaiting_waybill":
      return "بانتظار بوليصة شحن";
    case "awaiting_carrier":
      return "بانتظار شركة الشحن";
    case "awaiting_courier":
      return "بانتظار المندوب";
    default:
      return "";
  }
}

function overdueIds(user: Profile): Set<string> {
  return new Set(
    listDelayAlertsForUser(user)
      .map((a) => a.deviceLocalId)
      .filter(Boolean) as string[],
  );
}

function mapOverdueAsTasks(alerts: DelayAlertItem[]): MyTaskItem[] {
  return alerts.slice(0, 20).map((a) => ({
    id: `overdue:${a.id}`,
    group: "overdue",
    title: a.title,
    subtitle: `${a.statusLabel} · متأخر ${a.daysOverdue} يوم · ${a.subtitle}`,
    href: a.href,
    badge: "متأخر",
    urgent: a.priority === "urgent",
    overdue: true,
  }));
}

function branchTasks(user: Profile): MyTasksResult {
  const branchId = user.opsBranchId ?? "";
  const queues = branchId
    ? getBranchDailyWorkQueues(branchId)
    : {
        customersAtBranch: [],
        sendToService: [],
        incomingFromService: [],
        handToMobile: [],
        handToCustomer: [],
      };
  const late = overdueIds(user);
  const groups: MyTasksResult["groups"] = [];

  const pushGroup = (
    key: string,
    label: string,
    items: MyTaskItem[],
  ) => {
    if (items.length) groups.push({ key, label, items });
  };

  pushGroup(
    "hand_customer",
    "تسليم إلى العميل",
    queues.handToCustomer.slice(0, 12).map((item) => ({
      id: `hc:${item.device.localId}`,
      group: "hand_customer",
      title: item.device.deviceCode,
      subtitle: `${item.request.requestNumber} · ${item.request.contactName}`,
      href: `/devices/detail/?id=${encodeURIComponent(item.device.localId)}`,
      badge: "تسليم",
      overdue: late.has(item.device.localId),
      urgent: item.request.priority === "urgent",
    })),
  );

  pushGroup(
    "incoming",
    "استلام الوارد من الصيانة",
    queues.incomingFromService.slice(0, 12).map((item) => ({
      id: `in:${item.device.localId}`,
      group: "incoming",
      title: item.device.deviceCode,
      subtitle: `${item.request.requestNumber} · أكّد الاستلام`,
      href: "/branch/shipping",
      badge: "استلام",
      overdue: late.has(item.device.localId),
    })),
  );

  pushGroup(
    "send",
    "إرسال إلى الصيانة",
    queues.sendToService.slice(0, 12).map((item) => ({
      id: `send:${item.device.localId}`,
      group: "send",
      title: item.device.deviceCode,
      subtitle: `${item.request.requestNumber} · ${sendSublabelAr(item.sendSublabel)}`,
      href: "/branch/shipping",
      badge: sendSublabelAr(item.sendSublabel),
      overdue: late.has(item.device.localId),
      urgent: item.request.priority === "urgent",
    })),
  );

  pushGroup(
    "mobile",
    "تسليم إلى الفني المتنقل",
    queues.handToMobile.slice(0, 12).map((item) => ({
      id: `mob:${item.device.localId}`,
      group: "mobile",
      title: item.device.deviceCode,
      subtitle: `${item.request.requestNumber} · ${item.request.contactName}`,
      href: `/devices/detail/?id=${encodeURIComponent(item.device.localId)}`,
      badge: "فني متنقل",
      overdue: late.has(item.device.localId),
    })),
  );

  pushGroup(
    "customers",
    "أجهزة عملاء بالفرع",
    queues.customersAtBranch.slice(0, 12).map((item) => ({
      id: `cust:${item.device.localId}`,
      group: "customers",
      title: item.device.deviceCode,
      subtitle: `${item.request.requestNumber} · ${deviceStatusLabel(item.device.lifecycleStatus, "technician")}`,
      href: `/devices/detail/?id=${encodeURIComponent(item.device.localId)}`,
      overdue: late.has(item.device.localId),
      urgent: item.request.priority === "urgent",
    })),
  );

  const overdueTasks = mapOverdueAsTasks(listDelayAlertsForUser(user));
  if (overdueTasks.length) {
    groups.unshift({ key: "overdue", label: "متأخر عن المهلة", items: overdueTasks });
  }

  const total = groups.reduce((sum, g) => sum + g.items.length, 0);
  return {
    groups,
    total,
    overdueCount: overdueTasks.length,
  };
}

function technicianTasks(user: Profile): MyTasksResult {
  const late = overdueIds(user);
  const inProgress = listTechnicianWork().filter(
    (w) => w.technicianId === user.id && w.status === "in_progress",
  );
  const waiting = getEligibleQueueForTechnician(user);
  const groups: MyTasksResult["groups"] = [];

  if (inProgress.length) {
    groups.push({
      key: "in_progress",
      label: "قيد العمل لديّ",
      items: inProgress.slice(0, 12).map((w) => ({
        id: `ip:${w.id}`,
        group: "in_progress",
        title: w.deviceCode,
        subtitle: `${w.requestNumber} · أكمل أو علّق العمل`,
        href: "/technician/work",
        badge: "جاري",
        overdue: late.has(w.deviceLocalId),
      })),
    });
  }

  if (waiting.length) {
    groups.push({
      key: "waiting",
      label: "طابور الانتظار",
      items: waiting.slice(0, 16).map((item) => ({
        id: `w:${item.device.localId}`,
        group: "waiting",
        title: item.device.deviceCode,
        subtitle: `${item.request.requestNumber} · ${item.request.opsBranchName}`,
        href: "/technician/work",
        badge: item.request.priority === "urgent" ? "عاجل" : undefined,
        urgent: item.request.priority === "urgent",
        overdue: late.has(item.device.localId),
      })),
    });
  }

  const overdueTasks = mapOverdueAsTasks(listDelayAlertsForUser(user));
  if (overdueTasks.length) {
    groups.unshift({ key: "overdue", label: "متأخر عن المهلة", items: overdueTasks });
  }

  return {
    groups,
    total: groups.reduce((s, g) => s + g.items.length, 0),
    overdueCount: overdueTasks.length,
  };
}

function courierTasks(user: Profile): MyTasksResult {
  const pending = listPickupReceipts({
    courierId: user.id,
    statuses: ["pending_courier"],
  });
  const held = listPickupReceipts({
    courierId: user.id,
    statuses: ["approved", "pending_supervisor"],
  });
  const groups: MyTasksResult["groups"] = [];

  if (pending.length) {
    groups.push({
      key: "pending",
      label: "نماذج بانتظار مراجعتك",
      items: pending.slice(0, 16).map((r) => ({
        id: `p:${r.id}`,
        group: "pending",
        title: r.receiptNumber,
        subtitle: `${r.opsBranchName} · ${r.lines.length} جهاز`,
        href: "/courier/receipts",
        badge: PICKUP_RECEIPT_STATUS_LABELS[r.status],
        urgent: true,
      })),
    });
  }

  if (held.length) {
    groups.push({
      key: "held",
      label: "معتمدة / قيد التسليم",
      items: held.slice(0, 12).map((r) => ({
        id: `h:${r.id}`,
        group: "held",
        title: r.receiptNumber,
        subtitle: `${r.opsBranchName} · ${PICKUP_RECEIPT_STATUS_LABELS[r.status]}`,
        href: "/courier/receipts",
      })),
    });
  }

  const overdueTasks = mapOverdueAsTasks(listDelayAlertsForUser(user));
  if (overdueTasks.length) {
    groups.unshift({ key: "overdue", label: "متأخر عن المهلة", items: overdueTasks });
  }

  return {
    groups,
    total: groups.reduce((s, g) => s + g.items.length, 0),
    overdueCount: overdueTasks.length,
  };
}

function managerTasks(user: Profile): MyTasksResult {
  const late = overdueIds(user);
  const groups: MyTasksResult["groups"] = [];

  const decisions = listNeedMaintenanceDecision();
  if (decisions.length) {
    groups.push({
      key: "decision",
      label: "تحتاج قرار صيانة",
      items: decisions.slice(0, 16).map((item) => ({
        id: `dec:${item.device.localId}`,
        group: "decision",
        title: item.device.deviceCode,
        subtitle: [
          item.request.requestNumber,
          item.decisionReason,
          deviceStatusLabel(normalizeLifecycleStatus(item.device.lifecycleStatus), "technician"),
        ]
          .filter(Boolean)
          .join(" · "),
        href: `/devices/detail/?id=${encodeURIComponent(item.device.localId)}`,
        badge: "قرار",
        overdue: late.has(item.device.localId),
        urgent: true,
      })),
    });
  }

  const needReceive = listNeedReceiveAtService();
  if (needReceive.length) {
    groups.push({
      key: "receive",
      label: "تحتاج استلام في مركز الصيانة",
      items: needReceive.slice(0, 12).map((item) => ({
        id: `recv:${item.device.localId}`,
        group: "receive",
        title: item.device.deviceCode,
        subtitle: `${item.request.requestNumber} · ${item.request.opsBranchName}`,
        href: "/maintenance/shipping",
        badge: "استلام",
        overdue: late.has(item.device.localId),
      })),
    });
  }

  const readyReturn = listReadyToReturnToBranches();
  if (readyReturn.length) {
    groups.push({
      key: "return",
      label: "جاهز للإرجاع للفروع",
      items: readyReturn.slice(0, 12).map((item) => ({
        id: `ret:${item.device.localId}`,
        group: "return",
        title: item.device.deviceCode,
        subtitle: `${item.request.requestNumber} · ${item.request.opsBranchName}`,
        href: "/maintenance/shipping",
        badge: "إرجاع",
        overdue: late.has(item.device.localId),
      })),
    });
  }

  const pendingHandover = listPickupReceipts({
    statuses: ["pending_supervisor"],
  });
  if (pendingHandover.length) {
    groups.push({
      key: "handover",
      label: "اعتماد تسليم المندوب",
      items: pendingHandover.slice(0, 12).map((r) => ({
        id: `ho:${r.id}`,
        group: "handover",
        title: r.receiptNumber,
        subtitle: `${r.opsBranchName} · ${r.assignedCourierName || "مندوب"}`,
        href: "/maintenance/courier-handover",
        badge: "اعتماد",
      })),
    });
  }

  const overdueTasks = mapOverdueAsTasks(listDelayAlertsForUser(user));
  if (overdueTasks.length) {
    groups.unshift({ key: "overdue", label: "متأخر عن المهلة", items: overdueTasks });
  }

  return {
    groups,
    total: groups.reduce((s, g) => s + g.items.length, 0),
    overdueCount: overdueTasks.length,
  };
}

/** Build today's actionable tasks for the signed-in user. */
export function getMyTasksForUser(user: Profile): MyTasksResult {
  const role = normalizeRole(user.role);

  if (isBranchRole(role)) return branchTasks(user);
  if (isTechnicianRole(role)) return technicianTasks(user);
  if (isPickupCourierRole(role)) return courierTasks(user);
  if (
    isMaintenanceManagerRole(role) ||
    isSystemAdminRole(role) ||
    role === "maintenance_supervisor" ||
    role === "supervisor" ||
    role === "manager"
  ) {
    return managerTasks(user);
  }

  return {
    groups: [],
    total: 0,
    overdueCount: 0,
  };
}
