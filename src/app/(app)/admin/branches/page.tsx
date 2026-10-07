"use client";

import { useEffect, useState } from "react";
import { BulkCsvImportBar } from "@/components/bulk-csv-import";
import { ExpandableSection } from "@/components/expandable-section";
import { PageHeader } from "@/components/page-header";
import { RoleGuard } from "@/components/role-guard";
import { isSystemAdminRole } from "@/lib/auth";
import {
  applyBranchesImportPreview,
  downloadBranchesImportTemplate,
  formatBranchPreviewActionAr,
  previewBranchesImportFile,
  type BranchImportPreviewRow,
} from "@/lib/bulk-branches-import";
import {
  createOpsBranch,
  listOpsBranchRecords,
  setOpsBranchActive,
  updateOpsBranch,
} from "@/lib/branches-store";
import { readSession } from "@/lib/session";
import type { OpsBranchRecord } from "@/types/domain";

function emptyForm() {
  return { name: "", city: "", isServiceCenter: false };
}

function BranchRow({
  branch,
  onEdit,
  onToggle,
}: {
  branch: OpsBranchRecord;
  onEdit: () => void;
  onToggle: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink-900/10 px-4 py-3 text-sm dark:border-white/10">
      <div>
        <p className="font-medium dark:text-sand-50">
          {branch.name} <span className="text-xs text-ink-700/60 dark:text-sand-100/60">· {branch.code}</span>
        </p>
        <p className="text-xs text-ink-700/60 dark:text-sand-100/60">
          {branch.city}
          {branch.isServiceCenter ? " · مركز صيانة" : ""}
          {!branch.isActive ? " · معطّل" : ""}
        </p>
      </div>
      <div className="flex gap-3">
        {branch.isActive ? (
          <>
            <button type="button" className="text-ink-900 dark:text-sand-50" onClick={onEdit}>
              تعديل
            </button>
            <button type="button" className="text-amber-700 dark:text-amber-300" onClick={onToggle}>
              تعطيل
            </button>
          </>
        ) : (
          <button type="button" className="text-aroma-700 dark:text-aroma-200" onClick={onToggle}>
            تفعيل
          </button>
        )}
      </div>
    </div>
  );
}

