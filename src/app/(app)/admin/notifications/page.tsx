"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { PageHeader } from "@/components/page-header";
import { RoleGuard } from "@/components/role-guard";
import { ROLE_LABELS, isSystemAdminRole } from "@/lib/auth";
import {
  listAllNotificationsAdmin,
  sendNotification,
  subscribeNotificationsChanged,
} from "@/lib/notifications-store";
import { readSession } from "@/lib/session";
import { formatDate } from "@/lib/utils";
import { getWebPushDeliveryMessage } from "@/lib/web-push-client";
import {
  ASSIGNABLE_ROLE_LABELS,
  ASSIGNABLE_ROLES,
  listManagedUsers,
} from "@/lib/users-store";
import type {
  AppRole,
  ArmsNotification,
  AssignableUserRole,
  NotificationAudienceType,
  Profile,
} from "@/types/domain";

function audienceLabel(item: ArmsNotification, users: { id: string; fullName: string }[]) {
  if (item.audienceType === "all") return "الكل";
  if (item.audienceType === "role") {
    const role = item.audienceRole as AppRole | null | undefined;
    return role ? `دور: ${ROLE_LABELS[role] ?? role}` : "دور";
  }
  const match = users.find((user) => user.id === item.audienceUserId);
  return `حساب: ${match?.fullName ?? item.audienceUserId ?? "—"}`;
}

