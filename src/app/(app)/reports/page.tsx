"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ChevronDown, Download } from "lucide-react";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { usePreferences } from "@/components/preferences-provider";
import { branchScopeId, isBranchRole, isDemoMode } from "@/lib/auth";
import { deviceStatusLabel } from "@/lib/branch-store";
import {
  buildDevicesReport,
  buildExcludedDevicesReport,
  buildFaultAnalysisReport,
  buildMaintenanceRequestReport,
  buildSentDevicesReport,
  buildSpareConsumeByTechnicianReport,
  buildSpareConsumeDetailReport,
  buildSpareStockMovementReport,
  type DeviceReportRow,
  type FaultAnalysisBucket,
  type MaintenanceRequestReportRow,
  type SpareConsumeReportRow,
  type SpareStockMovementReportRow,
} from "@/lib/reports-data";
import { readSession } from "@/lib/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { hydrateOpsFromSupabase } from "@/lib/supabase/hydrate";
import { formatDate } from "@/lib/utils";
import type { Profile } from "@/types/domain";

type ReportId =
  | "maintenanceRequests"
  | "devices"
  | "sentDevices"
  | "excludedDevices"
  | "spareByTech"
  | "spareConsume"
  | "spareMovements"
  | "faultAnalysis";

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

function ReportSection({
  id,
  title,
  hint,
  open,
  onToggle,
  rowCount,
  onExport,
  exportLabel,
  rowsLabel,
  children,
}: {
  id: ReportId;
  title: string;
  hint?: string;
  open: boolean;
  onToggle: (id: ReportId) => void;
  rowCount: number;
  onExport: () => void;
  exportLabel: string;
  rowsLabel: string;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-ink-900/10 bg-white shadow-panel dark:border-white/10 dark:bg-ink-900">
      <div className="flex flex-wrap items-center gap-2 border-b border-ink-900/5 px-4 py-3 dark:border-white/5">
        <button
          type="button"
          onClick={() => onToggle(id)}
          className="flex min-w-0 flex-1 items-center gap-2 text-start"
          aria-expanded={open}
        >
          <ChevronDown
            className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-0" : "-rotate-90"}`}
          />
          <span className="font-display text-lg dark:text-sand-50">{title}</span>
          <span className="text-xs text-ink-700/60 dark:text-sand-100/60">{rowsLabel}</span>
        </button>
        <button
          type="button"
          onClick={onExport}
          disabled={rowCount === 0}
          className="inline-flex items-center gap-1.5 rounded-xl border border-ink-900/10 px-3 py-1.5 text-xs font-medium disabled:opacity-40 dark:border-white/10"
        >
          <Download className="h-3.5 w-3.5" />
          {exportLabel}
        </button>
      </div>
      {open ? (
        <div className="p-4">
          {hint ? (
            <p className="mb-3 text-sm text-ink-700/70 dark:text-sand-100/70">{hint}</p>
          ) : null}
          {children}
        </div>
      ) : null}
    </section>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <p className="rounded-xl border border-dashed border-ink-900/15 px-4 py-6 text-sm text-ink-700/60 dark:border-white/10 dark:text-sand-100/60">
      {label}
    </p>
  );
}

