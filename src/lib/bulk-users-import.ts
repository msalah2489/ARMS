import {
  downloadCsvFile,
  formatBulkImportSummaryAr,
  parseCsvBoolean,
  parseCsvText,
  readFileAsText,
  type BulkImportSummary,
} from "@/lib/csv-excel";
import {
  ASSIGNABLE_ROLE_LABELS,
  ASSIGNABLE_ROLES,
  createManagedUser,
  listBranchOptionsForUsers,
  listManagedUsers,
  updateManagedUserByAdmin,
} from "@/lib/users-store";
import type { AssignableUserRole } from "@/types/domain";

/** Template columns matching create-user fields (Excel/CSV). */
export const USER_IMPORT_COLUMNS = [
  "username",
  "full_name",
  "password",
  "role",
  "mobile",
  "email",
  "ops_branch_id",
  "ops_branch_name",
  "is_active",
] as const;

const SAMPLE_USER_ROW = [
  "nora.branch",
  "نورة الفرع",
  "demo",
  "branch",
  "0500000099",
  "nora@example.com",
  "",
  "فرع الرياض",
  "true",
];

export function downloadUsersImportTemplate() {
  downloadCsvFile("arms-users-template.csv", [...USER_IMPORT_COLUMNS], [SAMPLE_USER_ROW]);
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

function resolveBranchId(
  opsBranchId: string,
  opsBranchName: string,
): { id: string | null; error?: string } {
  const branches = listBranchOptionsForUsers();
  const id = opsBranchId.trim();
  const name = opsBranchName.trim();
  if (id) {
    const byId = branches.find((b) => b.id === id);
    if (!byId) return { id: null, error: `معرّف الفرع غير موجود: ${id}` };
    return { id: byId.id };
  }
  if (name) {
    const matches = branches.filter(
      (b) => b.name === name || b.name.replace(/\s*\(مركز صيانة\)\s*$/, "") === name,
    );
    if (matches.length === 0) {
      return { id: null, error: `اسم الفرع غير موجود: ${name}` };
    }
    if (matches.length > 1) {
      return {
        id: null,
        error: `يوجد أكثر من فرع بنفس الاسم «${name}». استخدم ops_branch_id.`,
      };
    }
    return { id: matches[0].id };
  }
  return { id: null };
}

export async function importUsersFromCsvFile(
  file: File,
  actor?: { id: string; role: string } | null,
): Promise<{ ok: true; summary: BulkImportSummary; message: string } | { ok: false; error: string }> {
  const text = await readFileAsText(file);
  const { headers, rows } = parseCsvText(text);
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

  const summary: BulkImportSummary = {
    total: rows.length,
    created: 0,
    updated: 0,
    failed: 0,
    results: [],
  };

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const rowNum = i + 2; // 1-based + header
    const username = (row.username ?? "").trim();
    const fullName = (row.full_name ?? "").trim();
    const password = (row.password ?? "").trim();
    const role = resolveRole(row.role ?? "");
    const mobile = (row.mobile ?? "").trim();
    const email = (row.email ?? "").trim();
    const isActive = parseCsvBoolean(row.is_active, true);

    if (!username || !fullName || !role || !mobile) {
      summary.failed += 1;
      summary.results.push({
        row: rowNum,
        ok: false,
        error: "حقول إلزامية ناقصة (username, full_name, role, mobile).",
      });
      continue;
    }

    const branch = resolveBranchId(row.ops_branch_id ?? "", row.ops_branch_name ?? "");
    if (branch.error) {
      summary.failed += 1;
      summary.results.push({ row: rowNum, ok: false, error: branch.error });
      continue;
    }

    const existing = listManagedUsers({ includeArchived: true }).find(
      (u) => u.username.toLowerCase() === username.toLowerCase(),
    );

    try {
      if (existing) {
        const result = await updateManagedUserByAdmin(existing.id, {
          fullName,
          username,
          email: email || undefined,
          mobile,
          role,
          opsBranchId: branch.id,
          password: password || undefined,
          isActive,
          actor: actor ?? null,
        });
        if (!result.ok) {
          summary.failed += 1;
          summary.results.push({ row: rowNum, ok: false, error: result.error });
          continue;
        }
        summary.updated += 1;
        summary.results.push({
          row: rowNum,
          ok: true,
          action: "updated",
          label: result.user.username,
        });
      } else {
        const result = await createManagedUser({
          fullName,
          username,
          email: email || undefined,
          mobile,
          role,
          opsBranchId: branch.id,
          password: password || "demo",
        });
        if (!result.ok) {
          summary.failed += 1;
          summary.results.push({ row: rowNum, ok: false, error: result.error });
          continue;
        }
        if (!isActive) {
          const { setManagedUserActive } = await import("@/lib/users-store");
          await setManagedUserActive(result.user.id, false);
        }
        summary.created += 1;
        summary.results.push({
          row: rowNum,
          ok: true,
          action: "created",
          label: result.user.username,
        });
      }
    } catch (error) {
      summary.failed += 1;
      summary.results.push({
        row: rowNum,
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

export function usersImportRoleHintAr(): string {
  return ASSIGNABLE_ROLES.map((r) => `${r} (${ASSIGNABLE_ROLE_LABELS[r]})`).join("، ");
}
