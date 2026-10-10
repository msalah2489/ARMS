"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ClickableImage, ImagePlaceholder } from "@/components/clickable-image";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { usePreferences } from "@/components/preferences-provider";
import { StatusBadge } from "@/components/status-badge";
import { branchScopeId } from "@/lib/auth";
import {
  listAllRequestDevices,
  normalizeLifecycleStatus,
  subscribeMaintenanceRequestsChanged,
} from "@/lib/branch-store";
import {
  listBranchesNeedMaintenance,
  listCustomersAtBranch,
  listDeliveringToBranches,
  listHandToCustomer,
  listHandToMobile,
  listIncomingFromService,
  listInMaintenance,
  listNeedMaintenanceDecision,
  listNeedReceiveAtService,
  listReadyToReturnToBranches,
  listSendToService,
  type SendToServiceSublabel,
} from "@/lib/dashboard-work-queues";
import { getDevices } from "@/lib/data";
import type { MessageKey } from "@/lib/i18n/messages";
import { readSession } from "@/lib/session";
import type { Device } from "@/types/domain";

type ListFocus =
  | "pending_supervisor"
  | "awaiting_customer"
  | "returning"
  | "ready_to_send"
  | "customers_at_branch"
  | "send_to_service"
  | "hand_to_mobile"
  | "branches_need_maintenance"
  | "need_decision"
  | "ready_to_return"
  | "delivering_to_branches"
  | "need_receive_at_service"
  | "in_maintenance"
  | null;

const FOCUS_VALUES: ListFocus[] = [
  "pending_supervisor",
  "awaiting_customer",
  "returning",
  "ready_to_send",
  "customers_at_branch",
  "send_to_service",
  "hand_to_mobile",
  "branches_need_maintenance",
  "need_decision",
  "ready_to_return",
  "delivering_to_branches",
  "need_receive_at_service",
  "in_maintenance",
];

function readFocus(raw: string | null): ListFocus {
  if (raw && (FOCUS_VALUES as string[]).includes(raw)) return raw as ListFocus;
  return null;
}

function filterLabelKey(focus: Exclude<ListFocus, null>): MessageKey {
  switch (focus) {
    case "pending_supervisor":
      return "dashboard.filter.pendingSupervisor";
    case "awaiting_customer":
      return "dashboard.filter.awaitingCustomer";
    case "returning":
      return "dashboard.filter.returning";
    case "ready_to_send":
    case "send_to_service":
      return "dashboard.filter.sendToService";
    case "customers_at_branch":
      return "dashboard.filter.customersAtBranch";
    case "hand_to_mobile":
      return "dashboard.filter.handToMobile";
    case "branches_need_maintenance":
      return "dashboard.filter.branchesNeedMaintenance";
    case "need_decision":
      return "dashboard.filter.needDecision";
    case "ready_to_return":
      return "dashboard.filter.readyToReturn";
    case "delivering_to_branches":
      return "dashboard.filter.deliveringToBranches";
    case "need_receive_at_service":
      return "dashboard.filter.needReceiveAtService";
    case "in_maintenance":
      return "dashboard.filter.inMaintenance";
  }
}

function sublabelMessageKey(sub: SendToServiceSublabel): MessageKey {
  if (sub === "awaiting_waybill") return "dashboard.work.sub.awaiting_waybill";
  if (sub === "awaiting_carrier") return "dashboard.work.sub.awaiting_carrier";
  return "dashboard.work.sub.awaiting_courier";
}