export default function ReportsPage() {
  const { t, locale } = usePreferences();
  const [user, setUser] = useState<Profile | null>(null);
  const [ready, setReady] = useState(false);
  const [openId, setOpenId] = useState<ReportId | null>("maintenanceRequests");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const session = readSession();
    setUser(session);
    // Show reports from local cache immediately; hydrate refreshes in background.
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

  const maintenanceRows = useMemo(
    () => (ready ? buildMaintenanceRequestReport(branchId) : []),
    [ready, branchId, tick],
  );
  const deviceRows = useMemo(
    () => (ready ? buildDevicesReport(branchId) : []),
    [ready, branchId, tick],
  );
  const sentRows = useMemo(
    () => (ready ? buildSentDevicesReport(branchId) : []),
    [ready, branchId, tick],
  );
  const excludedRows = useMemo(
    () => (ready ? buildExcludedDevicesReport(branchId) : []),
    [ready, branchId, tick],
  );
  const spareByTechRows = useMemo(
    () => (ready ? buildSpareConsumeByTechnicianReport(branchId) : []),
    [ready, branchId, tick],
  );
  const spareConsumeRows = useMemo(
    () => (ready ? buildSpareConsumeDetailReport(branchId) : []),
    [ready, branchId, tick],
  );
  const movementRows = useMemo(
    () => (ready ? buildSpareStockMovementReport() : []),
    [ready, tick],
  );
  const faultReport = useMemo(
    () =>
      ready
        ? buildFaultAnalysisReport(branchId)
        : { complaints: [] as FaultAnalysisBucket[], faults: [] as FaultAnalysisBucket[] },
    [ready, branchId, tick],
  );

  function toggle(id: ReportId) {
    setOpenId((current) => (current === id ? null : id));
  }

  function urgencyLabel(value: "urgent" | "normal") {
    return value === "urgent" ? t("reports.urgent") : t("reports.normal");
  }

  function deviceColumns(): string[] {
    return [
      t("reports.col.deviceCode"),
      t("reports.col.deviceType"),
      t("reports.col.brand"),
      t("reports.col.model"),
      t("reports.col.serial"),
      t("reports.col.requestNumber"),
      t("reports.col.customer"),
      t("reports.col.branch"),
      t("reports.col.fault"),
      t("reports.col.location"),
      t("reports.col.currentStatus"),
      t("reports.col.urgency"),
      t("reports.col.requestCreated"),
      t("reports.col.sentToService"),
      t("reports.col.deliveredToCustomer"),
    ];
  }

  function deviceCsv(rows: DeviceReportRow[]) {
    return rows.map((row) => [
      row.deviceCode,
      row.deviceType,
      row.brand,
      row.model,
      row.serial,
      row.requestNumber,
      row.customer,
      row.branch,
      row.fault,
      row.currentLocation,
      deviceStatusLabel(row.lifecycleStatus),
      urgencyLabel(row.urgency),
      formatMaybeDate(row.requestCreatedAt, locale),
      formatMaybeDate(row.sentToServiceAt, locale),
      formatMaybeDate(row.deliveredToCustomerAt, locale),
    ]);
  }

  function deviceTableRows(rows: DeviceReportRow[]): ReactNode[][] {
    return rows.map((row) => [
      <span key="c" className="font-medium">
        {row.deviceCode}
      </span>,
      row.deviceType,
      row.brand,
      row.model,
      row.serial,
      row.requestNumber,
      row.customer,
      row.branch,
      row.fault,
      row.currentLocation,
      deviceStatusLabel(row.lifecycleStatus),
      urgencyLabel(row.urgency),
      formatMaybeDate(row.requestCreatedAt, locale),
      formatMaybeDate(row.sentToServiceAt, locale),
      formatMaybeDate(row.deliveredToCustomerAt, locale),
    ]);
  }

  function spareColumns(): string[] {
    return [
      t("reports.col.date"),
      t("reports.col.technician"),
      t("reports.col.deviceName"),
      t("reports.col.color"),
      t("reports.col.partName"),
      t("reports.col.qty"),
    ];
  }

  function spareCsv(rows: SpareConsumeReportRow[]) {
    return rows.map((row) => [
      formatMaybeDate(row.date, locale),
      row.technician,
      row.deviceName,
      row.color,
      row.partName,
      String(row.qty),
    ]);
  }

  function spareTableRows(rows: SpareConsumeReportRow[]): ReactNode[][] {
    return rows.map((row) => [
      formatMaybeDate(row.date, locale),
      row.technician,
      row.deviceName,
      row.color,
      row.partName,
      String(row.qty),
    ]);
  }

  function rowsLabel(count: number) {
    return t("reports.rows").replace("{count}", String(count));
  }

  if (!user) {
    return <p className="text-sm text-ink-700/70 dark:text-sand-100/70">{t("reports.loading")}</p>;
  }

  const description = isBranchRole(user.role)
    ? t("reports.branchDescription").replace(
        "{branch}",
        user.opsBranchName || t("dashboard.branchFallback"),
      )
    : t("reports.description");

  return (
    <div className="space-y-4">
      <PageHeader title={t("reports.title")} description={description} />

      {!ready ? (
        <p className="text-sm text-ink-700/70 dark:text-sand-100/70">{t("reports.loading")}</p>
      ) : (
        <>
          <ReportSection
            id="maintenanceRequests"
            title={t("reports.section.maintenanceRequests")}
            open={openId === "maintenanceRequests"}
            onToggle={toggle}
            rowCount={maintenanceRows.length}
            rowsLabel={rowsLabel(maintenanceRows.length)}
            exportLabel={t("reports.exportCsv")}
            onExport={() =>
              downloadCsv(
                "maintenance-requests.csv",
                [
                  t("reports.col.requestNumber"),
                  t("reports.col.customerName"),
                  t("reports.col.mobile"),
                  t("reports.col.branch"),
                  t("reports.col.deviceCount"),
                  t("reports.col.urgency"),
                  t("reports.col.currentStatus"),
                  t("reports.col.statusDate"),
                ],
                maintenanceRows.map((row: MaintenanceRequestReportRow) => [
                  row.requestNumber,
                  row.customerName,
                  row.mobile,
                  row.branch,
                  String(row.deviceCount),
                  urgencyLabel(row.urgency),
                  row.currentStatus,
                  formatMaybeDate(row.statusDate, locale),
                ]),
              )
            }
          >
            {maintenanceRows.length === 0 ? (
              <EmptyState label={t("reports.empty")} />
            ) : (
              <DataTable
                columns={[
                  t("reports.col.requestNumber"),
                  t("reports.col.customerName"),
                  t("reports.col.mobile"),
                  t("reports.col.branch"),
                  t("reports.col.deviceCount"),
                  t("reports.col.urgency"),
                  t("reports.col.currentStatus"),
                  t("reports.col.statusDate"),
                ]}
                rows={maintenanceRows.map((row) => [
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
                ])}
              />
            )}
          </ReportSection>

          <ReportSection
            id="devices"
            title={t("reports.section.devices")}
            open={openId === "devices"}
            onToggle={toggle}
            rowCount={deviceRows.length}
            rowsLabel={rowsLabel(deviceRows.length)}
            exportLabel={t("reports.exportCsv")}
            onExport={() =>
              downloadCsv("devices.csv", deviceColumns(), deviceCsv(deviceRows))
            }
          >
            {deviceRows.length === 0 ? (
              <EmptyState label={t("reports.empty")} />
            ) : (
              <DataTable columns={deviceColumns()} rows={deviceTableRows(deviceRows)} />
            )}
          </ReportSection>

          <ReportSection
            id="sentDevices"
            title={t("reports.section.sentDevices")}
            hint={t("reports.hint.sentDevices")}
            open={openId === "sentDevices"}
            onToggle={toggle}
            rowCount={sentRows.length}
            rowsLabel={rowsLabel(sentRows.length)}
            exportLabel={t("reports.exportCsv")}
            onExport={() =>
              downloadCsv("sent-devices.csv", deviceColumns(), deviceCsv(sentRows))
            }
          >
            {sentRows.length === 0 ? (
              <EmptyState label={t("reports.empty")} />
            ) : (
              <DataTable columns={deviceColumns()} rows={deviceTableRows(sentRows)} />
            )}
          </ReportSection>

          <ReportSection
            id="excludedDevices"
            title={t("reports.section.excludedDevices")}
            hint={t("reports.hint.excludedDevices")}
            open={openId === "excludedDevices"}
            onToggle={toggle}
            rowCount={excludedRows.length}
            rowsLabel={rowsLabel(excludedRows.length)}
            exportLabel={t("reports.exportCsv")}
            onExport={() =>
              downloadCsv(
                "excluded-devices.csv",
                deviceColumns(),
                deviceCsv(excludedRows),
              )
            }
          >
            {excludedRows.length === 0 ? (
              <EmptyState label={t("reports.empty")} />
            ) : (
              <DataTable columns={deviceColumns()} rows={deviceTableRows(excludedRows)} />
            )}
          </ReportSection>

          <ReportSection
            id="spareByTech"
            title={t("reports.section.spareByTech")}
            hint={t("reports.hint.spareByTech")}
            open={openId === "spareByTech"}
            onToggle={toggle}
            rowCount={spareByTechRows.length}
            rowsLabel={rowsLabel(spareByTechRows.length)}
            exportLabel={t("reports.exportCsv")}
            onExport={() =>
              downloadCsv(
                "spare-by-technician.csv",
                spareColumns(),
                spareCsv(spareByTechRows),
              )
            }
          >
            {spareByTechRows.length === 0 ? (
              <EmptyState label={t("reports.empty")} />
            ) : (
              <DataTable columns={spareColumns()} rows={spareTableRows(spareByTechRows)} />
            )}
          </ReportSection>

          <ReportSection
            id="spareConsume"
            title={t("reports.section.spareConsume")}
            hint={t("reports.hint.spareConsume")}
            open={openId === "spareConsume"}
            onToggle={toggle}
            rowCount={spareConsumeRows.length}
            rowsLabel={rowsLabel(spareConsumeRows.length)}
            exportLabel={t("reports.exportCsv")}
            onExport={() =>
              downloadCsv(
                "spare-consumption.csv",
                spareColumns(),
                spareCsv(spareConsumeRows),
              )
            }
          >
            {spareConsumeRows.length === 0 ? (
              <EmptyState label={t("reports.empty")} />
            ) : (
              <DataTable columns={spareColumns()} rows={spareTableRows(spareConsumeRows)} />
            )}
          </ReportSection>

          <ReportSection
            id="spareMovements"
            title={t("reports.section.spareMovements")}
            open={openId === "spareMovements"}
            onToggle={toggle}
            rowCount={movementRows.length}
            rowsLabel={rowsLabel(movementRows.length)}
            exportLabel={t("reports.exportCsv")}
            onExport={() =>
              downloadCsv(
                "spare-stock-movements.csv",
                [
                  t("reports.col.date"),
                  t("reports.col.partType"),
                  t("reports.col.brand"),
                  t("reports.col.deviceType"),
                  t("reports.col.movementType"),
                  t("reports.col.qty"),
                  t("reports.col.receiptNumber"),
                ],
                movementRows.map((row: SpareStockMovementReportRow) => [
                  formatMaybeDate(row.date, locale),
                  row.partType,
                  row.brand,
                  row.deviceType,
                  row.movementType === "receive"
                    ? t("reports.receive")
                    : t("reports.consume"),
                  String(row.qty),
                  row.receiptNumber || "",
                ]),
              )
            }
          >
            {movementRows.length === 0 ? (
              <EmptyState label={t("reports.empty")} />
            ) : (
              <DataTable
                columns={[
                  t("reports.col.date"),
                  t("reports.col.partType"),
                  t("reports.col.brand"),
                  t("reports.col.deviceType"),
                  t("reports.col.movementType"),
                  t("reports.col.qty"),
                  t("reports.col.receiptNumber"),
                ]}
                rows={movementRows.map((row) => [
                  formatMaybeDate(row.date, locale),
                  row.partType,
                  row.brand,
                  row.deviceType,
                  row.movementType === "receive"
                    ? t("reports.receive")
                    : t("reports.consume"),
                  String(row.qty),
                  row.receiptNumber || "—",
                ])}
              />
            )}
          </ReportSection>

          <ReportSection
            id="faultAnalysis"
            title={t("reports.section.faultAnalysis")}
            open={openId === "faultAnalysis"}
            onToggle={toggle}
            rowCount={faultReport.complaints.length + faultReport.faults.length}
            rowsLabel={rowsLabel(
              faultReport.complaints.length + faultReport.faults.length,
            )}
            exportLabel={t("reports.exportCsv")}
            onExport={() =>
              downloadCsv(
                "fault-analysis.csv",
                [
                  t("reports.col.complaint"),
                  t("reports.col.count"),
                  t("reports.col.device"),
                  t("reports.col.faultCause"),
                  t("reports.col.count"),
                  t("reports.col.device"),
                ],
                [
                  ...faultReport.complaints.map((row) => [
                    row.label,
                    String(row.count),
                    row.device,
                    "",
                    "",
                    "",
                  ]),
                  ...faultReport.faults.map((row) => [
                    "",
                    "",
                    "",
                    row.label,
                    String(row.count),
                    row.device,
                  ]),
                ],
              )
            }
          >
            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <h3 className="mb-1 font-medium dark:text-sand-50">
                  {t("reports.sub.complaints")}
                </h3>
                <p className="mb-3 text-sm text-ink-700/70 dark:text-sand-100/70">
                  {t("reports.hint.faultComplaints")}
                </p>
                {faultReport.complaints.length === 0 ? (
                  <EmptyState label={t("reports.empty")} />
                ) : (
                  <DataTable
                    columns={[
                      t("reports.col.complaint"),
                      t("reports.col.count"),
                      t("reports.col.device"),
                    ]}
                    rows={faultReport.complaints.map((row) => [
                      row.label,
                      String(row.count),
                      row.device,
                    ])}
                  />
                )}
              </div>
              <div>
                <h3 className="mb-1 font-medium dark:text-sand-50">
                  {t("reports.sub.faults")}
                </h3>
                <p className="mb-3 text-sm text-ink-700/70 dark:text-sand-100/70">
                  {t("reports.hint.faultCauses")}
                </p>
                {faultReport.faults.length === 0 ? (
                  <EmptyState label={t("reports.empty")} />
                ) : (
                  <DataTable
                    columns={[
                      t("reports.col.faultCause"),
                      t("reports.col.count"),
                      t("reports.col.device"),
                    ]}
                    rows={faultReport.faults.map((row) => [
                      row.label,
                      String(row.count),
                      row.device,
                    ])}
                  />
                )}
              </div>
            </div>
          </ReportSection>
        </>
      )}
    </div>
  );
}
