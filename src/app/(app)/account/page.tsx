"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { ROLE_LABELS } from "@/lib/auth";
import { readSession, writeSession } from "@/lib/session";
import {
  ASSIGNABLE_ROLE_LABELS,
  getManagedUser,
  listBranchOptionsForUsers,
  updateManagedUserSelf,
} from "@/lib/users-store";
import type { AssignableUserRole, Profile } from "@/types/domain";

export default function AccountPage() {
  const [user, setUser] = useState<Profile | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [opsBranchId, setOpsBranchId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isManaged, setIsManaged] = useState(false);

  const branches = useMemo(() => listBranchOptionsForUsers(), []);

  useEffect(() => {
    const session = readSession();
    if (!session) return;
    setUser(session);
    setFullName(session.fullName);
    setEmail(session.email);
    setMobile(session.mobile ?? "");
    setOpsBranchId(session.opsBranchId ?? "");
    setIsManaged(Boolean(getManagedUser(session.id)));
  }, []);

  if (!user) return <p className="text-sm text-ink-700/70">جاري التحميل…</p>;

  const roleLabel =
    ASSIGNABLE_ROLE_LABELS[user.role as AssignableUserRole] ?? ROLE_LABELS[user.role];

  return (
    <div className="space-y-6">
      <PageHeader
        title="حسابي"
        description="عدّل بياناتك الشخصية. الصلاحية تُحدَّد من مدير النظام ولا يمكن تغييرها من هنا."
      />

      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      {message ? <p className="text-sm text-aroma-700">{message}</p> : null}

      <section className="rounded-2xl border border-ink-900/10 bg-white p-5 shadow-panel">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm">
            اسم المستخدم *
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={!isManaged}
              className="mt-1 w-full rounded-xl border border-ink-900/15 px-3 py-2 disabled:bg-sand-50"
            />
          </label>
          <label className="block text-sm">
            رقم الجوال *
            <input
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              disabled={!isManaged}
              className="mt-1 w-full rounded-xl border border-ink-900/15 px-3 py-2 disabled:bg-sand-50"
            />
          </label>
          <label className="block text-sm">
            البريد الإلكتروني
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={!isManaged}
              className="mt-1 w-full rounded-xl border border-ink-900/15 px-3 py-2 disabled:bg-sand-50"
            />
          </label>
          <label className="block text-sm">
            الصلاحية
            <input
              value={roleLabel}
              disabled
              className="mt-1 w-full rounded-xl border border-ink-900/10 bg-sand-50 px-3 py-2 text-ink-700/70"
            />
            <span className="mt-1 block text-xs text-ink-700/50">لا يمكن تعديل الصلاحية من حسابك.</span>
          </label>
          <label className="block text-sm md:col-span-2">
            الفرع
            <select
              value={opsBranchId}
              onChange={(e) => setOpsBranchId(e.target.value)}
              disabled={!isManaged || user.role === "branch"}
              className="mt-1 w-full rounded-xl border border-ink-900/15 px-3 py-2 disabled:bg-sand-50"
            >
              <option value="">{user.role === "branch" ? "فرع الحساب" : "بدون فرع"}</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
            {user.role === "branch" ? (
              <span className="mt-1 block text-xs text-ink-700/50">
                فرع حساب الفرع يحدده مدير النظام.
              </span>
            ) : null}
          </label>
        </div>

        {isManaged ? (
          <button
            type="button"
            className="mt-5 rounded-full bg-ink-900 px-5 py-2.5 text-sm text-white"
            onClick={() => {
              setError(null);
              setMessage(null);
              const result = updateManagedUserSelf(user.id, {
                fullName,
                email,
                mobile,
                opsBranchId: user.role === "branch" ? user.opsBranchId : opsBranchId || null,
              });
              if (!result.ok) {
                setError(result.error);
                return;
              }
              const nextSession = {
                ...user,
                fullName: result.user.fullName,
                email: result.user.email,
                mobile: result.user.mobile,
                opsBranchId: result.user.opsBranchId,
                opsBranchName: result.user.opsBranchName,
              };
              writeSession(nextSession);
              setUser(nextSession);
              setMessage("تم حفظ تعديلات حسابك.");
            }}
          >
            حفظ بياناتي
          </button>
        ) : (
          <p className="mt-5 text-sm text-ink-700/60">
            هذا حساب تجريبي سريع. لإنشاء حساب قابل للتعديل، أضفه من «المستخدمون» في حساب مدير النظام.
          </p>
        )}
      </section>
    </div>
  );
}
