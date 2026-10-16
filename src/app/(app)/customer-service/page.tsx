"use client";

/**
 * CS-FEATURE — Customer Service home.
 * Remove this route folder when dropping the feature.
 */

import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { RoleGuard } from "@/components/role-guard";
import { isCsDiagnosticEnabled } from "@/lib/cs-diagnostic";

function CustomerServiceHome() {
  const enabled = isCsDiagnosticEnabled();

  return (
    <div className="space-y-8">
      <PageHeader
        title="خدمة العملاء"
        description="أدوات التشخيص الهاتفي لأجهزة العطور — شريحة أولى قابلة للإزالة بالكامل."
      />

      {!enabled ? (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
          تشخيص خدمة العملاء معطّل عبر المتغير NEXT_PUBLIC_CS_DIAGNOSTIC.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <Link
            href="/customer-service/diagnostic"
            className="rounded-2xl border border-ink-900/10 bg-sand-50 p-5 transition hover:border-aroma-400 dark:border-white/10 dark:bg-ink-900 dark:hover:border-aroma-400"
          >
            <h2 className="font-display text-lg text-ink-900 dark:text-sand-50">
              الجهاز لا يعمل
            </h2>
            <p className="mt-2 text-sm text-ink-700/70 dark:text-sand-100/70">
              ابدأ شكوى واتبع شجرة الأسئلة (إضاءة → صوت → زيت/زجاجة/فلتر أو مسار الكهرباء) مع نسب احتمالية
              للأسباب.
            </p>
            <span className="mt-4 inline-block text-sm font-medium text-aroma-800 dark:text-aroma-200">
              بدء التشخيص ←
            </span>
          </Link>
        </div>
      )}
    </div>
  );
}

export default function CustomerServicePage() {
  return (
    <RoleGuard allow="customer_service">
      <CustomerServiceHome />
    </RoleGuard>
  );
}
