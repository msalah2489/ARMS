/**
 * Client-side report export helpers (CSV / Excel / print-to-PDF).
 * Safe for static GitHub Pages — no server API.
 */

import { downloadCsvFile } from "@/lib/csv-excel";
import { downloadXlsxReport } from "@/lib/xlsx-excel";

const PRINT_IFRAME_ID = "arms-report-print-iframe";

function escapeHtml(value: string): string {
  return (value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function withExtension(filename: string, ext: ".csv" | ".xlsx"): string {
  const base = filename.replace(/\.(csv|xlsx)$/i, "");
  return `${base}${ext}`;
}

export function downloadReportCsv(
  filename: string,
  columns: string[],
  rows: string[][],
): void {
  downloadCsvFile(withExtension(filename, ".csv"), columns, rows);
}

export async function downloadReportExcel(
  filename: string,
  columns: string[],
  rows: string[][],
  options?: { sheetName?: string; rightToLeft?: boolean },
): Promise<void> {
  await downloadXlsxReport({
    filename: withExtension(filename, ".xlsx"),
    sheetName: options?.sheetName || "Report",
    columns,
    rows,
    rightToLeft: options?.rightToLeft,
  });
}

export type ReportPdfMeta = {
  title: string;
  subtitle?: string;
  dateRangeLabel?: string;
  generatedAtLabel?: string;
  rowsLabel?: string;
  locale?: "ar" | "en";
};

function getOrCreatePrintIframe(): HTMLIFrameElement {
  let iframe = document.getElementById(PRINT_IFRAME_ID) as HTMLIFrameElement | null;
  if (!iframe) {
    iframe = document.createElement("iframe");
    iframe.id = PRINT_IFRAME_ID;
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.style.opacity = "0";
    iframe.style.pointerEvents = "none";
    document.body.appendChild(iframe);
  }
  return iframe;
}

function buildReportPrintHtml(input: {
  meta: ReportPdfMeta;
  columns: string[];
  rows: string[][];
}): string {
  const dir = input.meta.locale === "en" ? "ltr" : "rtl";
  const lang = input.meta.locale === "en" ? "en" : "ar";
  const title = escapeHtml(input.meta.title);
  const subtitle = input.meta.subtitle ? escapeHtml(input.meta.subtitle) : "";
  const dateRange = input.meta.dateRangeLabel
    ? escapeHtml(input.meta.dateRangeLabel)
    : "";
  const generated = input.meta.generatedAtLabel
    ? escapeHtml(input.meta.generatedAtLabel)
    : "";
  const rowsLabel = input.meta.rowsLabel ? escapeHtml(input.meta.rowsLabel) : "";

  const headCells = input.columns
    .map((col) => `<th>${escapeHtml(col)}</th>`)
    .join("");
  const bodyRows =
    input.rows.length === 0
      ? `<tr><td colspan="${Math.max(1, input.columns.length)}">${
          lang === "ar" ? "لا توجد صفوف" : "No rows"
        }</td></tr>`
      : input.rows
          .map(
            (row) =>
              `<tr>${input.columns
                .map((_, idx) => `<td>${escapeHtml(row[idx] ?? "")}</td>`)
                .join("")}</tr>`,
          )
          .join("");

  return `<!DOCTYPE html><html lang="${lang}" dir="${dir}"><head><meta charset="utf-8" />
<title>${title}</title>
<style>
  @page { margin: 12mm; size: A4 landscape; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: Tahoma, "Segoe UI", Arial, sans-serif;
    color: #1a1a1a;
    font-size: 11px;
    line-height: 1.45;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .header { margin-bottom: 12px; border-bottom: 2px solid #2f5d50; padding-bottom: 8px; }
  h1 { margin: 0 0 4px; font-size: 18px; color: #1f3d34; }
  .meta { color: #444; margin: 2px 0; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  th, td {
    border: 1px solid #c9d5cf;
    padding: 5px 6px;
    text-align: start;
    vertical-align: top;
    word-wrap: break-word;
  }
  th {
    background: #e8f2ee;
    font-weight: 700;
    color: #1f3d34;
  }
  tr:nth-child(even) td { background: #f7faf8; }
  .footer { margin-top: 10px; color: #666; font-size: 10px; }
</style></head><body>
<div class="header">
  <h1>${title}</h1>
  ${subtitle ? `<p class="meta">${subtitle}</p>` : ""}
  ${dateRange ? `<p class="meta">${dateRange}</p>` : ""}
  ${rowsLabel ? `<p class="meta">${rowsLabel}</p>` : ""}
</div>
<table>
  <thead><tr>${headCells}</tr></thead>
  <tbody>${bodyRows}</tbody>
</table>
${generated ? `<p class="footer">${generated}</p>` : ""}
</body></html>`;
}

/**
 * Opens the browser print dialog for the current report table.
 * User can choose "Save as PDF" — works offline on static hosting.
 */
export function printReportAsPdf(input: {
  meta: ReportPdfMeta;
  columns: string[];
  rows: string[][];
}): void {
  if (typeof document === "undefined") return;

  const iframe = getOrCreatePrintIframe();
  const html = buildReportPrintHtml(input);
  const doc = iframe.contentDocument;
  const win = iframe.contentWindow;
  if (!doc || !win) return;

  doc.open();
  doc.write(html);
  doc.close();

  const triggerPrint = () => {
    try {
      win.focus();
      win.print();
    } catch {
      // ignore print abort
    }
  };

  // Allow layout/fonts to settle before print
  window.setTimeout(triggerPrint, 80);
}
