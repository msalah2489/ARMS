"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { RoleGuard } from "@/components/role-guard";
import { ensureWaybillsHaveDevices, removeDeviceFromWaybill } from "@/lib/branch-store";
import { isBranchRole } from "@/lib/auth";
import { readSession } from "@/lib/session";
import type { Profile, WaybillRecord } from "@/types/domain";

function BranchShippingContent() {
  const [user, setUser] = useState<Profile | null>(null);
  const [waybills, setWaybills] = useState<WaybillRecord[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const session = readSession();
    setUser(session);
    const branchId = session?.opsBranchId || "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1";
    setWaybills(ensureWaybillsHaveDevices(branchId));
  }, []);

  if (!user) return <p className="text-sm text-ink-700/70">جاري التحميل…</p>;

  const canRemove = isBranchRole(user.role);

  return (
    <div>
      <PageHeader
        title="شحن الصيانة"
        description="بوالص الشحن الخاصة بأجهزة الفرع المرسلة لمركز الصيانة."
      />
      {message ? <p className="mb-4 text-sm text-aroma-700">{message}</p> : null}
      <div className="space-y-4">
        {waybills.map((waybill) => (
          <section
            key={waybill.id}
            className="rounded-2xl border border-ink-900/10 bg-white p-5 shadow-panel"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-xl">بوليصة {waybill.waybillNumber}</h2>
                <p className="text-sm text-ink-700/70">شركة الشحن: {waybill.courierCompany}</p>
              </div>
              <p className="text-sm text-ink-700/60">{waybill.deviceCodes.length} جهاز</p>
            </div>
            <div className="mt-4 space-y-3">
              {waybill.deviceCodes.length === 0 ? (
                <p className="text-sm text-ink-700/60">لا توجد أجهزة على هذه البوليصة.</p>
              ) : (
                waybill.deviceCodes.map((code) => (
                  <div
                    key={code}
                    className="flex flex-wrap items-end justify-between gap-3 rounded-xl border border-ink-900/10 px-3 py-3"
                  >
                    <div>
                      <p className="font-medium">{code}</p>
                      {canRemove ? (
                        <p className="text-xs text-ink-700/60">يمكن إزالة الجهاز مع كتابة سبب الإزالة</p>
                      ) : null}
                    </div>
                    {canRemove ? (
                      <div className="flex flex-wrap items-end gap-2">
                        <input
                          value={notes[`${waybill.id}:${code}`] ?? ""}
                          onChange={(e) =>
                            setNotes((prev) => ({ ...prev, [`${waybill.id}:${code}`]: e.target.value }))
                          }
                          placeholder="سبب الإزالة"
                          className="rounded-xl border border-ink-900/15 px-3 py-2 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const note = (notes[`${waybill.id}:${code}`] ?? "").trim();
                            if (!note) {
                              setMessage("يجب كتابة ملاحظة لسبب إزالة الجهاز من البوليصة.");
                              return;
                            }
                            const next = removeDeviceFromWaybill(waybill.id, code, note);
                            setWaybills(next);
                            setMessage(`تم إزالة ${code} من البوليصة.`);
                          }}
                          className="rounded-full bg-rose-700 px-4 py-2 text-sm text-white"
                        >
                          إزالة من البوليصة
                        </button>
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

export default function BranchShippingPage() {
  return (
    <RoleGuard allow={["branch", "maintenance_manager"]}>
      <BranchShippingContent />
    </RoleGuard>
  );
}
