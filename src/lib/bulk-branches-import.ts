import { upsertOpsBranchFromImport } from "@/lib/branches-store";
import {
  downloadCsvFile,
  formatBulkImportSummaryAr,
  parseCsvBoolean,
  parseCsvText,
  readFileAsText,
  type BulkImportSummary,
} from "@/lib/csv-excel";

/** Template columns matching branches-store / app_ops_branches fields. */
export const BRANCH_IMPORT_COLUMNS = [
  "name",
  "city",
  "code",
  "is_service_center",
  "is_active",
] as const;

const SAMPLE_BRANCH_ROW = ["فرع الدمام", "الدمام", "", "false", "true"];

export function downloadBranchesImportTemplate() {
  downloadCsvFile("arms-branches-template.csv", [...BRANCH_IMPORT_COLUMNS], [
    SAMPLE_BRANCH_ROW,
  ]);
}

export async function importBranchesFromCsvFile(
  file: File,
): Promise<{ ok: true; summary: BulkImportSummary; message: string } | { ok: false; error: string }> {
  const text = await readFileAsText(file);
  const { headers, rows } = parseCsvText(text);
  if (headers.length === 0) {
    return { ok: false, error: "الملف فارغ أو غير صالح." };
  }
  const required = ["name", "city"];
  const missing = required.filter((col) => !headers.includes(col));
  if (missing.length > 0) {
    return {
      ok: false,
      error: `أعمدة إلزامية ناقصة في القالب: ${missing.join(", ")}`,
    };
  }
  if (rows.length === 0) {
    return { ok: false, error: "لا توجد صفوف بيانات في الملف (بعد صف العناوين)." };
  }

  const summary: BulkImportSummary = {
    total: rows.length,
    created: 0,
    updated: 0,
    failed: 0,
    results: [],
  };

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const rowNum = i + 2;
    const name = (row.name ?? "").trim();
    const city = (row.city ?? "").trim();
    const code = (row.code ?? "").trim();
    const isServiceCenter = parseCsvBoolean(row.is_service_center, false);
    const isActive = parseCsvBoolean(row.is_active, true);

    if (!name || !city) {
      summary.failed += 1;
      summary.results.push({
        row: rowNum,
        ok: false,
        error: "حقول إلزامية ناقصة (name, city).",
      });
      continue;
    }

    const result = upsertOpsBranchFromImport({
      name,
      city,
      code: code || null,
      isServiceCenter,
      isActive,
    });

    if (!result.ok) {
      summary.failed += 1;
      summary.results.push({ row: rowNum, ok: false, error: result.error });
      continue;
    }

    if (result.created) {
      summary.created += 1;
      summary.results.push({
        row: rowNum,
        ok: true,
        action: "created",
        label: result.branch.code,
      });
    } else {
      summary.updated += 1;
      summary.results.push({
        row: rowNum,
        ok: true,
        action: "updated",
        label: result.branch.code,
      });
    }
  }

  return {
    ok: true,
    summary,
    message: formatBulkImportSummaryAr(summary),
  };
}
