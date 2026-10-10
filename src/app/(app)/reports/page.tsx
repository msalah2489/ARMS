"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Download, RotateCcw } from "lucide-react";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { usePreferences } from "@/components/preferences-provider";
import { branchScopeId, isBranchRole, isDemoMode } from "@/lib/auth";
import { deviceStatusLabel } from "@/lib/branch-store";
import {
  buildCustomersReport,
  buildDevicesReport,
  buildExcludedDevicesReport,
  buildFaultAnalysisRows,
  buildMaintenanceRequestReport,
  buildSentDevicesReport,
  buildShippingBatchesReport,
  buildSpareConsumeByTechnicianReport,
  buildSpareConsumeDetailReport,
  buildSpareStockMovementReport,
  type CustomerReportRow,
  type DeviceReportRow,
  type FaultAnalysisRow,
  type MaintenanceRequestReportRow,
  type ShippingBatchReportRow,
  type SpareConsumeReportRow,
  type SpareStockMovementReportRow,
} from "@/lib/reports-data";
import {
  ALL_FILTER_VALUE,
  emptyReportFilters,
  reportBrandOptions,
  reportBranchOptions,
  reportCarrierOptions,
  reportColorOptions,
  reportCustomerNameOptions,
  reportFaultCategoryOptions,
  reportLifecycleOptions,
  reportModelOptions,
  reportPartNameOptions,
  reportRequestStatusOptions,
  reportTechnicianOptions,
  type ReportFilterOption,
  type ReportFilters,
} from "@/lib/reports-filters";
import { readSession } from "@/lib/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { hydrateOpsFromSupabase } from "@/lib/supabase/hydrate";
import { formatDate } from "@/lib/utils";
import type { MessageKey } from "@/lib/i18n/messages";
import type { Profile } from "@/types/domain";

type ReportId =
  | "devices"
  | "customers"
  | "shippingBatches"
  | "maintenanceRequests"
  | "sentDevices"
  | "excludedDevices"
  | "spareByTech"
  | "spareConsume"
  | "spareMovements"
  | "faultAnalysis";

const REPORT_TYPES: { id: ReportId; labelKey: MessageKey }[] = [
  { id: "devices", labelKey: "reports.section.devices" },
  { id: "customers", labelKey: "reports.section.customers" },
  { id: "shippingBatches", labelKey: "reports.section.shippingBatches" },
  { id: "maintenanceRequests", labelKey: "reports.section.maintenanceRequests" },
  { id: "sentDevices", labelKey: "reports.section.sentDevices" },
  { id: "excludedDevices", labelKey: "reports.section.excludedDevices" },
  { id: "spareByTech", labelKey: "reports.section.spareByTech" },
  { id: "spareConsume", labelKey: "reports.section.spareConsume" },
  { id: "spareMovements", labelKey: "reports.section.spareMovements" },
  { id: "faultAnalysis", labelKey: "reports.section.faultAnalysis" },
];