function AdminNotificationsInner() {
  const [user, setUser] = useState<Profile | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audienceType, setAudienceType] = useState<NotificationAudienceType>("all");
  const [audienceRole, setAudienceRole] = useState<AssignableUserRole>("branch");
  const [audienceUserId, setAudienceUserId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setUser(readSession());
    return subscribeNotificationsChanged(() => setTick((n) => n + 1));
  }, []);

  const users = useMemo(() => {
    void tick;
    return listManagedUsers().filter((item) => item.isActive && !item.isArchived);
  }, [tick]);

  const history = useMemo(() => {
    void tick;
    return listAllNotificationsAdmin();
  }, [tick]);

  if (!user) {
    return <p className="text-sm text-ink-700/70 dark:text-sand-100/70">جاري التحميل…</p>;
  }

  if (!isSystemAdminRole(user.role)) {
    return (
      <p className="rounded-xl border border-rose-300/50 bg-rose-50 px-4 py-3 text-sm text-rose-900 dark:border-rose-500/30 dark:bg-rose-950/30 dark:text-rose-100">
        إرسال الرسائل متاح لحساب مدير النظام فقط.
      </p>
    );
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!user || sending) return;
    setMessage(null);
    setError(null);
    setSending(true);
    try {
      const result = await sendNotification({
        title,
        body,
        audienceType,
        audienceRole: audienceType === "role" ? audienceRole : null,
        audienceUserId: audienceType === "user" ? audienceUserId : null,
        sender: user,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setTitle("");
      setBody("");
      const inApp =
        "تم حفظ الرسالة داخل النظام (الجرس). تظهر للمستلمين بعد المزامنة/تحديث الصفحة.";
      const pushLine = result.push
        ? getWebPushDeliveryMessage(result.push)
        : "إشعار نظام التشغيل غير متاح في هذا البناء (تحقق من VAPID/Supabase).";
      setMessage(`${inApp} ${pushLine}`);
      setTick((n) => n + 1);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="الرسائل والإشعارات"
        description="أرسل رسالة للجميع أو لدور محدد أو لحساب واحد. الرسائل لا تُحذف. الجرس داخل التطبيق يعمل بعد المزامنة؛ إشعار نظام التشغيل يصل فقط للأجهزة التي فعّلت Web Push ونُشرت لها دالة send-web-push."
      />

      <form
        onSubmit={onSubmit}
        className="space-y-4 rounded-2xl border border-ink-900/10 bg-white p-4 dark:border-white/10 dark:bg-ink-900 sm:p-5"
      >
        <div>
          <label className="mb-1 block text-sm font-medium">العنوان</label>
          <input
            className="w-full rounded-xl border border-ink-900/15 bg-white px-3 py-2 text-sm dark:border-white/15 dark:bg-ink-950"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="مثال: صيانة نظام مجدولة"
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">نص الرسالة</label>
          <textarea
            className="min-h-28 w-full rounded-xl border border-ink-900/15 bg-white px-3 py-2 text-sm dark:border-white/15 dark:bg-ink-950"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="اكتب تفاصيل الرسالة…"
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">المستلمون</label>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["all", "الكل"],
                ["role", "دور محدد"],
                ["user", "حساب محدد"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={[
                  "rounded-full border px-3 py-1.5 text-xs",
                  audienceType === value
                    ? "border-ink-900 bg-ink-900 text-white dark:border-aroma-500 dark:bg-aroma-600"
                    : "border-ink-900/15 bg-white dark:border-white/15 dark:bg-ink-950",
                ].join(" ")}
                onClick={() => setAudienceType(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {audienceType === "role" ? (
          <div>
            <label className="mb-1 block text-sm font-medium">الدور</label>
            <select
              className="w-full rounded-xl border border-ink-900/15 bg-white px-3 py-2 text-sm dark:border-white/15 dark:bg-ink-950"
              value={audienceRole}
              onChange={(event) => setAudienceRole(event.target.value as AssignableUserRole)}
            >
              {ASSIGNABLE_ROLES.map((role) => (
                <option key={role} value={role}>
                  {ASSIGNABLE_ROLE_LABELS[role]}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {audienceType === "user" ? (
          <div>
            <label className="mb-1 block text-sm font-medium">الحساب</label>
            <select
              className="w-full rounded-xl border border-ink-900/15 bg-white px-3 py-2 text-sm dark:border-white/15 dark:bg-ink-950"
              value={audienceUserId}
              onChange={(event) => setAudienceUserId(event.target.value)}
              required
            >
              <option value="">اختر مستخدمًا…</option>
              {users.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.fullName} · {ASSIGNABLE_ROLE_LABELS[item.role as AssignableUserRole] ?? item.role} ·{" "}
                  {item.username || item.email}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {error ? (
          <p className="rounded-xl border border-rose-300/40 bg-rose-50 px-3 py-2 text-sm text-rose-900 dark:border-rose-500/30 dark:bg-rose-950/30 dark:text-rose-100">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="rounded-xl border border-emerald-300/40 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-950/30 dark:text-emerald-100">
            {message}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={sending}
          className="rounded-full bg-ink-900 px-4 py-2 text-sm text-white disabled:opacity-60 dark:bg-aroma-600"
        >
          {sending ? "جاري الإرسال…" : "إرسال الرسالة"}
        </button>
      </form>

      <section className="rounded-2xl border border-ink-900/10 bg-white p-4 dark:border-white/10 dark:bg-ink-900 sm:p-5">
        <h2 className="font-display text-lg text-ink-900 dark:text-sand-50">سجل الرسائل المرسلة</h2>
        <p className="mt-1 text-xs text-ink-700/60 dark:text-sand-100/60">
          السجل للمرجعية فقط — لا يوجد حذف من الواجهة.
        </p>
        <ul className="mt-4 space-y-3">
          {history.length === 0 ? (
            <li className="text-sm text-ink-700/60 dark:text-sand-100/60">لا رسائل بعد.</li>
          ) : (
            history.map((item) => (
              <li
                key={item.id}
                className="rounded-xl border border-ink-900/10 px-3 py-3 text-sm dark:border-white/10"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-medium">{item.title}</p>
                  <span className="text-xs text-ink-700/55 dark:text-sand-100/55">
                    {formatDate(item.createdAt)}
                  </span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-ink-700/80 dark:text-sand-100/75">
                  {item.body}
                </p>
                <p className="mt-2 text-xs text-ink-700/55 dark:text-sand-100/55">
                  {audienceLabel(item, users)} · بواسطة {item.createdByName}
                </p>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}

export default function AdminNotificationsPage() {
  return (
    <RoleGuard allow="system_admin">
      <AdminNotificationsInner />
    </RoleGuard>
  );
}
