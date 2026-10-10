"use client";

import { useEffect, useMemo, useState } from "react";
import { BulkCsvImportBar } from "@/components/bulk-csv-import";
import { ExpandableSection } from "@/components/expandable-section";
import { ImagePickerField, type ImageValue } from "@/components/image-picker-field";
import { PageHeader } from "@/components/page-header";
import { RoleGuard } from "@/components/role-guard";
import { isSystemAdminRole } from "@/lib/auth";
import {
  applyUsersImportPreview,
  downloadUsersImportTemplate,
  formatUserPreviewActionAr,
  previewUsersImportFile,
  usersImportRoleHintAr,
  type UserImportPreviewRow,
} from "@/lib/bulk-users-import";
import {
  CRITICAL_SELF_ADMIN_PERMISSIONS,
  PERMISSION_GROUPS,
  PERMISSION_LABELS,
  canManagePermissions,
  getDefaultPermissionsForRole,
  type PermissionKey,
} from "@/lib/permissions";
import { readSession } from "@/lib/session";
import { useUnsavedChanges } from "@/lib/unsaved-changes";
import {
  ASSIGNABLE_ROLES,
  ASSIGNABLE_ROLE_LABELS,
  archiveManagedUser,
  createManagedUser,
  genderSymbol,
  listBranchOptionsForUsers,
  listManagedUsers,
  setManagedUserActive,
  updateManagedUserByAdmin,
} from "@/lib/users-store";
import type { AssignableUserRole, ManagedUser, UserGender } from "@/types/domain";

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
    permissions: [] as PermissionKey[],
    gender: "" as UserGender | "",
    photo: null as ImageValue | null,
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
      <div className="flex min-w-0 items-center gap-3">
        {user.photoDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.photoDataUrl}
            alt=""
            className="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-ink-900/10 dark:ring-white/15"
          />
        ) : (
          <span
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink-900/10 text-sm font-medium text-ink-700 dark:bg-white/10 dark:text-sand-100"
            aria-hidden
          >
            {user.fullName.trim().charAt(0) || "?"}
          </span>
        )}
        <div className="min-w-0">
          <p className="font-medium dark:text-sand-50">
            {user.fullName}
            {genderSymbol(user.gender) ? (
              <span className="ms-1 text-ink-700/70 dark:text-sand-100/70" title={user.gender === "male" ? "ذكر" : "أنثى"}>
                {genderSymbol(user.gender)}
              </span>
            ) : null}{" "}
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
            {user.permissions?.length
              ? ` · ${user.permissions.length} صلاحية`
              : ""}
          </p>
        </div>
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

