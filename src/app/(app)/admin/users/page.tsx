"use client";

import { useEffect, useMemo, useState } from "react";
import { ExpandableSection } from "@/components/expandable-section";
import { PageHeader } from "@/components/page-header";
import { RoleGuard } from "@/components/role-guard";
import {
  ASSIGNABLE_ROLES,
  ASSIGNABLE_ROLE_LABELS,
  archiveManagedUser,
  createManagedUser,
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

function UserRow({
  user,
  onEdit,
  onToggleActive,
  onArchive,
  onUnarchive,
}: {
  user: ManagedUser;
  onEdit: () => void;
  onToggleActive: () => void;
  onArchive?: () => void;
  onUnarchive?: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink-900/10 px-4 py-3 text-sm dark:border-white/10">
      <div>
        <p className="font-medium dark:text-sand-50">
          {user.fullName}{" "}
          <span className="text-xs text-ink-700/60 dark:text-sand-100/60">
            · @{user.username} · {ASSIGNABLE_ROLE_LABELS[user.role]}
            {!user.isActive ? " · معطّل" : ""}
            {user.isArchived ? " · مؤرشف" : ""}
          </span>
        </p>
        <p className="text-xs text-ink-700/60 dark:text-sand-100/60">
          {user.mobile}
          {user.email ? ` · ${user.email}` : ""}
          {user.opsBranchName ? ` · ${user.opsBranchName}` : ""}
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        {!user.isArchived ? (
          <>
            <button type="button" className="text-ink-900 dark:text-sand-50" onClick={onEdit}>
              تعديل
            </button>
            <button
              type="button"
              className={
                user.isActive
                  ? "text-amber-700 dark:text-amber-300"
                  : "text-aroma-700 dark:text-aroma-200"
              }
              onClick={onToggleActive}
            >
              {user.isActive ? "تعطيل" : "تفعيل"}
            </button>
            <button type="button" className="text-rose-700 dark:text-rose-300" onClick={onArchive}>
              أرشفة
            </button>
          </>
        ) : (
          <button type="button" className="text-aroma-700 dark:text-aroma-200" onClick={onUnarchive}>
            إلغاء الأرشفة
          </button>
        )}
      </div>
    </div>
  );
}

function AdminUsersContent() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [form, setForm] = useState(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const branches = useMemo(() => listBranchOptionsForUsers(), []);
  const activeUsers = users.filter((u) => !u.isArchived);
  const archivedUsers = users.filter((u) => u.isArchived);

  function refresh() {
    setUsers(listManagedUsers({ includeArchived: true }));
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
        title="إدارة المستخدمين"
        description="الاسم واسم المستخدم منفصلان. اسم المستخدم للدخول ويمكن تعديله (يجب أن يكون فريدًا). الأرشفة تحفظ السجل وتُخفي المستخدم من القوائم النشطة."
      />

      {error ? <p className="text-sm text-rose-700 dark:text-rose-300">{error}</p> : null}
      {message ? <p className="text-sm text-aroma-700 dark:text-aroma-200">{message}</p> : null}

      <ExpandableSection title={editingId ? "تعديل موظف" : "إضافة مستخدم"} defaultOpen>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm dark:text-sand-100">
            الاسم (اسم الشخص) *
            <input
              value={form.fullName}
              onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-ink-900/15 px-3 py-2 dark:border-white/15 dark:bg-ink-950 dark:text-sand-50"
            />
          </label>
          <label className="block text-sm dark:text-sand-100">
            اسم المستخدم (للدخول) *
            <input
              value={form.username}
              onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))}
              placeholder="مثال: nora.branch"
              className="mt-1 w-full rounded-xl border border-ink-900/15 px-3 py-2 dark:border-white/15 dark:bg-ink-950 dark:text-sand-50"
            />
            <span className="mt-1 block text-xs text-ink-700/50 dark:text-sand-100/50">
              3–32 حرفًا (إنجليزي/أرقام . _ -). يجب أن يكون فريدًا.
            </span>
          </label>
          <label className="block text-sm dark:text-sand-100">
            رقم الجوال *
            <input
              value={form.mobile}
              onChange={(e) => setForm((prev) => ({ ...prev, mobile: e.target.value }))}
              placeholder="05xxxxxxxx"
              className="mt-1 w-full rounded-xl border border-ink-900/15 px-3 py-2 dark:border-white/15 dark:bg-ink-950 dark:text-sand-50"
            />
          </label>
          <label className="block text-sm dark:text-sand-100">
            البريد الإلكتروني
            <input
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-ink-900/15 px-3 py-2 dark:border-white/15 dark:bg-ink-950 dark:text-sand-50"
            />
          </label>
          <label className="block text-sm dark:text-sand-100">
            صلاحية المستخدم *
            <select
              value={form.role}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  role: e.target.value as AssignableUserRole | "",
                }))
              }
              className="mt-1 w-full rounded-xl border border-ink-900/15 px-3 py-2 dark:border-white/15 dark:bg-ink-950 dark:text-sand-50"
            >
              <option value="">اختر الصلاحية</option>
              {ASSIGNABLE_ROLES.map((role) => (
                <option key={role} value={role}>
                  {ASSIGNABLE_ROLE_LABELS[role]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm dark:text-sand-100">
            الفرع {form.role === "branch" ? "*" : "(اختياري)"}
            <select
              value={form.opsBranchId}
              onChange={(e) => setForm((prev) => ({ ...prev, opsBranchId: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-ink-900/15 px-3 py-2 dark:border-white/15 dark:bg-ink-950 dark:text-sand-50"
            >
              <option value="">بدون فرع</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm dark:text-sand-100">
            كلمة المرور {editingId ? "(اتركها إن لم تتغير)" : "الأولية"}
            <input
              value={form.password}
              onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-ink-900/15 px-3 py-2 dark:border-white/15 dark:bg-ink-950 dark:text-sand-50"
            />
          </label>
          {editingId ? (
            <label className="flex items-center gap-2 self-end pb-2 text-sm dark:text-sand-100">
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
            className="rounded-full bg-ink-900 px-5 py-2.5 text-sm text-white dark:bg-aroma-600"
            onClick={() => {
              void (async () => {
                setError(null);
                setMessage(null);
                if (!form.role) {
                  setError("صلاحية المستخدم إلزامية.");
                  return;
                }
                if (editingId) {
                  const result = await updateManagedUserByAdmin(editingId, {
                    fullName: form.fullName,
                    username: form.username,
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
                  setMessage(
                    `تم تحديث بيانات ${result.user.fullName}. اسم الدخول: ${result.user.username}`,
                  );
                } else {
                  const result = await createManagedUser({
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
              })();
            }}
          >
            {editingId ? "حفظ التعديل" : "إضافة المستخدم"}
          </button>
          {editingId ? (
            <button
              type="button"
              className="rounded-full border border-ink-900/15 px-5 py-2.5 text-sm dark:border-white/15 dark:text-sand-50"
              onClick={resetForm}
            >
              إلغاء التعديل
            </button>
          ) : null}
        </div>
      </ExpandableSection>

      <ExpandableSection title={`المستخدمون النشطون (${activeUsers.length})`} defaultOpen>
        <div className="space-y-3">
          {activeUsers.length === 0 ? (
            <p className="text-sm text-ink-700/60 dark:text-sand-100/60">لا يوجد مستخدمون نشطون.</p>
          ) : (
            activeUsers.map((user) => (
              <UserRow
                key={user.id}
                user={user}
                onEdit={() => {
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
                onToggleActive={() => {
                  void (async () => {
                    const result = await setManagedUserActive(user.id, !user.isActive);
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
                  })();
                }}
                onArchive={() => {
                  void (async () => {
                    const result = await archiveManagedUser(user.id, true);
                    if (!result.ok) {
                      setError(result.error);
                      return;
                    }
                    if (editingId === user.id) resetForm();
                    setMessage(`تم أرشفة ${user.fullName}. السجل محفوظ.`);
                    refresh();
                  })();
                }}
              />
            ))
          )}
        </div>
      </ExpandableSection>

      <ExpandableSection title={`المؤرشفون (${archivedUsers.length})`} defaultOpen={false}>
        <div className="space-y-3">
          {archivedUsers.length === 0 ? (
            <p className="text-sm text-ink-700/60 dark:text-sand-100/60">لا يوجد مستخدمون مؤرشفون.</p>
          ) : (
            archivedUsers.map((user) => (
              <UserRow
                key={user.id}
                user={user}
                onEdit={() => undefined}
                onToggleActive={() => undefined}
                onUnarchive={() => {
                  void (async () => {
                    const result = await archiveManagedUser(user.id, false);
                    if (!result.ok) {
                      setError(result.error);
                      return;
                    }
                    setMessage(`أُلغيت أرشفة ${user.fullName}.`);
                    refresh();
                  })();
                }}
              />
            ))
          )}
        </div>
      </ExpandableSection>
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
