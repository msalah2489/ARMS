"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { RoleGuard } from "@/components/role-guard";
import {
  createOpsBranch,
  deleteOpsBranch,
  listOpsBranchRecords,
  updateOpsBranch,
} from "@/lib/branches-store";
import type { OpsBranchRecord } from "@/types/domain";

function emptyForm() {
  return { name: "", city: "", isServiceCenter: false };
}

function AdminBranchesContent() {
  const [branches, setBranches] = useState<OpsBranchRecord[]>([]);
  const [form, setForm] = useState(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    setBranches(listOpsBranchRecords());
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
        description="إضافة الفروع مع المدينة وكود تلقائي فريد، مع خيار اعتبار الفرع مركز صيانة."
      />

      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      {message ? <p className="text-sm text-aroma-700">{message}</p> : null}

      <section className="rounded-2xl border border-ink-900/10 bg-white p-5 shadow-panel">
        <h2 className="font-display text-xl">{editingId ? "تعديل فرع" : "إضافة فرع"}</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="block text-sm">
            اسم الفرع *
            <input
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-ink-900/15 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            المدينة *
            <input
              value={form.city}
              onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-ink-900/15 px-3 py-2"
            />
          </label>
          <label className="flex items-center gap-2 text-sm md:col-span-2">
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
            <p className="text-xs text-ink-700/60 md:col-span-2">
              كود الفرع ثابت بعد الإنشاء ولا يمكن تعديله لضمان عدم التكرار.
            </p>
          ) : (
            <p className="text-xs text-ink-700/60 md:col-span-2">
              يُنشأ كود الفرع تلقائيًا عند الحفظ (BR-xxxx للفروع أو SC-xxxx لمراكز الصيانة).
            </p>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            className="rounded-full bg-ink-900 px-5 py-2.5 text-sm text-white"
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
              className="rounded-full border border-ink-900/15 px-5 py-2.5 text-sm"
              onClick={resetForm}
            >
              إلغاء
            </button>
          ) : null}
        </div>
      </section>

      <section className="rounded-2xl border border-ink-900/10 bg-white p-5 shadow-panel">
        <h2 className="font-display text-xl">الفروع ({branches.length})</h2>
        <div className="mt-4 space-y-3">
          {branches.map((branch) => (
            <div
              key={branch.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink-900/10 px-4 py-3 text-sm"
            >
              <div>
                <p className="font-medium">
                  {branch.name}{" "}
                  <span className="text-xs text-ink-700/60">· {branch.code}</span>
                </p>
                <p className="text-xs text-ink-700/60">
                  {branch.city}
                  {branch.isServiceCenter ? " · مركز صيانة" : ""}
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  className="text-ink-900"
                  onClick={() => {
                    setEditingId(branch.id);
                    setForm({
                      name: branch.name,
                      city: branch.city,
                      isServiceCenter: branch.isServiceCenter,
                    });
                    setError(null);
                    setMessage(null);
                  }}
                >
                  تعديل
                </button>
                <button
                  type="button"
                  className="text-rose-700"
                  onClick={() => {
                    const result = deleteOpsBranch(branch.id);
                    if (!result.ok) {
                      setError(result.error);
                      return;
                    }
                    if (editingId === branch.id) resetForm();
                    setMessage(`تم حذف ${branch.name}.`);
                    refresh();
                  }}
                >
                  حذف
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default function AdminBranchesPage() {
  return (
    <RoleGuard allow={["system_admin", "manager"]}>
      <AdminBranchesContent />
    </RoleGuard>
  );
}
