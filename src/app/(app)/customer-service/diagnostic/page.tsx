"use client";

/**
 * CS-FEATURE — Device-not-working diagnostic page.
 */

import Link from "next/link";
import { DiagnosticWizard } from "@/components/customer-service/diagnostic-wizard";
import { PageHeader } from "@/components/page-header";
import { RoleGuard } from "@/components/role-guard";
import { CS_DEVICE_NOT_WORKING_TREE, isCsDiagnosticEnabled } from "@/lib/cs-diagnostic";

function DiagnosticPage() {
  if (!isCsDiagnosticEnabled()) {
    return (
      <div className="space-y-4">
        <PageHeader title="التشخيص معطّل" description="فعّل NEXT_PUBLIC_CS_DIAGNOSTIC=1 ثم أعد البناء." />
        <Link href="/customer-service" className="text-sm text-aroma-800 underline dark:text-aroma-200">
          العودة لخدمة العملاء
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title={CS_DEVICE_NOT_WORKING_TREE.titleAr}
        description="أجب عن الأسئلة بالترتيب. النسب تقريبية لمساعدة خدمة العملاء وليست تشخيصًا مخبريًا."
      />
      <Link
        href="/customer-service"
        className="inline-block text-sm text-ink-700/70 underline hover:text-aroma-800 dark:text-sand-100/70"
      >
        ← الرئيسية
      </Link>
      <DiagnosticWizard tree={CS_DEVICE_NOT_WORKING_TREE} />
    </div>
  );
}

export default function CustomerServiceDiagnosticPage() {
  return (
    <RoleGuard allow="customer_service">
      <DiagnosticPage />
    </RoleGuard>
  );
}
