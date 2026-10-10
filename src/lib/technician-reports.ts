import {
  formatMaintenanceDuration,
  listAllRequestDevices,
} from "@/lib/branch-store";
import { OUTCOME_LABELS } from "@/lib/technician-catalog";
import {
  getTechnicianWorkPageStats,
  listTechnicianWork,
} from "@/lib/technician-store";
import type { Profile, TechnicianWorkRecord } from "@/types/domain";

/** Local calendar YYYY-MM-DD (not UTC slice — avoids off-by-one near midnight). */
export function toLocalDateKey(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayLocalDateKey() {
  return toLocalDateKey(new Date());
}

export function dateInRange(iso: string | undefined, fromKey: string, toKey: string) {
  if (!iso) return false;
  const key = toLocalDateKey(iso);
  if (!key) return false;
  return key >= fromKey && key <= toKey;
}

function deviceLookup() {
  const map = new Map<string, { deviceTypeName: string; fault: string }>();
  for (const item of listAllRequestDevices()) {
    map.set(`${item.request.id}:${item.device.localId}`, {
      deviceTypeName: item.device.deviceTypeName || "—",
      fault: item.device.fault || "—",
    });
  }
  return map;
}

function durationMs(record: TechnicianWorkRecord): number | null {
  if (!record.startedAt || !record.finishedAt) return null;
  const start = Date.parse(record.startedAt);
  const end = Date.parse(record.finishedAt);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null;
  return end - start;
}

export type MaintenanceResultKind = "success" | "failure";

export function classifyWorkResult(record: TechnicianWorkRecord): MaintenanceResultKind {
  // Failure = returned to supervisor (held), or finished without a successful outcome.
  if (record.status === "held") return "failure";
  const outcome = record.outcome;
  if (outcome === "repaired" || outcome === "no_repair_needed") return "success";
  return "failure";
}

export function workResultLabel(record: TechnicianWorkRecord): string {
  if (record.status === "held") return "فشل — أُرجع للمشرف";
  if (classifyWorkResult(record) === "success") {
    return record.outcome ? `نجاح — ${OUTCOME_LABELS[record.outcome]}` : "نجاح";
  }
  if (record.outcome) return `فشل — ${OUTCOME_LABELS[record.outcome]}`;
  return "فشل";
}

export type TechnicianDailyWorkRow = {
  id: string;
  deviceTypeName: string;
  requestNumber: string;
  deviceCode: string;
  faultCause: string;
  resultLabel: string;
  resultKind: MaintenanceResultKind;
  durationLabel: string;
  durationMs: number | null;
  finishedAt: string;
  status: TechnicianWorkRecord["status"];
};

/** Finished work (completed / held) for this technician in [fromKey, toKey]. */
export function listTechnicianFinishedWorkInRange(
  technicianId: string,
  fromKey: string,
  toKey: string,
): TechnicianWorkRecord[] {
  return listTechnicianWork().filter((record) => {
    if (record.technicianId !== technicianId) return false;
    if (record.status !== "completed" && record.status !== "held") return false;
    return dateInRange(record.finishedAt, fromKey, toKey);
  });
}

export function buildTechnicianDailyWorkRows(
  technicianId: string,
  fromKey: string,
  toKey: string,
): TechnicianDailyWorkRow[] {
  const lookup = deviceLookup();
  const rows = listTechnicianFinishedWorkInRange(technicianId, fromKey, toKey).map((record) => {
    const device = lookup.get(`${record.requestId}:${record.deviceLocalId}`);
    const ms = durationMs(record);
    return {
      id: record.id,
      deviceTypeName: device?.deviceTypeName ?? "—",
      requestNumber: record.requestNumber,
      deviceCode: record.deviceCode,
      faultCause: record.faultCause?.trim() || device?.fault || "—",
      resultLabel: workResultLabel(record),
      resultKind: classifyWorkResult(record),
      durationLabel: formatMaintenanceDuration(record.startedAt, record.finishedAt),
      durationMs: ms,
      finishedAt: record.finishedAt ?? "",
      status: record.status,
    };
  });
  return rows.sort((a, b) => b.finishedAt.localeCompare(a.finishedAt));
}

export type AverageDurationBucket = {
  key: string;
  label: string;
  count: number;
  averageMs: number;
  averageLabel: string;
};

function formatAverageMs(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  if (hours > 0) return `${hours} س ${minutes} د`;
  if (minutes > 0) return `${minutes} د ${seconds} ث`;
  return `${seconds} ث`;
}

function averageBuckets(
  rows: TechnicianDailyWorkRow[],
  pick: (row: TechnicianDailyWorkRow) => string,
): AverageDurationBucket[] {
  const groups = new Map<string, { totalMs: number; count: number }>();
  for (const row of rows) {
    if (row.durationMs == null) continue;
    const label = pick(row).trim() || "—";
    const prev = groups.get(label) ?? { totalMs: 0, count: 0 };
    prev.totalMs += row.durationMs;
    prev.count += 1;
    groups.set(label, prev);
  }
  return [...groups.entries()]
    .map(([label, stats]) => {
      const averageMs = stats.totalMs / stats.count;
      return {
        key: label,
        label,
        count: stats.count,
        averageMs,
        averageLabel: formatAverageMs(averageMs),
      };
    })
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "ar"));
}

