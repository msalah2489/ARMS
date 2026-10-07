import {
  formatBulkImportSummaryAr,
  type BulkImportSummary,
} from "@/lib/csv-excel";
import {
  downloadXlsxTemplate,
  parseSpreadsheetFile,
  parseYesNoAr,
  YES_NO_AR,
} from "@/lib/xlsx-excel";
import {
  ASSIGNABLE_ROLE_LABELS,
  ASSIGNABLE_ROLES,
  createManagedUser,
  listBranchOptionsForUsers,
  listManagedUsers,
  updateManagedUserByAdmin,
} from "@/lib/users-store";
import type { AssignableUserRole } from "@/types/domain";

/** Admin-fillable columns only (no auto-generated IDs). */
export const USER_IMPORT_COLUMNS = [
  "username",
  "full_name",
  "password",
  "role",
  "mobile",
  "email",
  "ops_branch_name",
  "is_active",
] as const;

export type UserImportPreviewRow = {
  rowNum: number;
  username: string;
  fullName: string;
  password: string;
  role: AssignableUserRole | null;
  roleLabel: string;
  mobile: string;
  email: string;
  opsBranchName: string;
  opsBranchId: string | null;
  isActive: boolean;
  plannedAction: "create" | "update" | "error";
  error?: string;
};

export type UserImportPreview = {
  ok: true;
  columns: { key: string; label: string }[];
  rows: UserImportPreviewRow[];
  validCount: number;
  errorCount: number;
};

const PREVIEW_COLUMNS: { key: string; label: string }[] = [
  { key: "rowNum", label: "صف" },
  { key: "username", label: "اسم المستخدم" },
  { key: "fullName", label: "الاسم" },
  { key: "roleLabel", label: "الدور" },
  { key: "mobile", label: "الجوال" },
  { key: "email", label: "البريد" },
  { key: "opsBranchName", label: "الفرع" },
  { key: "isActive", label: "نشط" },
  { key: "plannedAction", label: "الإجراء" },
  { key: "error", label: "ملاحظة" },
];

function roleDropdownLabels(): string[] {
  return ASSIGNABLE_ROLES.map((r) => ASSIGNABLE_ROLE_LABELS[r]);
}

function resolveRole(raw: string): AssignableUserRole | null {
  const value = raw.trim();
  if (!value) return null;
  const lower = value.toLowerCase();
  if ((ASSIGNABLE_ROLES as string[]).includes(lower)) {
    return lower as AssignableUserRole;
  }
  const byLabel = (
    Object.entries(ASSIGNABLE_ROLE_LABELS) as [AssignableUserRole, string][]
  ).find(([, label]) => label === value || label.toLowerCase() === lower);
  return byLabel?.[0] ?? null;
}

function resolveBranchByName(opsBranchName: string): {
  id: string | null;
  error?: string;
} {
  const name = opsBranchName.trim();
  if (!name) return { id: null };
  const branches = listBranchOptionsForUsers();
  const matches = branches.filter(
    (b) =>
      b.name === name ||
      b.name.replace(/\s*\(مركز صيانة\)\s*$/, "") === name,
  );
  if (matches.length === 0) {
    return { id: null, error: `اسم الفرع غير موجود: ${name}` };
  }
  if (matches.length > 1) {
    return {
      id: null,
      error: `يوجد أكثر من فرع بنفس الاسم «${name}». راجع أسماء الفروع.`,
    };
  }
  return { id: matches[0].id };
}

export async function downloadUsersImportTemplate() {
  const branchNames = listBranchOptionsForUsers().map((b) => b.name);
  const sampleRole = ASSIGNABLE_ROLE_LABELS.branch;
  const sampleBranch = branchNames[0] ?? "";

  await downloadXlsxTemplate({
    filename: "arms-users-template.xlsx",
    sheetName: "مستخدمين",
    columns: [...USER_IMPORT_COLUMNS],
    sampleRow: [
      "nora.branch",
      "نورة الفرع",
      "demo",
      sampleRole,
      "0500000099",
      "nora@example.com",
      sampleBranch,
      "نعم",
    ],
    dropdowns: [
      { col: 4, header: "role", list: roleDropdownLabels() },
      {
        col: 7,
        header: "ops_branch_name",
        list: branchNames.length > 0 ? branchNames : ["— لا فروع —"],
      },
      { col: 8, header: "is_active", list: [...YES_NO_AR] },
    ],
    notes: [
      "املأ الصفوف فقط — لا تغيّر عناوين الأعمدة في الصف الأول.",
      "الدور والفرع والحالة (نشط) تُختار من القوائم المنسدلة.",
      "لا يوجد عمود لمعرّف الفرع؛ النظام يربطه تلقائيًا من اسم الفرع.",
      "كلمة المرور اختيارية عند التحديث؛ للمستخدم الجديد إن تُركت فارغة تُستخدم demo.",
      "المطابقة للتحديث تتم عبر اسم المستخدم (username).",
      `الأدوار: ${usersImportRoleHintAr()}`,
    ],
  });
}