export default function DevicesPage() {
  const { t, locale } = usePreferences();
  const searchParams = useSearchParams();
  const focus = readFocus(searchParams?.get("focus") ?? null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [branchId, setBranchId] = useState<string | null>(null);

  useEffect(() => {
    setBranchId(branchScopeId(readSession()));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = (opts?: { quiet?: boolean }) => {
      if (!opts?.quiet) setLoading(true);
      const scope = branchScopeId(readSession());
      setBranchId(scope);
      void getDevices(locale, scope).then((rows) => {
        if (cancelled) return;
        setDevices(rows);
        setLoading(false);
      });
    };
    load();
    const unsubscribe = subscribeMaintenanceRequestsChanged(() => load({ quiet: true }));
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [locale]);

  const sendSublabelById = useMemo(() => {
    if (!branchId) return new Map<string, SendToServiceSublabel>();
    if (focus !== "send_to_service" && focus !== "ready_to_send") {
      return new Map<string, SendToServiceSublabel>();
    }
    return new Map(
      listSendToService(branchId).map((item) => [item.device.localId, item.sendSublabel]),
    );
  }, [branchId, focus, devices]);

  const decisionReasonById = useMemo(() => {
    if (focus !== "need_decision") return new Map<string, string>();
    return new Map(
      listNeedMaintenanceDecision()
        .filter((item) => item.decisionReason)
        .map((item) => [item.device.localId, item.decisionReason!]),
    );
  }, [focus, devices]);

  const maintenanceBadgeById = useMemo(() => {
    if (focus !== "in_maintenance") {
      return new Map<string, { priority: string; phase: string }>();
    }
    return new Map(
      listInMaintenance().map((item) => [
        item.device.localId,
        {
          priority:
            item.priority === "urgent"
              ? t("dashboard.mgr.badge.urgent")
              : t("dashboard.mgr.badge.normal"),
          phase:
            item.maintenancePhase === "in_progress"
              ? t("dashboard.mgr.badge.inProgress")
              : t("dashboard.mgr.badge.waiting"),
        },
      ]),
    );
  }, [focus, devices, t]);

  const visible = useMemo(() => {
    if (!focus) return devices;

    const idsFrom = (items: Array<{ device: { localId: string } }>) =>
      new Set(items.map((item) => item.device.localId));

    let ids: Set<string>;

    switch (focus) {
      case "customers_at_branch":
        ids = branchId ? idsFrom(listCustomersAtBranch(branchId)) : new Set();
        break;
      case "send_to_service":
      case "ready_to_send":
        ids = branchId ? idsFrom(listSendToService(branchId)) : new Set();
        break;
      case "hand_to_mobile":
        ids = branchId ? idsFrom(listHandToMobile(branchId)) : new Set();
        break;
      case "awaiting_customer":
        ids = branchId
          ? idsFrom(listHandToCustomer(branchId))
          : idsFrom(
              listAllRequestDevices().filter(
                (item) =>
                  normalizeLifecycleStatus(item.device.lifecycleStatus) ===
                  "awaiting_customer",
              ),
            );
        break;
      case "returning":
        ids = branchId
          ? idsFrom(listIncomingFromService(branchId))
          : idsFrom(
              listAllRequestDevices().filter(
                (item) =>
                  normalizeLifecycleStatus(item.device.lifecycleStatus) ===
                  "in_return_transit",
              ),
            );
        break;
      case "pending_supervisor":
        ids = idsFrom(
          listAllRequestDevices().filter(
            (item) =>
              (!branchId || item.request.opsBranchId === branchId) &&
              normalizeLifecycleStatus(item.device.lifecycleStatus) ===
                "awaiting_manager_decision",
          ),
        );
        break;
      case "branches_need_maintenance":
        ids = idsFrom(listBranchesNeedMaintenance());
        break;
      case "need_decision":
        ids = idsFrom(listNeedMaintenanceDecision());
        break;
      case "ready_to_return":
        ids = idsFrom(listReadyToReturnToBranches());
        break;
      case "delivering_to_branches":
        ids = idsFrom(listDeliveringToBranches());
        break;
      case "need_receive_at_service":
        ids = idsFrom(listNeedReceiveAtService());
        break;
      case "in_maintenance":
        ids = idsFrom(listInMaintenance());
        break;
      default:
        return devices;
    }

    return devices.filter((device) => ids.has(device.id));
  }, [devices, focus, branchId]);

  const showQueueNote =
    focus === "send_to_service" ||
    focus === "ready_to_send" ||
    focus === "need_decision" ||
    focus === "in_maintenance";

  const filterLabel = focus ? t(filterLabelKey(focus)) : null;

  const columns = [
    t("devices.col.code"),
    t("devices.col.requestNumber"),
    t("devices.col.model"),
    t("devices.col.serial"),
    t("devices.col.customer"),
    t("devices.col.location"),
    t("devices.col.status"),
    ...(showQueueNote ? [t("devices.col.queueNote")] : []),
    t("devices.col.image"),
  ];

  return (
    <div>
      <PageHeader title={t("devices.title")} description={t("devices.description")} />
      {filterLabel ? (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-aroma-400/40 bg-aroma-50/70 px-3 py-2 text-sm dark:border-aroma-500/30 dark:bg-aroma-950/30">
          <span className="font-medium text-aroma-800 dark:text-aroma-200">{filterLabel}</span>
          <Link
            href="/devices"
            className="text-aroma-700 underline underline-offset-2 dark:text-aroma-300"
          >
            {t("dashboard.filter.clear")}
          </Link>
        </div>
      ) : null}
      {loading ? (
        <p className="text-sm text-ink-700/70 dark:text-sand-100/70">{t("devices.loading")}</p>
      ) : (
        <DataTable
          mobilePrimaryIndex={0}
          mobileBadgeIndexes={[6]}
          columns={columns}
          rows={visible.map((device) => {
            const queueNote = (() => {
              if (focus === "send_to_service" || focus === "ready_to_send") {
                const sub = sendSublabelById.get(device.id);
                return sub ? t(sublabelMessageKey(sub)) : "—";
              }
              if (focus === "need_decision") {
                return decisionReasonById.get(device.id) ?? "—";
              }
              if (focus === "in_maintenance") {
                const badge = maintenanceBadgeById.get(device.id);
                return badge ? `${badge.priority} · ${badge.phase}` : "—";
              }
              return null;
            })();

            return [
              <Link
                key="c"
                href={`/devices/detail/?id=${encodeURIComponent(device.id)}`}
                className="font-semibold text-aroma-700 underline decoration-2 decoration-aroma-400/80 underline-offset-4 transition hover:text-aroma-800 dark:text-aroma-200 dark:decoration-aroma-500/80 dark:hover:text-aroma-100"
              >
                {device.deviceCode}
              </Link>,
              device.requestId && device.requestNumber ? (
                <Link
                  key="sr"
                  href={`/service-requests/detail/?id=${encodeURIComponent(device.requestId)}`}
                  className="font-medium text-aroma-700 underline decoration-2 decoration-aroma-400/80 underline-offset-4 transition hover:text-aroma-800 dark:text-aroma-200 dark:decoration-aroma-500/80 dark:hover:text-aroma-100"
                >
                  {device.requestNumber}
                </Link>
              ) : (
                "—"
              ),
              `${device.brand} ${device.modelName}`,
              device.serialNumber,
              device.customerName,
              device.currentLocation,
              <StatusBadge key="s" value={device.lifecycleStatus ?? device.status} />,
              ...(showQueueNote
                ? [
                    <span
                      key="note"
                      className="inline-flex rounded-full border border-ink-900/10 bg-sand-50 px-2 py-0.5 text-xs text-ink-800 dark:border-white/15 dark:bg-ink-950 dark:text-sand-100"
                    >
                      {queueNote}
                    </span>,
                  ]
                : []),
              device.imageDataUrl ? (
                <ClickableImage
                  key="img"
                  src={device.imageDataUrl}
                  alt={device.deviceCode}
                  size="sm"
                />
              ) : (
                <ImagePlaceholder key="img" size="sm" />
              ),
            ];
          })}
        />
      )}
    </div>
  );
}