function PermissionsEditor({
  role,
  permissions,
  lockedKeys,
  onChange,
  onResetToRole,
}: {
  role: AssignableUserRole | "";
  permissions: PermissionKey[];
  lockedKeys: PermissionKey[];
  onChange: (next: PermissionKey[]) => void;
  onResetToRole: () => void;
}) {
  const selected = useMemo(() => new Set(permissions), [permissions]);

  function toggle(key: PermissionKey) {
    if (lockedKeys.includes(key) && selected.has(key)) return;
    if (selected.has(key)) {
      onChange(permissions.filter((item) => item !== key));
    } else {
      onChange([...permissions, key]);
    }
  }

  return (
    <div className="mt-4 space-y-3 rounded-xl border border-ink-900/10 p-4 dark:border-white/10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium dark:text-sand-50">الصلاحيات التفصيلية</p>
          <p className="text-xs text-ink-700/60 dark:text-sand-100/60">
            يُملأ تلقائيًا من قالب الدور، ويمكن تخصيصه لكل مستخدم.
          </p>
        </div>
        <button
          type="button"
          disabled={!role}
          onClick={onResetToRole}
          className="rounded-full border border-ink-900/15 px-4 py-1.5 text-xs disabled:opacity-40 dark:border-white/15 dark:text-sand-50"
        >
          إعادة لافتراضي الدور
        </button>
      </div>

      {!role ? (
        <p className="text-xs text-ink-700/60 dark:text-sand-100/60">
          اختر الدور أولاً لتعبئة الصلاحيات.
        </p>
      ) : (
        <div className="space-y-4">
          {PERMISSION_GROUPS.map((group) => (
            <details key={group.id} className="group rounded-lg border border-ink-900/8 open:bg-ink-900/[0.02] dark:border-white/10 dark:open:bg-white/[0.02]">
              <summary className="cursor-pointer list-none px-3 py-2 text-sm font-medium dark:text-sand-50">
                <span className="inline-flex items-center gap-2">
                  {group.labelAr}
                  <span className="text-xs font-normal text-ink-700/50 dark:text-sand-100/50">
                    (
                    {group.keys.filter((key) => selected.has(key)).length}/{group.keys.length})
                  </span>
                </span>
              </summary>
              <div className="grid gap-2 px-3 pb-3 sm:grid-cols-2">
                {group.keys.map((key) => {
                  const locked = lockedKeys.includes(key) && selected.has(key);
                  return (
                    <label
                      key={key}
                      className="flex items-start gap-2 text-sm dark:text-sand-100"
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={selected.has(key)}
                        disabled={locked}
                        onChange={() => toggle(key)}
                      />
                      <span>
                        {PERMISSION_LABELS[key]}
                        {locked ? (
                          <span className="ms-1 text-xs text-amber-700 dark:text-amber-300">
                            (محمية)
                          </span>
                        ) : null}
                      </span>
                    </label>
                  );
                })}
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}

function AdminUsersContent() {
  const { setDirty, clearDirty, confirmIfDirty } = useUnsavedChanges("admin-users");
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [form, setForm] = useState(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actor, setActor] = useState(() => readSession());
  const [pendingUserImport, setPendingUserImport] = useState<UserImportPreviewRow[] | null>(
    null,
  );

  const branches = useMemo(() => listBranchOptionsForUsers(), []);
  const activeUsers = users.filter((u) => !u.isArchived);
  const archivedUsers = users.filter((u) => u.isArchived);
  const showPermissions = canManagePermissions(actor);
  const canBulkImport = actor ? isSystemAdminRole(actor.role) : false;

  const usersDirty = useMemo(() => {
    if (editingId) return true;
    const blank = emptyForm();
    return (
      form.fullName.trim() !== blank.fullName ||
      form.username.trim() !== blank.username ||
      form.email.trim() !== blank.email ||
      form.mobile.trim() !== blank.mobile ||
      form.role !== blank.role ||
      form.opsBranchId !== blank.opsBranchId ||
      form.password !== blank.password ||
      form.isActive !== blank.isActive ||
      form.permissions.length > 0 ||
      form.gender !== blank.gender ||
      Boolean(form.photo)
    );
  }, [form, editingId]);

  useEffect(() => {
    setDirty(usersDirty);
  }, [usersDirty, setDirty]);

  const lockedKeys: PermissionKey[] =
    editingId &&
    actor?.id === editingId &&
    form.role === "system_admin"
      ? CRITICAL_SELF_ADMIN_PERMISSIONS
      : [];

  function refresh() {
    setUsers(listManagedUsers({ includeArchived: true }));
    setActor(readSession());
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
    clearDirty();
  }

  function requestResetForm() {
    confirmIfDirty(() => resetForm());
  }

  function applyRoleDefaults(role: AssignableUserRole) {
    setForm((prev) => ({
      ...prev,
      role,
      permissions: getDefaultPermissionsForRole(role),
    }));
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="إدارة المستخدمين"
        description="الاسم واسم المستخدم منفصلان. اسم المستخدم للدخول ويمكن تعديله (يجب أن يكون فريدًا). الصلاحيات التفصيلية تُبنى من قالب الدور ويمكن تخصيصها. الأرشفة تحفظ السجل وتُخفي المستخدم من القوائم النشطة."
      />

      {error ? <p className="text-sm text-rose-700 dark:text-rose-300">{error}</p> : null}
      {message ? <p className="text-sm text-aroma-700 dark:text-aroma-200">{message}</p> : null}

      {canBulkImport ? (
        <BulkCsvImportBar
          title="استيراد مستخدمين من ملف Excel"
          hint={`تأكد أن الفروع موجودة في «إدارة الفروع» ثم حمّل القالب (قوائم منسدلة للدور والفرع والحالة). دور «فرع» يتطلب اختيار فرع. راجع المعاينة ثم وافق وأكّد. الأدوار: ${usersImportRoleHintAr()}.`}
          onDownloadTemplate={downloadUsersImportTemplate}
          onParseFile={async (file) => {
            setError(null);
            setMessage(null);
            const result = await previewUsersImportFile(file);
            if (!result.ok) {
              setPendingUserImport(null);
              return result;
            }
            setPendingUserImport(result.rows);
            return {
              ok: true,
              columns: result.columns,
              validCount: result.validCount,
              errorCount: result.errorCount,
              rows: result.rows.map((row) => ({
                id: `u-${row.rowNum}`,
                hasError: row.plannedAction === "error",
                cells: {
                  rowNum: row.rowNum,
                  username: row.username || "—",
                  fullName: row.fullName || "—",
                  roleLabel: row.roleLabel || "—",
                  mobile: row.mobile || "—",
                  email: row.email || "—",
                  opsBranchName: row.opsBranchName || "—",
                  isActive: row.isActive ? "نعم" : "لا",
                  plannedAction: formatUserPreviewActionAr(row.plannedAction),
                  error: row.error ?? "",
                },
              })),
            };
          }}
          onConfirmApply={async () => {
            if (!pendingUserImport) {
              setError("لا توجد معاينة جاهزة للتسجيل.");
              throw new Error("no preview");
            }
            setError(null);
            setMessage(null);
            const session = readSession();
            const result = await applyUsersImportPreview(
              pendingUserImport,
              session ? { id: session.id, role: session.role } : null,
            );
            if (!result.ok) {
              setError(result.error);
              throw new Error(result.error);
            }
            setPendingUserImport(null);
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

      <ExpandableSection title={editingId ? "تعديل موظف" : "إضافة مستخدم"} defaultOpen>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2 dark:text-sand-100">
            <ImagePickerField
              label="الصورة الشخصية"
              hint="اختيارية — يمكن رفع صورة للموظف أو تركها فارغة."
              value={form.photo}
              onChange={(photo) => setForm((prev) => ({ ...prev, photo }))}
              roundPreview
              compressOptions={{ maxEdge: 320, quality: 0.7 }}
            />
          </div>
          <label className="block text-sm dark:text-sand-100">
            الاسم (اسم الشخص) *
            <input
              value={form.fullName}
              onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-ink-900/15 px-3 py-2 dark:border-white/15 dark:bg-ink-950 dark:text-sand-50"
            />
          </label>
          <fieldset className="block text-sm dark:text-sand-100">
            <legend className="font-medium">الجنس (اختياري)</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {(
                [
                  { value: "" as const, label: "غير محدد" },
                  { value: "male" as const, label: "ذكر ♂" },
                  { value: "female" as const, label: "أنثى ♀" },
                ] as const
              ).map((option) => {
                const selected = form.gender === option.value;
                return (
                  <button
                    key={option.label}
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, gender: option.value }))}
                    className={[
                      "rounded-full border px-4 py-2 text-sm transition",
                      selected
                        ? "border-ink-900 bg-ink-900 text-white dark:border-aroma-500 dark:bg-aroma-600"
                        : "border-ink-900/15 dark:border-white/15 dark:text-sand-50",
                    ].join(" ")}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </fieldset>
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
            الدور (قالب الصلاحيات) *
            <select
              value={form.role}
              onChange={(e) => {
                const role = e.target.value as AssignableUserRole | "";
                if (!role) {
                  setForm((prev) => ({ ...prev, role: "", permissions: [] }));
                  return;
                }
                applyRoleDefaults(role);
              }}
              className="mt-1 w-full rounded-xl border border-ink-900/15 px-3 py-2 dark:border-white/15 dark:bg-ink-950 dark:text-sand-50"
            >
              <option value="">اختر الدور</option>
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

        {showPermissions ? (
          <PermissionsEditor
            role={form.role}
            permissions={form.permissions}
            lockedKeys={lockedKeys}
            onChange={(permissions) => setForm((prev) => ({ ...prev, permissions }))}
            onResetToRole={() => {
              if (!form.role) return;
              setForm((prev) => ({
                ...prev,
                permissions: getDefaultPermissionsForRole(form.role as AssignableUserRole),
              }));
            }}
          />
        ) : null}

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            className="rounded-full bg-ink-900 px-5 py-2.5 text-sm text-white dark:bg-aroma-600"
            onClick={() => {
              void (async () => {
                setError(null);
                setMessage(null);
                if (!form.role) {
                  setError("الدور إلزامي.");
                  return;
                }
                const session = readSession();
                const permissions =
                  showPermissions && form.permissions.length > 0
                    ? form.permissions
                    : getDefaultPermissionsForRole(form.role);

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
                    permissions,
                    gender: form.gender || null,
                    photoDataUrl: form.photo?.dataUrl ?? null,
                    photoName: form.photo?.name ?? null,
                    actor: session
                      ? { id: session.id, role: session.role }
                      : null,
                  });
                  if (!result.ok) {
                    setError(result.error);
                    return;
                  }
                  if (session?.id === result.user.id) {
                    const { managedUserToProfile } = await import("@/lib/users-store");
                    const { writeSession } = await import("@/lib/session");
                    writeSession(managedUserToProfile(result.user));
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
                    permissions,
                    gender: form.gender || null,
                    photoDataUrl: form.photo?.dataUrl ?? null,
                    photoName: form.photo?.name ?? null,
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
              onClick={requestResetForm}
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
                  if (editingId === user.id) return;
                  const loadEdit = () => {
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
                      permissions: (user.permissions?.length
                        ? user.permissions
                        : getDefaultPermissionsForRole(user.role)) as PermissionKey[],
                      gender: user.gender ?? "",
                      photo: user.photoDataUrl
                        ? {
                            name: user.photoName || "photo.jpg",
                            dataUrl: user.photoDataUrl,
                          }
                        : null,
                    });
                    setMessage(null);
                    setError(null);
                  };
                  confirmIfDirty(loadEdit);
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
    <RoleGuard allow={["system_admin", "manager"]} permission="manage_users">
      <AdminUsersContent />
    </RoleGuard>
  );
}