function downloadCsv(filename: string, columns: string[], rows: string[][]) {
  const escape = (value: string) => {
    const text = value ?? "";
    if (/[",\n\r]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
    return text;
  };
  const lines = [
    columns.map(escape).join(","),
    ...rows.map((row) => row.map(escape).join(",")),
  ];
  const blob = new Blob(["\uFEFF" + lines.join("\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function formatMaybeDate(value: string, locale: "ar" | "en") {
  if (!value) return "—";
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return value;
  return formatDate(value, locale);
}

function EmptyState({ label }: { label: string }) {
  return (
    <p className="rounded-xl border border-dashed border-ink-900/15 px-4 py-6 text-sm text-ink-700/60 dark:border-white/10 dark:text-sand-100/60">
      {label}
    </p>
  );
}

function FilterField({
  label,
  children,
  wide,
}: {
  label: string;
  children: ReactNode;
  /** Slightly wider for report-type / long text fields */
  wide?: boolean;
}) {
  return (
    <label
      className={`flex shrink-0 flex-col gap-0.5 text-[11px] text-ink-700/80 dark:text-sand-100/70 ${
        wide ? "w-[12.5rem]" : "w-[8.5rem]"
      }`}
    >
      <span className="truncate">{label}</span>
      {children}
    </label>
  );
}

const fieldClass =
  "w-full rounded-md border border-ink-900/10 bg-white px-2 py-1 text-xs text-ink-900 dark:border-white/10 dark:bg-ink-950 dark:text-sand-50";

function SelectFilter({
  value,
  options,
  onChange,
}: {
  value: string;
  options: ReportFilterOption[];
  onChange: (value: string) => void;
}) {
  return (
    <select
      className={fieldClass}
      value={value || ALL_FILTER_VALUE}
      onChange={(event) => onChange(event.target.value)}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export default function ReportsPage() {
  const { t, locale } = usePreferences();
  const [user, setUser] = useState<Profile | null>(null);
  const [ready, setReady] = useState(false);
  const [tick, setTick] = useState(0);
  const [reportId, setReportId] = useState<ReportId>("devices");
  const [filters, setFilters] = useState<ReportFilters>(() => emptyReportFilters());

  useEffect(() => {
    let cancelled = false;
    const session = readSession();
    setUser(session);
    setReady(true);

    if (isSupabaseConfigured() && !isDemoMode()) {
      void hydrateOpsFromSupabase().then(() => {
        if (cancelled) return;
        setTick((value) => value + 1);
      });
    }
    return () => {
      cancelled = true;
    };
  }, []);

  const branchId = branchScopeId(user);
  const allLabel = t("reports.all");

  function patchFilters(patch: Partial<ReportFilters>) {
    setFilters((current) => ({ ...current, ...patch }));
  }

  function resetFilters() {
    setFilters(emptyReportFilters());
  }

  const brandOptions = useMemo(
    () => (ready ? reportBrandOptions(allLabel) : [{ value: ALL_FILTER_VALUE, label: allLabel }]),
    [ready, allLabel, tick],
  );
  const modelOptions = useMemo(
    () =>
      ready
        ? reportModelOptions(allLabel, filters.brand)
        : [{ value: ALL_FILTER_VALUE, label: allLabel }],
    [ready, allLabel, filters.brand, tick],
  );
  const colorOptions = useMemo(
    () => (ready ? reportColorOptions(allLabel) : [{ value: ALL_FILTER_VALUE, label: allLabel }]),
    [ready, allLabel, tick],
  );
  const branchOptions = useMemo(
    () =>
      ready
        ? reportBranchOptions(allLabel, branchId)
        : [{ value: ALL_FILTER_VALUE, label: allLabel }],
    [ready, allLabel, branchId, tick],
  );
  const lifecycleOptions = useMemo(
    () => (ready ? reportLifecycleOptions(allLabel) : [{ value: ALL_FILTER_VALUE, label: allLabel }]),
    [ready, allLabel, tick],
  );
  const customerOptions = useMemo(
    () =>
      ready
        ? reportCustomerNameOptions(allLabel, branchId)
        : [{ value: ALL_FILTER_VALUE, label: allLabel }],
    [ready, allLabel, branchId, tick],
  );
  const carrierOptions = useMemo(
    () =>
      ready
        ? reportCarrierOptions(allLabel, branchId)
        : [{ value: ALL_FILTER_VALUE, label: allLabel }],
    [ready, allLabel, branchId, tick],
  );
  const technicianOptions = useMemo(
    () =>
      ready ? reportTechnicianOptions(allLabel) : [{ value: ALL_FILTER_VALUE, label: allLabel }],
    [ready, allLabel, tick],
  );
  const partOptions = useMemo(
    () => (ready ? reportPartNameOptions(allLabel) : [{ value: ALL_FILTER_VALUE, label: allLabel }]),
    [ready, allLabel, tick],
  );
  const faultCategoryOptions = useMemo(
    () =>
      ready
        ? reportFaultCategoryOptions(allLabel, branchId)
        : [{ value: ALL_FILTER_VALUE, label: allLabel }],
    [ready, allLabel, branchId, tick],
  );

  const maintenanceStatusOptions = useMemo(() => {
    if (!ready) return [{ value: ALL_FILTER_VALUE, label: allLabel }];
    const rows = buildMaintenanceRequestReport(branchId, { allDates: true });
    return reportRequestStatusOptions(
      allLabel,
      rows.map((row) => row.currentStatus),
    );
  }, [ready, branchId, allLabel, tick]);

  function urgencyLabel(value: "urgent" | "normal") {
    return value === "urgent" ? t("reports.urgent") : t("reports.normal");
  }

  function directionLabel(value: string) {
    if (value === "to_service") return t("reports.direction.toService");
    if (value === "return") return t("reports.direction.return");
    return value || "—";
  }

  const result = useMemo(() => {
    if (!ready) {
      return { columns: [] as string[], tableRows: [] as ReactNode[][], csvRows: [] as string[][], filename: "report.csv" };
    }

    switch (reportId) {
      case "devices":
      case "sentDevices":
      case "excludedDevices": {
        const rows: DeviceReportRow[] =
          reportId === "sentDevices"
            ? buildSentDevicesReport(branchId, filters)
            : reportId === "excludedDevices"
              ? buildExcludedDevicesReport(branchId, filters)
              : buildDevicesReport(branchId, filters);
        const columns = [
          t("reports.col.deviceCode"),
          t("reports.col.deviceType"),
          t("reports.col.brand"),
          t("reports.col.model"),
          t("reports.col.color"),
          t("reports.col.serial"),
          t("reports.col.requestNumber"),
          t("reports.col.customer"),
          t("reports.col.branch"),
          t("reports.col.fault"),
          t("reports.col.location"),
          t("reports.col.currentStatus"),
          t("reports.col.urgency"),
          t("reports.col.carrier"),
          t("reports.col.requestCreated"),
          t("reports.col.sentToService"),
          t("reports.col.deliveredToCustomer"),
        ];
        return {
          columns,
          filename:
            reportId === "sentDevices"
              ? "sent-devices.csv"
              : reportId === "excludedDevices"
                ? "excluded-devices.csv"
                : "devices.csv",
          tableRows: rows.map((row) => [
            <span key="c" className="font-medium">
              {row.deviceCode}
            </span>,
            row.deviceType,
            row.brand,
            row.model,
            row.color,
            row.serial,
            row.requestNumber,
            row.customer,
            row.branch,
            row.fault,
            row.currentLocation,
            deviceStatusLabel(row.lifecycleStatus),
            urgencyLabel(row.urgency),
            row.carrier,
            formatMaybeDate(row.requestCreatedAt, locale),
            formatMaybeDate(row.sentToServiceAt, locale),
            formatMaybeDate(row.deliveredToCustomerAt, locale),
          ]),
          csvRows: rows.map((row) => [
            row.deviceCode,
            row.deviceType,
            row.brand,
            row.model,
            row.color,
            row.serial,
            row.requestNumber,
            row.customer,
            row.branch,
            row.fault,
            row.currentLocation,
            deviceStatusLabel(row.lifecycleStatus),
            urgencyLabel(row.urgency),
            row.carrier,
            formatMaybeDate(row.requestCreatedAt, locale),
            formatMaybeDate(row.sentToServiceAt, locale),
            formatMaybeDate(row.deliveredToCustomerAt, locale),
          ]),
        };
      }
      case "customers": {
        const rows: CustomerReportRow[] = buildCustomersReport(branchId, filters);
        const columns = [
          t("reports.col.customerName"),
          t("reports.col.phone"),
          t("reports.col.branches"),
          t("reports.col.deviceCount"),
          t("reports.col.models"),
          t("reports.col.lastActivity"),
        ];
        return {
          columns,
          filename: "customers.csv",
          tableRows: rows.map((row) => [
            <span key="n" className="font-medium">
              {row.name}
            </span>,
            row.phone,
            row.branches,
            String(row.deviceCount),
            row.models,
            formatMaybeDate(row.lastAt, locale),
          ]),
          csvRows: rows.map((row) => [
            row.name,
            row.phone,
            row.branches,
            String(row.deviceCount),
            row.models,
            formatMaybeDate(row.lastAt, locale),
          ]),
        };
      }
      case "shippingBatches": {
        const rows: ShippingBatchReportRow[] = buildShippingBatchesReport(branchId, filters);
        const columns = [
          t("reports.col.batchNumber"),
          t("reports.col.shipmentNumber"),
          t("reports.col.carrier"),
          t("reports.col.direction"),
          t("reports.col.branch"),
          t("reports.col.batchStatus"),
          t("reports.col.deviceCount"),
          t("reports.col.date"),
        ];
        return {
          columns,
          filename: "shipping-batches.csv",
          tableRows: rows.map((row) => [
            <span key="b" className="font-medium">
              {row.batchNumber}
            </span>,
            row.shipmentNumber,
            row.carrier,
            directionLabel(row.direction),
            row.branch,
            row.status,
            String(row.deviceCount),
            formatMaybeDate(row.activityAt, locale),
          ]),
          csvRows: rows.map((row) => [
            row.batchNumber,
            row.shipmentNumber,
            row.carrier,
            directionLabel(row.direction),
            row.branch,
            row.status,
            String(row.deviceCount),
            formatMaybeDate(row.activityAt, locale),
          ]),
        };
      }
      case "maintenanceRequests": {
        const rows: MaintenanceRequestReportRow[] = buildMaintenanceRequestReport(
          branchId,
          filters,
        );
        const columns = [
          t("reports.col.requestNumber"),
          t("reports.col.customerName"),
          t("reports.col.mobile"),
          t("reports.col.branch"),
          t("reports.col.deviceCount"),
          t("reports.col.urgency"),
          t("reports.col.currentStatus"),
          t("reports.col.statusDate"),
        ];
        return {
          columns,
          filename: "maintenance-requests.csv",
          tableRows: rows.map((row) => [
            <span key="n" className="font-medium">
              {row.requestNumber}
            </span>,
            row.customerName,
            row.mobile,
            row.branch,
            String(row.deviceCount),
            urgencyLabel(row.urgency),
            row.currentStatus,
            formatMaybeDate(row.statusDate, locale),
          ]),
          csvRows: rows.map((row) => [
            row.requestNumber,
            row.customerName,
            row.mobile,
            row.branch,
            String(row.deviceCount),
            urgencyLabel(row.urgency),
            row.currentStatus,
            formatMaybeDate(row.statusDate, locale),
          ]),
        };
      }
      case "spareByTech":
      case "spareConsume": {
        const rows: SpareConsumeReportRow[] =
          reportId === "spareByTech"
            ? buildSpareConsumeByTechnicianReport(branchId, filters)
            : buildSpareConsumeDetailReport(branchId, filters);
        const columns = [
          t("reports.col.date"),
          t("reports.col.technician"),
          t("reports.col.brand"),
          t("reports.col.model"),
          t("reports.col.deviceName"),
          t("reports.col.color"),
          t("reports.col.partName"),
          t("reports.col.qty"),
        ];
        return {
          columns,
          filename: reportId === "spareByTech" ? "spare-by-technician.csv" : "spare-consumption.csv",
          tableRows: rows.map((row) => [
            formatMaybeDate(row.date, locale),
            row.technician,
            row.brand,
            row.model,
            row.deviceName,
            row.color,
            row.partName,
            String(row.qty),
          ]),
          csvRows: rows.map((row) => [
            formatMaybeDate(row.date, locale),
            row.technician,
            row.brand,
            row.model,
            row.deviceName,
            row.color,
            row.partName,
            String(row.qty),
          ]),
        };
      }
      case "spareMovements": {
        const rows: SpareStockMovementReportRow[] = buildSpareStockMovementReport(filters);
        const columns = [
          t("reports.col.date"),
          t("reports.col.partType"),
          t("reports.col.brand"),
          t("reports.col.model"),
          t("reports.col.deviceType"),
          t("reports.col.movementType"),
          t("reports.col.qty"),
          t("reports.col.receiptNumber"),
        ];
        return {
          columns,
          filename: "spare-stock-movements.csv",
          tableRows: rows.map((row) => [
            formatMaybeDate(row.date, locale),
            row.partType,
            row.brand,
            row.model,
            row.deviceType,
            row.movementType === "receive" ? t("reports.receive") : t("reports.consume"),
            String(row.qty),
            row.receiptNumber || "—",
          ]),
          csvRows: rows.map((row) => [
            formatMaybeDate(row.date, locale),
            row.partType,
            row.brand,
            row.model,
            row.deviceType,
            row.movementType === "receive" ? t("reports.receive") : t("reports.consume"),
            String(row.qty),
            row.receiptNumber || "",
          ]),
        };
      }
      case "faultAnalysis": {
        const rows: FaultAnalysisRow[] = buildFaultAnalysisRows(branchId, filters);
        const columns = [
          t("reports.col.kind"),
          t("reports.col.label"),
          t("reports.col.count"),
          t("reports.col.device"),
        ];
        return {
          columns,
          filename: "fault-analysis.csv",
          tableRows: rows.map((row) => [
            row.kind === "complaint"
              ? t("reports.faultKind.complaint")
              : t("reports.faultKind.fault"),
            row.label,
            String(row.count),
            row.device,
          ]),
          csvRows: rows.map((row) => [
            row.kind === "complaint"
              ? t("reports.faultKind.complaint")
              : t("reports.faultKind.fault"),
            row.label,
            String(row.count),
            row.device,
          ]),
        };
      }
      default:
        return { columns: [], tableRows: [], csvRows: [], filename: "report.csv" };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- t/urgencyLabel are stable enough for this page
  }, [ready, reportId, branchId, filters, locale, tick]);

  if (!user) {
    return <p className="text-sm text-ink-700/70 dark:text-sand-100/70">{t("reports.loading")}</p>;
  }

  const description = isBranchRole(user.role)
    ? t("reports.branchDescription").replace(
        "{branch}",
        user.opsBranchName || t("dashboard.branchFallback"),
      )
    : t("reports.description");

  const showBrand = [
    "devices",
    "sentDevices",
    "excludedDevices",
    "spareByTech",
    "spareConsume",
    "spareMovements",
    "faultAnalysis",
  ].includes(reportId);
  const showModel = [
    "devices",
    "sentDevices",
    "excludedDevices",
    "customers",
    "spareByTech",
    "spareConsume",
    "spareMovements",
    "faultAnalysis",
  ].includes(reportId);
  const showColor = ["devices", "sentDevices", "excludedDevices"].includes(reportId);
  const showBranch = [
    "devices",
    "sentDevices",
    "excludedDevices",
    "customers",
    "maintenanceRequests",
  ].includes(reportId);
  const showLifecycle = reportId === "devices";
  const showPriority = reportId === "devices";
  const showCustomerName = ["customers", "maintenanceRequests"].includes(reportId);
  const showRequestFields = reportId === "maintenanceRequests";
  const showShipping = reportId === "shippingBatches";
  const showTech = ["spareByTech", "spareConsume"].includes(reportId);
  const showPart = ["spareByTech", "spareConsume", "spareMovements"].includes(reportId);
  const showMovement = reportId === "spareMovements";
  const showFault = reportId === "faultAnalysis";
  const showCarrier = ["shippingBatches", "sentDevices", "excludedDevices"].includes(reportId);

  return (
    <div className="space-y-4">
      <PageHeader title={t("reports.title")} description={description} />

      {!ready ? (
        <p className="text-sm text-ink-700/70 dark:text-sand-100/70">{t("reports.loading")}</p>
      ) : (
        <>
          <section className="rounded-xl border border-ink-900/10 bg-white p-3 shadow-panel dark:border-white/10 dark:bg-ink-900">
            {/* Row 1: report type + secondary filters */}
            <div className="flex flex-nowrap items-end gap-2 overflow-x-auto pb-0.5">
              <FilterField label={t("reports.reportType")} wide>
                <select
                  className={fieldClass}
                  value={reportId}
                  onChange={(event) => {
                    setReportId(event.target.value as ReportId);
                    resetFilters();
                  }}
                >
                  {REPORT_TYPES.map((item) => (
                    <option key={item.id} value={item.id}>
                      {t(item.labelKey)}
                    </option>
                  ))}
                </select>
              </FilterField>
              {showBrand ? (
                <FilterField label={t("reports.filter.brand")}>
                  <SelectFilter
                    value={filters.brand || ALL_FILTER_VALUE}
                    options={brandOptions}
                    onChange={(value) =>
                      patchFilters({ brand: value, model: ALL_FILTER_VALUE })
                    }
                  />
                </FilterField>
              ) : null}
              {showModel ? (
                <FilterField label={t("reports.filter.model")}>
                  <SelectFilter
                    value={filters.model || ALL_FILTER_VALUE}
                    options={modelOptions}
                    onChange={(value) => patchFilters({ model: value })}
                  />
                </FilterField>
              ) : null}
              {showColor ? (
                <FilterField label={t("reports.filter.color")}>
                  <SelectFilter
                    value={filters.color || ALL_FILTER_VALUE}
                    options={colorOptions}
                    onChange={(value) => patchFilters({ color: value })}
                  />
                </FilterField>
              ) : null}
              {showBranch && !isBranchRole(user.role) ? (
                <FilterField label={t("reports.filter.branch")}>
                  <SelectFilter
                    value={filters.branch || ALL_FILTER_VALUE}
                    options={branchOptions}
                    onChange={(value) => patchFilters({ branch: value })}
                  />
                </FilterField>
              ) : null}
              {showLifecycle ? (
                <FilterField label={t("reports.filter.lifecycle")}>
                  <SelectFilter
                    value={filters.lifecycleStatus || ALL_FILTER_VALUE}
                    options={lifecycleOptions}
                    onChange={(value) => patchFilters({ lifecycleStatus: value })}
                  />
                </FilterField>
              ) : null}
              {showPriority ? (
                <FilterField label={t("reports.filter.priority")}>
                  <select
                    className={fieldClass}
                    value={filters.priority || ""}
                    onChange={(event) =>
                      patchFilters({
                        priority: event.target.value as ReportFilters["priority"],
                      })
                    }
                  >
                    <option value="">{allLabel}</option>
                    <option value="urgent">{t("reports.urgent")}</option>
                    <option value="normal">{t("reports.normal")}</option>
                  </select>
                </FilterField>
              ) : null}
              {showCustomerName ? (
                <FilterField label={t("reports.filter.customerName")}>
                  <SelectFilter
                    value={filters.customerName || ALL_FILTER_VALUE}
                    options={customerOptions}
                    onChange={(value) => patchFilters({ customerName: value })}
                  />
                </FilterField>
              ) : null}
              {showRequestFields ? (
                <>
                  <FilterField label={t("reports.filter.requestNumber")}>
                    <input
                      className={fieldClass}
                      value={filters.requestNumber || ""}
                      placeholder={allLabel}
                      onChange={(event) => patchFilters({ requestNumber: event.target.value })}
                    />
                  </FilterField>
                  <FilterField label={t("reports.filter.mobile")}>
                    <input
                      className={fieldClass}
                      value={filters.mobile || ""}
                      placeholder={allLabel}
                      onChange={(event) => patchFilters({ mobile: event.target.value })}
                    />
                  </FilterField>
                  <FilterField label={t("reports.filter.urgency")}>
                    <select
                      className={fieldClass}
                      value={filters.urgency || ""}
                      onChange={(event) =>
                        patchFilters({
                          urgency: event.target.value as ReportFilters["urgency"],
                        })
                      }
                    >
                      <option value="">{allLabel}</option>
                      <option value="urgent">{t("reports.urgent")}</option>
                      <option value="normal">{t("reports.normal")}</option>
                    </select>
                  </FilterField>
                  <FilterField label={t("reports.filter.currentStatus")}>
                    <SelectFilter
                      value={filters.currentStatus || ALL_FILTER_VALUE}
                      options={maintenanceStatusOptions}
                      onChange={(value) => patchFilters({ currentStatus: value })}
                    />
                  </FilterField>
                </>
              ) : null}
              {showShipping ? (
                <FilterField label={t("reports.filter.direction")}>
                  <select
                    className={fieldClass}
                    value={filters.direction || ""}
                    onChange={(event) =>
                      patchFilters({
                        direction: event.target.value as ReportFilters["direction"],
                      })
                    }
                  >
                    <option value="">{allLabel}</option>
                    <option value="to_service">{t("reports.direction.toService")}</option>
                    <option value="return">{t("reports.direction.return")}</option>
                  </select>
                </FilterField>
              ) : null}
              {showCarrier ? (
                <FilterField label={t("reports.filter.carrier")}>
                  <SelectFilter
                    value={filters.carrier || ALL_FILTER_VALUE}
                    options={carrierOptions}
                    onChange={(value) => patchFilters({ carrier: value })}
                  />
                </FilterField>
              ) : null}
              {showTech ? (
                <FilterField label={t("reports.filter.technician")}>
                  <SelectFilter
                    value={filters.technician || ALL_FILTER_VALUE}
                    options={technicianOptions}
                    onChange={(value) => patchFilters({ technician: value })}
                  />
                </FilterField>
              ) : null}
              {showPart ? (
                <FilterField label={t("reports.filter.partName")}>
                  <SelectFilter
                    value={filters.partName || ALL_FILTER_VALUE}
                    options={partOptions}
                    onChange={(value) => patchFilters({ partName: value })}
                  />
                </FilterField>
              ) : null}
              {showMovement ? (
                <FilterField label={t("reports.filter.movementType")}>
                  <select
                    className={fieldClass}
                    value={filters.movementType || ""}
                    onChange={(event) =>
                      patchFilters({
                        movementType: event.target.value as ReportFilters["movementType"],
                      })
                    }
                  >
                    <option value="">{allLabel}</option>
                    <option value="receive">{t("reports.receive")}</option>
                    <option value="consume">{t("reports.consume")}</option>
                  </select>
                </FilterField>
              ) : null}
              {showFault ? (
                <>
                  <FilterField label={t("reports.filter.faultKind")}>
                    <select
                      className={fieldClass}
                      value={filters.faultKind || ""}
                      onChange={(event) =>
                        patchFilters({
                          faultKind: event.target.value as ReportFilters["faultKind"],
                        })
                      }
                    >
                      <option value="">{allLabel}</option>
                      <option value="complaint">{t("reports.faultKind.complaint")}</option>
                      <option value="fault">{t("reports.faultKind.fault")}</option>
                    </select>
                  </FilterField>
                  <FilterField label={t("reports.filter.faultCategory")}>
                    <SelectFilter
                      value={filters.faultCategory || ALL_FILTER_VALUE}
                      options={faultCategoryOptions}
                      onChange={(value) => patchFilters({ faultCategory: value })}
                    />
                  </FilterField>
                </>
              ) : null}
            </div>

            {/* Row 2: date range only */}
            <div className="mt-2 flex flex-nowrap items-end gap-2">
              <label className="flex h-[1.875rem] shrink-0 items-center gap-1.5 text-xs text-ink-700 dark:text-sand-100">
                <input
                  type="checkbox"
                  checked={filters.allDates !== false}
                  onChange={(event) =>
                    patchFilters({
                      allDates: event.target.checked,
                      dateFrom: event.target.checked ? "" : filters.dateFrom,
                      dateTo: event.target.checked ? "" : filters.dateTo,
                    })
                  }
                  className="size-3.5 rounded border-ink-900/20"
                />
                {t("reports.filter.allDates")}
              </label>
              <FilterField label={t("reports.filter.dateFrom")}>
                <input
                  type="date"
                  className={fieldClass}
                  disabled={filters.allDates !== false}
                  value={filters.dateFrom || ""}
                  onChange={(event) =>
                    patchFilters({ allDates: false, dateFrom: event.target.value })
                  }
                />
              </FilterField>
              <FilterField label={t("reports.filter.dateTo")}>
                <input
                  type="date"
                  className={fieldClass}
                  disabled={filters.allDates !== false}
                  value={filters.dateTo || ""}
                  onChange={(event) =>
                    patchFilters({ allDates: false, dateTo: event.target.value })
                  }
                />
              </FilterField>
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex h-[1.875rem] items-center gap-1 rounded-md border border-ink-900/10 px-2 text-[11px] font-medium dark:border-white/10"
              >
                <RotateCcw className="h-3 w-3" />
                {t("reports.resetFilters")}
              </button>
              <span className="pb-1 text-[11px] text-ink-700/60 dark:text-sand-100/60">
                {t("reports.rows").replace("{count}", String(result.tableRows.length))}
              </span>
              <button
                type="button"
                disabled={result.csvRows.length === 0}
                onClick={() => downloadCsv(result.filename, result.columns, result.csvRows)}
                className="ms-auto inline-flex h-[1.875rem] items-center gap-1 rounded-md border border-ink-900/10 px-2 text-[11px] font-medium disabled:opacity-40 dark:border-white/10"
              >
                <Download className="h-3 w-3" />
                {t("reports.exportCsv")}
              </button>
            </div>
          </section>

          {result.tableRows.length === 0 ? (
            <EmptyState label={t("reports.empty")} />
          ) : (
            <DataTable columns={result.columns} rows={result.tableRows} />
          )}
        </>
      )}
    </div>
  );
}
