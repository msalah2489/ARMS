"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { ROLE_LABELS, isSystemAdminRole, normalizeRole } from "@/lib/auth";
import { readSession } from "@/lib/session";
import type { Profile } from "@/types/domain";

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<Profile | null>(null);

  useEffect(() => {
    const session = readSession();
    if (!session) return;
    const role = normalizeRole(session.role);
    if (!isSystemAdminRole(role) && role !== "manager") {
      router.replace("/dashboard");
      return;
    }
    setUser(session);
  }, [router]);

  if (!user) {
    return <p className="text-sm text-ink-700/70">جاري التحميل…</p>;
  }

  return (
    <div>
      <PageHeader
        title="إعدادات النظام"
        description="إعدادات مدير النظام: الكتالوج والصلاحيات."
      />
      <div className="grid gap-4 md:grid-cols-2">
        <Link
          href="/admin/catalog"
          className="rounded-2xl border border-ink-900/10 bg-white p-6 shadow-panel hover:border-aroma-400"
        >
          <h2 className="font-display text-xl">كتالوج الأجهزة</h2>
          <p className="mt-2 text-sm text-ink-700/70">
            إضافة وتعديل تصنيفات الأجهزة والبراندات والموديلات والملحقات وقطع الغيار.
          </p>
        </Link>
        <section className="rounded-2xl border border-ink-900/10 bg-white p-6 shadow-panel">
          <h2 className="font-display text-xl">المستخدمون والصلاحيات</h2>
          <p className="mt-2 text-sm text-ink-700/70">
            إدارة الحسابات والأدوار (قريبًا من واجهة موحّدة).
          </p>
        </section>
      </div>
      <p className="mt-6 text-xs text-ink-700/50">
        مسجّل كـ {user.email} · {ROLE_LABELS[user.role]}
      </p>
    </div>
  );
}
