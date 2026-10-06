"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { isDemoMode } from "@/lib/auth";
import { listAuditEventsLocal } from "@/lib/shipping-store";
import { hydrateOpsFromSupabase } from "@/lib/supabase/hydrate";
import { isSupabaseConfigured } from "@/lib/supabase/config";

type MovementRow = {
  id: string;
  when: string;
  device: string;
  type: string;
  from: string;
  to: string;
  receipt: string;
  status: string;
};

function auditToRows(events: Array<Record<string, unknown>>): MovementRow[] {
  return events.slice(0, 50).map((item, index) => {
    const after = (item.after ?? {}) as Record<string, unknown>;
    const action = String(item.action ?? "event");
    return {
      id: String(item.id ?? `audit-${index}`),
      when: String(item.createdAt ?? ""),
      device: String(after.deviceCode ?? after.entityId ?? item.entityId ?? "—"),
      type: action,
      from: String(after.from ?? item.actorName ?? "—"),
      to: String(after.to ?? item.entityType ?? "—"),
      receipt: String(after.receiptNumber ?? after.shipmentNumber ?? "—"),
      status: String(after.status ?? item.entityType ?? "info"),
    };
  });
}

export default function MovementsPage() {
  const [rows, setRows] = useState<MovementRow[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Paint from local cache immediately; refresh in background (non-blocking).
    setRows(auditToRows(listAuditEventsLocal()));
    setReady(true);

    let cancelled = false;
    if (isSupabaseConfigured() && !isDemoMode()) {
      void hydrateOpsFromSupabase().then(() => {
        if (cancelled) return;
        setRows(auditToRows(listAuditEventsLocal()));
      });
    }
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <PageHeader
        title="Device movements"
        description="Dispatch, receive, and return events from live shipping audit — no demo rows."
      />
      {!ready ? (
        <p className="text-sm text-ink-700/70">جاري التحميل…</p>
      ) : rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-ink-900/15 bg-white p-6 text-sm text-ink-700/70">
          لا توجد حركات مسجّلة بعد. ستظهر هنا أحداث الشحن والاستلام من قاعدة البيانات.
        </p>
      ) : (
        <div className="space-y-3">
          {rows.map((item) => (
            <article
              key={item.id}
              className="rounded-2xl border border-ink-900/10 bg-white p-5 shadow-panel"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{item.type}</p>
                <StatusBadge value={item.status} />
              </div>
              <p className="mt-2 text-sm text-ink-700/70">
                {item.device} · {item.from} → {item.to}
              </p>
              <p className="mt-1 text-xs text-ink-700/50">
                {item.when} · Receipt {item.receipt}
              </p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
