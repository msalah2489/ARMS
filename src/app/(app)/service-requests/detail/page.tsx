"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { RequestDetailClient } from "../[id]/request-detail-client";

function DetailInner() {
  const params = useSearchParams();
  const id = params?.get("id") ?? "";
  if (!id) return <p className="text-sm text-rose-700">معرّف الطلب مفقود.</p>;
  return <RequestDetailClient id={id} />;
}

export default function ServiceRequestDetailByQueryPage() {
  return (
    <Suspense fallback={<p className="text-sm text-ink-700/70">جاري التحميل…</p>}>
      <DetailInner />
    </Suspense>
  );
}
