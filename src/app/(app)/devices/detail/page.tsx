"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { DeviceDetailClient } from "../[id]/device-detail-client";

function DetailInner() {
  const params = useSearchParams();
  const id = params.get("id") ?? "";
  if (!id) return <p className="text-sm text-rose-700">معرّف الجهاز مفقود.</p>;
  return <DeviceDetailClient id={id} />;
}

export default function DeviceDetailByQueryPage() {
  return (
    <Suspense fallback={<p className="text-sm text-ink-700/70">جاري التحميل…</p>}>
      <DetailInner />
    </Suspense>
  );
}
