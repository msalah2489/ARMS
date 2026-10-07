/**
 * Lightweight CSV helpers for Excel-compatible import/export (UTF-8 BOM for Arabic).
 * Prefer CSV over xlsx to avoid heavy dependencies.
 */

export function escapeCsvCell(value: string): string {
  const text = value ?? "";
  if (/[",\n\r]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

export function downloadCsvFile(filename: string, columns: string[], rows: string[][]) {
  if (typeof document === "undefined") return;
  const lines = [
    columns.map(escapeCsvCell).join(","),
    ...rows.map((row) => row.map(escapeCsvCell).join(",")),
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

/** Parse one CSV line respecting quoted fields. */
function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      cells.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  cells.push(current);
  return cells.map((cell) => cell.trim());
}

/**
 * Parse CSV text into header + row objects (keys = normalized header names).
 * Skips empty lines. Header names are lowercased and trimmed.
 */
export function parseCsvText(text: string): {
  headers: string[];
  rows: Record<string, string>[];
} {
  const cleaned = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = cleaned.split("\n").filter((line) => line.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cells = parseCsvLine(lines[i]);
    if (cells.every((c) => !c.trim())) continue;
    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      row[header] = (cells[idx] ?? "").trim();
    });
    rows.push(row);
  }
  return { headers, rows };
}

export async function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("تعذر قراءة الملف."));
    reader.readAsText(file, "UTF-8");
  });
}

/** Parse yes/no / true/false / 1/0 / نعم/لا into boolean. Empty → defaultValue. */
export function parseCsvBoolean(
  value: string | undefined,
  defaultValue = true,
): boolean {
  const raw = (value ?? "").trim().toLowerCase();
  if (!raw) return defaultValue;
  if (["1", "true", "yes", "y", "نعم", "نشط", "active"].includes(raw)) return true;
  if (["0", "false", "no", "n", "لا", "معطل", "معطّل", "inactive"].includes(raw)) {
    return false;
  }
  return defaultValue;
}

export type BulkImportRowResult = {
  row: number;
  ok: boolean;
  action?: "created" | "updated";
  label?: string;
  error?: string;
};

export type BulkImportSummary = {
  total: number;
  created: number;
  updated: number;
  failed: number;
  results: BulkImportRowResult[];
};

export function formatBulkImportSummaryAr(summary: BulkImportSummary): string {
  const parts = [
    `إجمالي الصفوف: ${summary.total}`,
    `أُنشئ: ${summary.created}`,
    `حُدّث: ${summary.updated}`,
    `فشل: ${summary.failed}`,
  ];
  const errors = summary.results
    .filter((r) => !r.ok)
    .slice(0, 8)
    .map((r) => `صف ${r.row}: ${r.error ?? "خطأ"}`);
  if (errors.length > 0) {
    parts.push("أخطاء: " + errors.join(" · "));
    if (summary.failed > errors.length) {
      parts.push(`(+${summary.failed - errors.length} أخطاء أخرى)`);
    }
  }
  return parts.join(" — ");
}