export async function previewUsersImportFile(
  file: File,
): Promise<UserImportPreview | { ok: false; error: string }> {
  const { headers, rows } = await parseSpreadsheetFile(file);
  if (headers.length === 0) {
    return { ok: false, error: "الملف فارغ أو غير صالح." };
  }
  const required = ["username", "full_name", "role", "mobile"];
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

  const previewRows: UserImportPreviewRow[] = rows.map((row, i) => {
    const rowNum = i + 2;
    const username = (row.username ?? "").trim();
    const fullName = (row.full_name ?? "").trim();
    const password = (row.password ?? "").trim();
    const role = resolveRole(row.role ?? "");
    const mobile = (row.mobile ?? "").trim();
    const email = (row.email ?? "").trim();
    const opsBranchName = (row.ops_branch_name ?? "").trim();
    const isActive = parseYesNoAr(row.is_active, true);
    const branch = resolveBranchByName(opsBranchName);

    let error: string | undefined;
    if (!username || !fullName || !role || !mobile) {
      error = "حقول إلزامية ناقصة (username, full_name, role, mobile).";
    } else if (branch.error) {
      error = branch.error;
    }

    const existing = !error
      ? listManagedUsers({ includeArchived: true }).find(
          (u) => u.username.toLowerCase() === username.toLowerCase(),
        )
      : undefined;

    return {
      rowNum,
      username,
      fullName,
      password,
      role,
      roleLabel: role ? ASSIGNABLE_ROLE_LABELS[role] : (row.role ?? "").trim(),
      mobile,
      email,
      opsBranchName,
      opsBranchId: branch.id,
      isActive,
      plannedAction: error ? "error" : existing ? "update" : "create",
      error,
    };
  });

  return {
    ok: true,
    columns: PREVIEW_COLUMNS,
    rows: previewRows,
    validCount: previewRows.filter((r) => r.plannedAction !== "error").length,
    errorCount: previewRows.filter((r) => r.plannedAction === "error").length,
  };
}

export async function applyUsersImportPreview(
  rows: UserImportPreviewRow[],
  actor?: { id: string; role: string } | null,
): Promise<{ ok: true; summary: BulkImportSummary; message: string } | { ok: false; error: string }> {
  const toApply = rows.filter((r) => r.plannedAction !== "error");
  if (toApply.length === 0) {
    return { ok: false, error: "لا توجد صفوف صالحة للتسجيل. راجع الأخطاء في المعاينة." };
  }

  const summary: BulkImportSummary = {
    total: toApply.length,
    created: 0,
    updated: 0,
    failed: 0,
    results: [],
  };

  for (const row of toApply) {
    if (!row.role) {
      summary.failed += 1;
      summary.results.push({
        row: row.rowNum,
        ok: false,
        error: "دور غير صالح.",
      });
      continue;
    }

    const existing = listManagedUsers({ includeArchived: true }).find(
      (u) => u.username.toLowerCase() === row.username.toLowerCase(),
    );

    try {
      if (existing) {
        const result = await updateManagedUserByAdmin(existing.id, {
          fullName: row.fullName,
          username: row.username,
          email: row.email || undefined,
          mobile: row.mobile,
          role: row.role,
          opsBranchId: row.opsBranchId,
          password: row.password || undefined,
          isActive: row.isActive,
          actor: actor ?? null,
        });
        if (!result.ok) {
          summary.failed += 1;
          summary.results.push({ row: row.rowNum, ok: false, error: result.error });
          continue;
        }
        summary.updated += 1;
        summary.results.push({
          row: row.rowNum,
          ok: true,
          action: "updated",
          label: result.user.username,
        });
      } else {
        const result = await createManagedUser({
          fullName: row.fullName,
          username: row.username,
          email: row.email || undefined,
          mobile: row.mobile,
          role: row.role,
          opsBranchId: row.opsBranchId,
          password: row.password || "demo",
        });
        if (!result.ok) {
          summary.failed += 1;
          summary.results.push({ row: row.rowNum, ok: false, error: result.error });
          continue;
        }
        if (!row.isActive) {
          const { setManagedUserActive } = await import("@/lib/users-store");
          await setManagedUserActive(result.user.id, false);
        }
        summary.created += 1;
        summary.results.push({
          row: row.rowNum,
          ok: true,
          action: "created",
          label: result.user.username,
        });
      }
    } catch (error) {
      summary.failed += 1;
      summary.results.push({
        row: row.rowNum,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    ok: true,
    summary,
    message: formatBulkImportSummaryAr(summary),
  };
}

/** @deprecated Prefer preview + apply flow. Kept for compatibility. */
export async function importUsersFromCsvFile(
  file: File,
  actor?: { id: string; role: string } | null,
): Promise<{ ok: true; summary: BulkImportSummary; message: string } | { ok: false; error: string }> {
  const preview = await previewUsersImportFile(file);
  if (!preview.ok) return preview;
  return applyUsersImportPreview(preview.rows, actor);
}

export function usersImportRoleHintAr(): string {
  return ASSIGNABLE_ROLES.map((r) => `${r} (${ASSIGNABLE_ROLE_LABELS[r]})`).join("، ");
}

export function formatUserPreviewActionAr(action: UserImportPreviewRow["plannedAction"]): string {
  if (action === "create") return "إنشاء";
  if (action === "update") return "تحديث";
  return "خطأ";
}