function AdminBranchesContent() {
  const [branches, setBranches] = useState<OpsBranchRecord[]>([]);
  const [form, setForm] = useState(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [canBulkImport, setCanBulkImport] = useState(false);
  const [pendingBranchImport, setPendingBranchImport] = useState<
    BranchImportPreviewRow[] | null
  >(null);

  const activeBranches = branches.filter((b) => b.isActive !== false);
  const disabledBranches = branches.filter((b) => b.isActive === false);

  function refresh() {
    setBranches(listOpsBranchRecords({ includeInactive: true }));
    const session = readSession();
    setCanBulkImport(session ? isSystemAdminRole(session.role) : false);
  }

  useEffect(() => {
    refresh();
    const onHydrated = () => refresh();
    window.addEventListener("arms-ops-hydrated", onHydrated);
    return () => window.removeEventListener("arms-ops-hydrated", onHydrated);
  }, []);

  function resetForm() {
    setForm(emptyForm());
    setEditingId(null);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="إدارة الفروع"
        description="إضافة الفروع مع المدينة وكود تلقائي فريد. التعطيل يُبقي السجل ويُخفي الفرع من الاختيارات النشطة."
      />

      {error ? <p className="text-sm text-rose-700 dark:text-rose-300">{error}</p> : null}
      {message ? <p className="text-sm text-aroma-700 dark:text-aroma-200">{message}</p> : null}

      {canBulkImport ? (
        <BulkCsvImportBar
          title="استيراد فروع من ملف Excel"
          hint="حمّل قالب Excel (قوائم منسدلة لمركز الصيانة والحالة). كود الفرع يُنشأ تلقائيًا ولا يظهر في القالب. راجع المعاينة ثم وافق وأكّد."
          onDownloadTemplate={downloadBranchesImportTemplate}
          onParseFile={async (file) => {
            setError(null);
            setMessage(null);
            const result = await previewBranchesImportFile(file);
            if (!result.ok) {
              setPendingBranchImport(null);
              return result;
            }
            setPendingBranchImport(result.rows);
            return {
              ok: true,
              columns: result.columns,
              validCount: result.validCount,
              errorCount: result.errorCount,
              rows: result.rows.map((row) => ({
                id: `b-${row.rowNum}`,
                hasError: row.plannedAction === "error",
                cells: {
                  rowNum: row.rowNum,
                  name: row.name || "—",
                  city: row.city || "—",
                  isServiceCenter: row.isServiceCenter ? "نعم" : "لا",
                  isActive: row.isActive ? "نعم" : "لا",
                  plannedAction: formatBranchPreviewActionAr(row.plannedAction),
                  error: row.error ?? "",
                },
              })),
            };
          }}
          onConfirmApply={async () => {
            if (!pendingBranchImport) {
              setError("لا توجد معاينة جاهزة للتسجيل.");
              throw new Error("no preview");
            }
            setError(null);
            setMessage(null);
            const result = await applyBranchesImportPreview(pendingBranchImport);
            if (!result.ok) {
              setError(result.error);
              throw new Error(result.error);
            }
            setPendingBranchImport(null);
            if (result.summary.failed > 0 && result.summary.created + result.summary.updated === 0) {
              setError(result.message);
            } else if (result.summary.failed > 0) {
              setMessage(result.message);
              setError(`اكتمل الاستيراد مع أخطاء (${result.summary.failed} صف فشل).`);
            } else {
              setMessage(result.message);
            }
            refresh();
          }}
        />
      ) : null}

      <ExpandableSection title={editingId ? "تعديل فرع" : "إضافة فرع"} defaultOpen>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm dark:text-sand-100">
            اسم الفرع *
            <input
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-ink-900/15 px-3 py-2 dark:border-white/15 dark:bg-ink-950 dark:text-sand-50"
            />
          </label>
          <label className="block text-sm dark:text-sand-100">
            المدينة *
            <input
              value={form.city}
              onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-ink-900/15 px-3 py-2 dark:border-white/15 dark:bg-ink-950 dark:text-sand-50"
            />
          </label>
          <label className="flex items-center gap-2 text-sm md:col-span-2 dark:text-sand-100">
            <input
              type="checkbox"
              checked={form.isServiceCenter}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, isServiceCenter: e.target.checked }))
              }
            />
            هذا الفرع مركز صيانة
          </label>
          {editingId ? (
            <p className="text-xs text-ink-700/60 md:col-span-2 dark:text-sand-100/60">
              كود الفرع ثابت بعد الإنشاء ولا يمكن تعديله لضمان عدم التكرار.
            </p>
          ) : (
            <p className="text-xs text-ink-700/60 md:col-span-2 dark:text-sand-100/60">
              يُنشأ كود الفرع تلقائيًا عند الحفظ (BR-xxxx للفروع أو SC-xxxx لمراكز الصيانة).
            </p>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            className="rounded-full bg-ink-900 px-5 py-2.5 text-sm text-white dark:bg-aroma-600"
            onClick={() => {
              setError(null);
              setMessage(null);
              const result = editingId
                ? updateOpsBranch(editingId, form)
                : createOpsBranch(form);
              if (!result.ok) {
                setError(result.error);
                return;
              }
              setMessage(
                editingId
                  ? `تم تحديث الفرع ${result.branch.name}.`
                  : `تم إنشاء الفرع ${result.branch.name} بالكود ${result.branch.code}.`,
              );
              resetForm();
              refresh();
            }}
          >
            {editingId ? "حفظ التعديل" : "إضافة الفرع"}
          </button>
          {editingId ? (
            <button
              type="button"
              className="rounded-full border border-ink-900/15 px-5 py-2.5 text-sm dark:border-white/15 dark:text-sand-50"
              onClick={resetForm}
            >
              إلغاء
            </button>
          ) : null}
        </div>
      </ExpandableSection>

      <ExpandableSection title={`الفروع النشطة (${activeBranches.length})`} defaultOpen>
        <div className="space-y-3">
          {activeBranches.length === 0 ? (
            <p className="text-sm text-ink-700/60 dark:text-sand-100/60">لا توجد فروع نشطة.</p>
          ) : (
            activeBranches.map((branch) => (
              <BranchRow
                key={branch.id}
                branch={branch}
                onEdit={() => {
                  setEditingId(branch.id);
                  setForm({
                    name: branch.name,
                    city: branch.city,
                    isServiceCenter: branch.isServiceCenter,
                  });
                  setError(null);
                  setMessage(null);
                }}
                onToggle={() => {
                  const result = setOpsBranchActive(branch.id, false);
                  if (!result.ok) {
                    setError(result.error);
                    return;
                  }
                  if (editingId === branch.id) resetForm();
                  setMessage(`تم تعطيل ${branch.name}. السجل محفوظ.`);
                  refresh();
                }}
              />
            ))
          )}
        </div>
      </ExpandableSection>

      <ExpandableSection title={`الفروع المعطّلة (${disabledBranches.length})`} defaultOpen={false}>
        <div className="space-y-3">
          {disabledBranches.length === 0 ? (
            <p className="text-sm text-ink-700/60 dark:text-sand-100/60">لا توجد فروع معطّلة.</p>
          ) : (
            disabledBranches.map((branch) => (
              <BranchRow
                key={branch.id}
                branch={branch}
                onEdit={() => undefined}
                onToggle={() => {
                  const result = setOpsBranchActive(branch.id, true);
                  if (!result.ok) {
                    setError(result.error);
                    return;
                  }
                  setMessage(`تم تفعيل ${branch.name}.`);
                  refresh();
                }}
              />
            ))
          )}
        </div>
      </ExpandableSection>
    </div>
  );
}

export default function AdminBranchesPage() {
  return (
    <RoleGuard allow={["system_admin", "manager"]} permission="manage_branches">
      <AdminBranchesContent />
    </RoleGuard>
  );
}
