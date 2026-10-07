/**
 * Excel (.xlsx) helpers via exceljs: templates with dropdowns + parse upload sheets.
 * Still accepts CSV for older files. exceljs is loaded only in the browser on demand.
 */

import { parseCsvText, readFileAsText } from "@/lib/csv-excel";

export const YES_NO_AR = ["نعم", "لا"] as const;

export type XlsxDropdownColumn = {
  /** 1-based Excel column index */
  col: number;
  /** Header key (English, used for parsing) */
  header: string;
  /** Values shown in the dropdown */
  list: string[];
};

export type XlsxTemplateSpec = {
  filename: string;
  sheetName: string;
  columns: string[];
  sampleRow?: string[];
  dropdowns: XlsxDropdownColumn[];
  /** Extra note rows under the sample (Arabic guidance). */
  notes?: string[];
};

type ExcelCellValue = string | number | boolean | Date | null | undefined | object;

// exceljs typings omit some browser worksheet APIs (e.g. dataValidations).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ExcelJSModule = { Workbook: new () => any };

async function loadExcelJS(): Promise<ExcelJSModule> {
  const mod = await import("exceljs");
  return (mod.default ?? mod) as ExcelJSModule;
}

function colLetter(col: number): string {
  let n = col;
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export async function downloadXlsxTemplate(spec: XlsxTemplateSpec): Promise<void> {
  if (typeof document === "undefined") return;

  const ExcelJS = await loadExcelJS();
  const wb = new ExcelJS.Workbook();
  wb.creator = "ARMS";
  const sheet = wb.addWorksheet(spec.sheetName, {
    views: [{ rightToLeft: true }],
  });
  const lists = wb.addWorksheet("_lists");
  lists.state = "hidden";

  sheet.addRow(spec.columns);
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.alignment = { horizontal: "center" };

  if (spec.sampleRow && spec.sampleRow.length > 0) {
    sheet.addRow(spec.sampleRow);
  }

  spec.columns.forEach((_, idx) => {
    sheet.getColumn(idx + 1).width = Math.max(14, spec.columns[idx].length + 4);
  });

  const dataStart = 2;
  const dataEnd = 500;

  spec.dropdowns.forEach((dd, listIdx) => {
    const listCol = listIdx + 1;
    dd.list.forEach((value, i) => {
      lists.getCell(i + 1, listCol).value = value;
    });
    const listEnd = Math.max(1, dd.list.length);
    const listColLetter = colLetter(listCol);
    const formula = `'_lists'!$${listColLetter}$1:$${listColLetter}$${listEnd}`;
    const targetCol = colLetter(dd.col);
    sheet.dataValidations.add(`${targetCol}${dataStart}:${targetCol}${dataEnd}`, {
      type: "list",
      allowBlank: true,
      formulae: [formula],
      showErrorMessage: true,
      errorTitle: "قيمة غير صالحة",
      error: "اختر قيمة من القائمة المنسدلة.",
      showInputMessage: true,
      promptTitle: dd.header,
      prompt: "اختر من القائمة",
    });
  });

  if (spec.notes && spec.notes.length > 0) {
    const noteSheet = wb.addWorksheet("تعليمات", {
      views: [{ rightToLeft: true }],
    });
    noteSheet.getColumn(1).width = 80;
    spec.notes.forEach((note, i) => {
      noteSheet.getCell(i + 1, 1).value = note;
    });
  }

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer as ArrayBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = spec.filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function cellToString(value: ExcelCellValue): string {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value).trim();
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    if ("text" in value && typeof (value as { text?: string }).text === "string") {
      return (value as { text: string }).text.trim();
    }
    if ("result" in value) {
      const result = (value as { result?: ExcelCellValue }).result;
      return cellToString(result ?? "");
    }
    if ("richText" in value && Array.isArray((value as { richText: { text: string }[] }).richText)) {
      return (value as { richText: { text: string }[] }).richText.map((t) => t.text).join("").trim();
    }
  }
  return String(value).trim();
}

export async function parseSpreadsheetFile(
  file: File,
): Promise<{ headers: string[]; rows: Record<string, string>[] }> {
  const name = file.name.toLowerCase();
  const isXlsx =
    name.endsWith(".xlsx") ||
    name.endsWith(".xlsm") ||
    file.type.includes("spreadsheetml") ||
    file.type.includes("excel");

  if (!isXlsx && (name.endsWith(".csv") || name.endsWith(".txt") || file.type.includes("csv"))) {
    const text = await readFileAsText(file);
    return parseCsvText(text);
  }

  // Default: try xlsx first, fall back to CSV text
  if (isXlsx || name.endsWith(".xls")) {
    const ExcelJS = await loadExcelJS();
    const buffer = await file.arrayBuffer();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    const sheet =
      wb.worksheets.find((s: { name: string }) => s.name !== "_lists" && s.name !== "تعليمات") ??
      wb.worksheets[0];
    if (!sheet) return { headers: [], rows: [] };

    const matrix: string[][] = [];
    sheet.eachRow(
      { includeEmpty: false },
      (row: {
        eachCell: (
          opts: { includeEmpty: boolean },
          cb: (cell: { value: ExcelCellValue }, colNumber: number) => void,
        ) => void;
      }) => {
        const values: string[] = [];
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          while (values.length < colNumber - 1) values.push("");
          values[colNumber - 1] = cellToString(cell.value);
        });
        if (values.some((v) => v.trim())) matrix.push(values);
      },
    );

    if (matrix.length === 0) return { headers: [], rows: [] };
    const headers = matrix[0].map((h) => h.trim().toLowerCase());
    const rows: Record<string, string>[] = [];
    for (let i = 1; i < matrix.length; i += 1) {
      const cells = matrix[i];
      if (cells.every((c) => !c.trim())) continue;
      const row: Record<string, string> = {};
      headers.forEach((header, idx) => {
        if (!header) return;
        row[header] = (cells[idx] ?? "").trim();
      });
      rows.push(row);
    }
    return { headers, rows };
  }

  const text = await readFileAsText(file);
  return parseCsvText(text);
}

export function parseYesNoAr(
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
