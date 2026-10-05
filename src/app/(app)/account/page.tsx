"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { ROLE_LABELS } from "@/lib/auth";
import { readSession, writeSession } from "@/lib/session";
import {
  ASSIGNABLE_ROLE_LABELS,
  findManagedUserForSession,
  managedUserToProfile,
  updateManagedUserSelf,
} from "@/lib/users-store";
import type { AssignableUserRole, Profile } from "@/types/domain";

export default function AccountPage() {
  const [user, setUser] = useState<Profile | null>(null);
  const [managedId, setManagedId] = useState<string | null>(null);
  const [mobile, setMobile] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const session = readSession();
    if (!session) return;

    const managed = findManagedUserForSession(session);
    if (managed) {
      const profile = managedUserToProfile(managed);
      writeSession(profile);
      setUser(profile);
      setManagedId(managed.id);
      setMobile(managed.mobile);
      return;
    }

    setUser(session);
    setMobile(session.mobile ?? "");
    setManagedId(null);
  }, []);

  if (!user) return <p className="text-sm text-ink-700/70">جاري التحميل…</p>;

  const roleLabel =
    ASSIGNABLE_ROLE_LABELS[user.role as AssignableUserRole] ?? ROLE_LABELS[user.role];

  return (
    <div className="space-y-6">
      <PageHeader
        title="حسابي"
        description="يمكنك تغيير رقم الجوال وكلمة المرور فقط. اسم المستخدم والفرع والصلاحية يحددها مدير النظام."
      />

      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      {message ? <p className="text-sm text-aroma-700">{message}</p> : null}

      <section className="rounded-2xl border border-ink-900/10 bg-white p-5 shadow-panel">
        <h2 className="font-display text-xl">بيانات الحساب</h2>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-ink-700/60">الاسم</dt>
            <dd className="font-medium">{user.fullName}</dd>
          </div>
          <div>
            <dt className="text-ink-700/60">اسم المستخدم</dt>
            <dd className="font-medium">{user.username || "—"}</dd>
          </div>
          <div>
            <dt className="text-ink-700/60">الصلاحية</dt>
            <dd className="font-medium">{roleLabel}</dd>
          </div>
          <div>
            <dt className="text-ink-700/60">الفرع</dt>
            <dd className="font-medium">{user.opsBranchName || "—"}</dd>
          </div>
          <div>
            <dt className="text-ink-700/60">الجوال</dt>
            <dd className="font-medium">{user.mobile || "—"}</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-ink-700/50">
          لا يمكن تغيير اسم المستخدم أو الفرع أو الصلاحية من حسابك.
        </p>
      </section>

      {managedId ? (
        <section className="rounded-2xl border border-ink-900/10 bg-white p-5 shadow-panel">
          <h2 className="font-display text-xl">تحديث الجوال وكلمة المرور</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="block text-sm md:col-span-2">
              رقم الجوال *
              <input
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                placeholder="05xxxxxxxx"
                className="mt-1 w-full rounded-xl border border-ink-900/15 px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              كلمة المرور الحالية
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="mt-1 w-full rounded-xl border border-ink-900/15 px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              كلمة المرور الجديدة
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="mt-1 w-full rounded-xl border border-ink-900/15 px-3 py-2"
              />
            </label>
            <label className="block text-sm md:col-span-2">
              تأكيد كلمة المرور الجديدة
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1 w-full rounded-xl border border-ink-900/15 px-3 py-2"
              />
            </label>
          </div>
          <p className="mt-2 text-xs text-ink-700/50">
            اترك حقول كلمة المرور فارغة إذا أردت تحديث الجوال فقط. كلمة المرور الحالية للحسابات الافتراضية: demo
          </p>
          <button
            type="button"
            className="mt-5 rounded-full bg-ink-900 px-5 py-2.5 text-sm text-white"
            onClick={() => {
              setError(null);
              setMessage(null);
              if (newPassword && newPassword !== confirmPassword) {
                setError("تأكيد كلمة المرور غير مطابق.");
                return;
              }
              const result = updateManagedUserSelf(managedId, {
                mobile,
                currentPassword: newPassword ? currentPassword : undefined,
                newPassword: newPassword || undefined,
              });
              if (!result.ok) {
                setError(result.error);
                return;
              }
              const nextSession = managedUserToProfile(result.user);
              writeSession(nextSession);
              setUser(nextSession);
              setCurrentPassword("");
              setNewPassword("");
              setConfirmPassword("");
              setMessage("تم حفظ التحديثات.");
            }}
          >
            حفظ التغييرات
          </button>
        </section>
      ) : (
        <p className="rounded-2xl border border-dashed border-ink-900/15 bg-white px-4 py-6 text-sm text-ink-700/60">
          لا يمكن تعديل هذا الحساب من هنا. راجع مدير النظام.
        </p>
      )}
    </div>
  );
}
