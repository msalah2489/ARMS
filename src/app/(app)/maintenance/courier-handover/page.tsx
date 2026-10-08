"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { RoleGuard } from "@/components/role-guard";
import {
  PICKUP_RECEIPT_DIRECTION_LABELS,
  PICKUP_RECEIPT_STATUS_LABELS,
  approveCourierHandoverToMaintenance,
  createPickupReceipt,
  listBranchesReadyForPickupReturn,
  listDevicesEligibleForPickupReturn,
  listPendingSupervisorHandovers,
  listPickupCouriers,
  listPickupReceipts,
  type BranchReadyForPickupReturnSummary,
} from "@/lib/pickup-receipt-store";
import { hydrateOpsFromSupabase } from "@/lib/supabase/hydrate";
import { readSession } from "@/lib/session";
import type { PickupReceipt, Profile } from "@/types/domain";

function MaintenanceCourierHandoverContent() {
  const [user, setUser] = useState<Profile | null>(null);
  const [pending, setPending] = useState<PickupReceipt[]>([]);
  const [history, setHistory] = useState<PickupReceipt[]>([]);
  const [returnReadyBranches, setReturnReadyBranches] = useState<
    BranchReadyForPickupReturnSummary[]
  >([]);
  const [branchId, setBranchId] = useState("");
  const [courierId, setCourierId] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const couriers = useMemo(() => listPickupCouriers({ includeTechnicians: true }), [pending, history]);
  const returnEligible = useMemo(
    () => (branchId ? listDevicesEligibleForPickupReturn(branchId) : []),
    [branchId, pending, history, returnReadyBranches],
  );

  function refresh() {
    setPending(listPendingSupervisorHandovers());
    setHistory(
      listPickupReceipts({
        statuses: ["approved", "received_at_center", "received_at_branch", "pending_courier"],
      }),
    );
    setReturnReadyBranches(listBranchesReadyForPickupReturn());
  }

  useEffect(() => {
    function load() {
      setUser(readSession());
      refresh();
      const ready = listBranchesReadyForPickupReturn();
      setBranchId((current) => {
        if (current && ready.some((b) => b.branchId === current)) return current;
        return ready[0]?.branchId ?? "";
      });
      const firstCourier = listPickupCouriers({ includeTechnicians: true })[0];
      setCourierId((c) => c || firstCourier?.id || "");
    }
    load();
    void hydrateOpsFromSupabase().then(() => load());
  }, []);

  if (!user) return <p className="text-sm text-ink-700/70">جاري التحميل…</p>;

  const branchName =
    returnReadyBranches.find((b) => b.branchId === branchId)?.branchName ?? "فرع";
  const courier = couriers.find((c) => c.id === courierId);
  const returnDeviceTotal = returnReadyBranches.reduce((sum, b) => sum + b.readyCount, 0);

  return (
    <div className="space-y-8">
      <PageHeader
        title="تسليم المندوب واعتماد الصيانة"
        description="اعتماد طلبات تسليم الأجهزة من المندوب إلى مركز الصيانة، وإنشاء نماذج إرجاع عبر المندوب أو الفني."
      />
      {message ? <p className="text-sm text-aroma-700">{message}</p> : null}
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}

      <section className="space-y-4">
        <h2 className="font-display text-2xl">بانتظار اعتماد التسليم ({pending.length})</h2>
        {pending.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-ink-900/15 bg-white px-4 py-8 text-sm text-ink-700/70">
            لا توجد طلبات تسليم بانتظار الاعتماد.
          </p>
        ) : (
          pending.map((receipt) => {
            const lines = receipt.lines.filter((l) => l.status === "approved");
            return (
              <section
                key={receipt.id}
                className="rounded-2xl border border-ink-900/10 bg-white p-5 shadow-panel"
              >
                <h3 className="font-display text-xl">{receipt.receiptNumber}</h3>
                <p className="text-sm text-ink-700/70">
                  {receipt.opsBranchName} · طلب التسليم بواسطة{" "}
                  {receipt.handoverRequestedByName ?? "—"} · المندوب:{" "}
                  {receipt.assignedCourierName}
                </p>
                <ul className="mt-3 space-y-1 text-sm">
                  {lines.map((line) => (
                    <li key={line.id}>
                      {line.deviceCode} · {line.modelName || "—"}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  className="mt-4 rounded-full bg-ink-900 px-4 py-2 text-sm text-white"
                  onClick={() => {
                    setError(null);
                    setMessage(null);
                    const result = approveCourierHandoverToMaintenance({
                      user,
                      receiptId: receipt.id,
                    });
                    if (!result.ok) {
                      setError(result.error);
                      return;
                    }
                    setMessage(
                      `تم اعتماد التسليم. الأجهزة الآن بانتظار الصيانة في المركز (${receipt.receiptNumber}).`,
                    );
                    refresh();
                  }}
                >
                  اعتماد التسليم للصيانة
                </button>
              </section>
            );
          })
        )}
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl">إرجاع مع المندوب</h2>
            <p className="mt-1 text-sm text-ink-700/70">
              للأجهزة الجاهزة للإرجاع وغير المدرجة في بوليصة شحن. يمكنك أيضاً اختيار «إرجاع مع
              المندوب» من صفحة بوليصات الشحن.
            </p>
          </div>
          <Link
            href="/maintenance/shipping"
            className="rounded-full border border-ink-900/15 bg-white px-4 py-2 text-sm text-ink-900 hover:border-aroma-400"
          >
            بوليصة شحن أو إرجاع
          </Link>
        </div>

        <div className="rounded-2xl border border-sky-300/70 bg-sky-50/80 px-4 py-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-medium text-ink-800">
              فروع لديها أجهزة جاهزة للإرجاع عبر المندوب
            </p>
            <p className="text-xs text-ink-700/65">
              {returnReadyBranches.length === 0
                ? "لا توجد أجهزة جاهزة حاليًا"
                : `${returnReadyBranches.length} فرع · ${returnDeviceTotal} جهاز`}
            </p>
          </div>
          {returnReadyBranches.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {returnReadyBranches.map((branch) => {
                const selectedBranch = branch.branchId === branchId;
                return (
                  <button
                    key={branch.branchId}
                    type="button"
                    onClick={() => {
                      setBranchId(branch.branchId);
                      setSelected([]);
                    }}
                    className={[
                      "rounded-full border px-3 py-1.5 text-sm transition",
                      selectedBranch
                        ? "border-aroma-500 bg-aroma-600 text-white"
                        : "border-ink-900/15 bg-white text-ink-900 hover:border-aroma-400",
                    ].join(" ")}
                  >
                    {branch.branchName}
                    <span className="ms-2 font-display text-base">{branch.readyCount}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="mt-3 rounded-xl border border-dashed border-ink-900/15 bg-white/70 px-3 py-4 text-sm text-ink-700/70">
              لا توجد فروع لديها أجهزة جاهزة للإرجاع عبر المندوب الآن. تظهر هنا فقط الفروع التي
              لديها جهاز واحد على الأقل بحالة «جاهز للإرجاع».
            </p>
          )}
        </div>

        {returnReadyBranches.length > 0 ? (
          <>
            <div className="grid gap-3 rounded-2xl border border-ink-900/10 bg-white p-5 shadow-panel md:grid-cols-2">
              <label className="block text-sm">
                الفرع
                <select
                  value={branchId}
                  onChange={(e) => {
                    setBranchId(e.target.value);
                    setSelected([]);
                  }}
                  className="mt-1 w-full rounded-xl border border-ink-900/15 px-3 py-2"
                >
                  {returnReadyBranches.map((b) => (
                    <option key={b.branchId} value={b.branchId}>
                      {b.branchName} ({b.readyCount} جاهز)
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                المندوب / الفني الناقل
                <select
                  value={courierId}
                  onChange={(e) => setCourierId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-ink-900/15 px-3 py-2"
                >
                  {couriers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.fullName} ({c.role === "pickup_courier" ? "مندوب" : "فني"})
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm md:col-span-2">
                ملاحظات
                <input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-ink-900/15 px-3 py-2"
                />
              </label>
            </div>

            <div className="space-y-2">
              {returnEligible.length === 0 ? (
                <p className="text-sm text-ink-700/70">
                  لا توجد أجهزة جاهزة للإرجاع عبر المندوب لهذا الفرع.
                </p>
              ) : (
                returnEligible.map(({ device, request }) => {
                  const checked = selected.includes(device.localId);
                  return (
                    <label
                      key={device.localId}
                      className="flex items-center gap-3 rounded-xl border border-ink-900/10 bg-white px-3 py-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) =>
                          setSelected((prev) =>
                            e.target.checked
                              ? [...prev, device.localId]
                              : prev.filter((id) => id !== device.localId),
                          )
                        }
                      />
                      <span>
                        {device.deviceCode} · {device.modelName} · طلب {request.requestNumber}
                      </span>
                    </label>
                  );
                })
              )}
            </div>

            <button
              type="button"
              className="rounded-full bg-ink-900 px-4 py-2 text-sm text-white"
              onClick={() => {
                setError(null);
                setMessage(null);
                if (!courier) {
                  setError("اختر مندوباً أو فنياً.");
                  return;
                }
                const result = createPickupReceipt({
                  user,
                  direction: "center_to_branch",
                  opsBranchId: branchId,
                  opsBranchName: branchName,
                  assignedCourierId: courier.id,
                  assignedCourierName: courier.fullName,
                  assignedCarrierRole: courier.role,
                  deviceLocalIds: selected,
                  notes,
                  submit: true,
                });
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                setMessage(
                  `تم إنشاء نموذج الإرجاع ${result.receipt.receiptNumber} وإرساله للمندوب.`,
                );
                setSelected([]);
                setNotes("");
                refresh();
              }}
            >
              إنشاء نموذج إرجاع للمندوب
            </button>
          </>
        ) : null}
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-2xl">أحدث النماذج</h2>
        {history.slice(0, 12).map((receipt) => (
          <div
            key={receipt.id}
            className="rounded-xl border border-ink-900/10 bg-white px-4 py-3 text-sm"
          >
            <p className="font-medium">
              {receipt.receiptNumber} · {PICKUP_RECEIPT_STATUS_LABELS[receipt.status]}
            </p>
            <p className="text-ink-700/60">
              {PICKUP_RECEIPT_DIRECTION_LABELS[receipt.direction]} · {receipt.opsBranchName} ·{" "}
              {receipt.assignedCourierName}
            </p>
          </div>
        ))}
      </section>
    </div>
  );
}

export default function MaintenanceCourierHandoverPage() {
  return (
    <RoleGuard
      allow={["maintenance_manager", "maintenance_supervisor", "system_admin"]}
      permission={["approve_courier_handover", "create_pickup_receipt"]}
    >
      <MaintenanceCourierHandoverContent />
    </RoleGuard>
  );
}
