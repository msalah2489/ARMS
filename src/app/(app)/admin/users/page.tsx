"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { RoleGuard } from "@/components/role-guard";
import {
  ASSIGNABLE_ROLES,
  ASSIGNABLE_ROLE_LABELS,
  createManagedUser,
  deleteManagedUser,
  listBranchOptionsForUsers,
  listManagedUsers,
  setManagedUserActive,
  updateManagedUserByAdmin,
} from "@/lib/users-store";
import type { AssignableUserRole, ManagedUser } from "@/types/domain";

function emptyForm() {
  return {
    fullName: "",
    username: "",
    email: "",
    mobile: "",
    role: "" as AssignableUserRole | "",
    opsBranchId: "",
    password: "demo",
    isActive: true,
  };
}

function AdminUsersContent() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [form, setForm] = useState(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const branches = useMemo(() => listBranchOptionsForUsers(), []);

  function refresh() {
    setUsers(listManagedUsers());
  }

  useEffect(() => {
    refresh();
  }, []);

  function resetForm() {
    setForm(emptyForm());
    setEditingId(null);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="إدارة المستخدمين"
        description="الاسم واسم المستخدم منفصلان. اسم المستخدم للدخول فقط ولا يُعدَّل بعد الإنشاء. يمكن تعطيل الحساب أو تغيير الفرع."
      />

      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      {message ? <p className="text-sm text-aroma-700">{message}</p> : null}

      <section className="rounded-2xl border border-ink-900/10 bg-white p-5 shadow-panel">
        <h2 className="font-display text-xl">
          {editingId ? "تعديل موظف" : "إضافة مستخدم"}
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="block text-sm">
            الاسم (اسم الشخص) *
            <input
              value={form.fullName}
              onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-ink-900/15 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            اسم المستخدم (للدخول) *
            <input
              value={form.username}
              onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))}
              disabled={Boolean(editingId)}
              placeholder="مثال: nora.branch"
              className="mt-1 w-full rounded-xl border border-ink-900/15 px-3 py-2 disabled:bg-sand-50"
            />
            {editingId ? (
              <span className="mt-1 block text-xs text-ink-700/50">لا يمكن تعديل اسم المستخدم.</span>
            ) : null}
          </label>
          <label className="block text-sm">
            رقم الجوال *
            <input
              value={form.mobile}
              onChange={(e) => setForm((prev) => ({ ...prev, mobile: e.target.value }))}
              placeholder="05xxxxxxxx"
              className="mt-1 w-full rounded-xl border border-ink-900/15 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            البريد الإلكتروني
            <input
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-ink-900/15 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            صلاحية المستخدم *
            <select
              value={form.role}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  role: e.target.value as AssignableUserRole | "",
                }))
              }
              className="mt-1 w-full rounded-xl border border-ink-900/15 px-3 py-2"
            >
              <option value="">اختر الصلاحية</option>
              {ASSIGNABLE_ROLES.map((role) => (
                <option key={role} value={role}>
                  {ASSIGNABLE_ROLE_LABELS[role]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            الفرع {form.role === "branch" ? "*" : "(اختياري)"}
            <select
              value={form.opsBranchId}
              onChange={(e) => setForm((prev) => ({ ...prev, opsBranchId: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-ink-900/15 px-3 py-2"
            >
              <option value="">بدون فرع</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            كلمة المرور {editingId ? "(اتركها إن لم تتغير)" : "الأولية"}
            <input
              value={form.password}
              onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-ink-900/15 px-3 py-2"
            />
          </label>
          {editingId ? (
            <label className="flex items-center gap-2 text-sm self-end pb-2">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
              />
              الحساب نشط (غير معطّل)
            </label>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            className="rounded-full bg-ink-900 px-5 py-2.5 text-sm text-white"
            onClick={() => {
              setError(null);
              setMessage(null);
              if (!form.role) {
                setError("صلاحية المستخدم إلزامية.");
                return;
              }
              if (editingId) {
                const result = updateManagedUserByAdmin(editingId, {
                  fullName: form.fullName,
                  email: form.email,
                  mobile: form.mobile,
                  role: form.role,
                  opsBranchId: form.opsBranchId || null,
                  password: form.password,
                  isActive: form.isActive,
                });
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                setMessage(`تم تحديث بيانات ${result.user.fullName}.`);
              } else {
                const result = createManagedUser({
                  fullName: form.fullName,
                  username: form.username,
                  email: form.email,
                  mobile: form.mobile,
                  role: form.role,
                  opsBranchId: form.opsBranchId || null,
                  password: form.password,
                });
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                setMessage(
                  `تم إنشاء ${result.user.fullName}. الدخول باسم المستخدم: ${result.user.username} / ${result.user.password}`,
                );
              }
              resetForm();
              refresh();
            }}
          >
            {editingId ? "حفظ التعديل" : "إضافة المستخدم"}
          </button>
          {editingId ? (
            <button
              type="button"
              className="rounded-full border border-ink-900/15 px-5 py-2.5 text-sm"
              onClick={resetForm}
            >
              إلغاء التعديل
            </button>
          ) : null}
        </div>
      </section>

      <section className="rounded-2xl border border-ink-900/10 bg-white p-5 shadow-panel">
        <h2 className="font-display text-xl">المستخدمون ({users.length})</h2>
        <div className="mt-4 space-y-3">
          {users.length === 0 ? (
            <p className="text-sm text-ink-700/60">لا يوجد مستخدمون مضافون بعد.</p>
          ) : (
            users.map((user) => (
              <div
                key={user.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink-900/10 px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-medium">
                    {user.fullName}{" "}
                    <span className="text-xs text-ink-700/60">
                      · @{user.username} · {ASSIGNABLE_ROLE_LABELS[user.role]}
                      {!user.isActive ? " · معطّل" : ""}
                    </span>
                  </p>
                  <p className="text-xs text-ink-700/60">
                    {user.mobile}
                    {user.email ? ` · ${user.email}` : ""}
                    {user.opsBranchName ? ` · ${user.opsBranchName}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    className="text-ink-900"
                    onClick={() => {
                      setEditingId(user.id);
                      setForm({
                        fullName: user.fullName,
                        username: user.username,
                        email: user.email.endsWith("@arms.local") ? "" : user.email,
                        mobile: user.mobile,
                        role: user.role,
                        opsBranchId: user.opsBranchId ?? "",
                        password: "",
                        isActive: user.isActive,
                      });
                      setMessage(null);
                      setError(null);
                    }}
                  >
                    تعديل
                  </button>
                  <button
                    type="button"
                    className={user.isActive ? "text-amber-700" : "text-aroma-700"}
                    onClick={() => {
                      const result = setManagedUserActive(user.id, !user.isActive);
                      if (!result.ok) {
                        setError(result.error);
                        return;
                      }
                      setMessage(
                        result.user.isActive
                          ? `تم تفعيل حساب ${result.user.fullName}.`
                          : `تم تعطيل حساب ${result.user.fullName}.`,
                      );
                      refresh();
                    }}
                  >
                    {user.isActive ? "تعطيل" : "تفعيل"}
                  </button>
                  <button
                    type="button"
                    className="text-rose-700"
                    onClick={() => {
                      const result = deleteManagedUser(user.id);
                      if (!result.ok) {
                        setError(result.error);
                        return;
                      }
                      if (editingId === user.id) resetForm();
                      setMessage(`تم حذف ${user.fullName}.`);
                      refresh();
                    }}
                  >
                    حذف
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

export default function AdminUsersPage() {
  return (
    <RoleGuard allow={["system_admin", "manager"]}>
      <AdminUsersContent />
    </RoleGuard>
  );
}