/**
 * TODO(user): color thresholds are temporary placeholders — confirm order/cutoffs later.
 * Current draft: green ≥ 70, yellow 40–69, red < 40.
 */
export const PERFORMANCE_RATE_THRESHOLDS = {
  greenMin: 70,
  yellowMin: 40,
} as const;

export type RateColorTone = "green" | "yellow" | "red";

export function performanceRateTone(percent: number): RateColorTone {
  // TODO(user): thresholds / ordering may change after product confirmation.
  if (percent >= PERFORMANCE_RATE_THRESHOLDS.greenMin) return "green";
  if (percent >= PERFORMANCE_RATE_THRESHOLDS.yellowMin) return "yellow";
  return "red";
}

export type TechnicianPerformanceReport = {
  maintainedCount: number;
  availableCount: number;
  ratePercent: number | null;
  rateTone: RateColorTone | null;
  avgByFaultCause: AverageDurationBucket[];
  avgByDeviceType: AverageDurationBucket[];
};

/**
 * Available ≈ unique devices this tech started or finished in the range,
 * plus the live awaiting queue when the range includes today
 * (no historical queue snapshot exists yet).
 */
export function buildTechnicianPerformanceReport(
  technician: Profile,
  fromKey: string,
  toKey: string,
): TechnicianPerformanceReport {
  const finishedRows = buildTechnicianDailyWorkRows(technician.id, fromKey, toKey);
  const maintainedKeys = new Set(
    listTechnicianFinishedWorkInRange(technician.id, fromKey, toKey).map(
      (r) => `${r.requestId}:${r.deviceLocalId}`,
    ),
  );

  const touchedKeys = new Set<string>();
  for (const record of listTechnicianWork()) {
    if (record.technicianId !== technician.id) continue;
    const startedIn = dateInRange(record.startedAt, fromKey, toKey);
    const finishedIn = dateInRange(record.finishedAt, fromKey, toKey);
    if (startedIn || finishedIn) {
      touchedKeys.add(`${record.requestId}:${record.deviceLocalId}`);
    }
  }

  let availableCount = touchedKeys.size;
  const today = todayLocalDateKey();
  if (fromKey <= today && toKey >= today) {
    const stats = getTechnicianWorkPageStats(technician);
    availableCount += Math.max(0, stats.awaitingTotal);
  }

  const maintainedCount = maintainedKeys.size;
  const ratePercent =
    availableCount > 0 ? Math.round((maintainedCount / availableCount) * 1000) / 10 : null;

  return {
    maintainedCount,
    availableCount,
    ratePercent,
    rateTone: ratePercent == null ? null : performanceRateTone(ratePercent),
    avgByFaultCause: averageBuckets(finishedRows, (row) => row.faultCause),
    avgByDeviceType: averageBuckets(finishedRows, (row) => row.deviceTypeName),
  };
}
