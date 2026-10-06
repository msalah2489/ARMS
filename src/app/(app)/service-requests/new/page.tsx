"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ClickableImage, ImagePlaceholder } from "@/components/clickable-image";
import { DeviceFormModal } from "@/components/device-form-modal";
import { PageHeader } from "@/components/page-header";
import { RoleGuard } from "@/components/role-guard";
import { usePreferences } from "@/components/preferences-provider";
import { EXTERNAL_CONDITION_LABELS, generateRequestNumber, isValidSaudiMobile } from "@/lib/branch-catalog";
import {
  ASSIGNMENT_PATH_LABELS,
  findCustomersByMobile,
  findCustomersByName,
  saveMaintenanceRequest,
} from "@/lib/branch-store";
import { readSession } from "@/lib/session";
import type {
  BranchPriority,
  DraftRequestDevice,
  MaintenanceAssignmentPath,
  Profile,
} from "@/types/domain";

function NewServiceRequestContent() {
  const router = useRouter();
  const { t } = usePreferences();
  const [user, setUser] = useState<Profile | null>(null);
  const [requestNumber, setRequestNumber] = useState("");
  const [priority, setPriority] = useState<BranchPriority>("normal");
  const [assignmentPath, setAssignmentPath] =
    useState<MaintenanceAssignmentPath>("service_center");
  const [mobile, setMobile] = useState("");
  const [contactName, setContactName] = useState("");
  const [purchaseInvoice, setPurchaseInvoice] = useState("");
  const [generalNotes, setGeneralNotes] = useState("");
  const [devices, setDevices] = useState<DraftRequestDevice[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const session = readSession();
    setUser(session);
    setRequestNumber(generateRequestNumber());
  }, []);

  const receivedAtLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("ar-SA", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date()),
    [],
  );

  if (!user) {
    return <p className="text-sm text-ink-700/70 dark:text-sand-100/70">{t("common.loading")}</p>;
  }

  return (
    <div>
      <PageHeader
        title="إنشاء طلب صيانة"
        description="تسجيل استلام أجهزة من العميل مع بيانات الطلب والأجهزة المرفقة."
        action={
          <Link
            href="/service-requests"
            className="rounded-full border border-ink-900/15 bg-white px-4 py-2 text-sm text-ink-900 hover:border-aroma-400 dark:border-white/15 dark:bg-ink-900 dark:text-sand-50 dark:hover:border-aroma-400"
          >
            {t("serviceRequests.backToList")}
          </Link>
        }
      />

      <div className="space-y-6 rounded-2xl border border-ink-900/10 bg-white p-6 shadow-panel dark:border-white/10 dark:bg-ink-900">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm dark:text-sand-100">
            رقم الطلب
            <input
              value={requestNumber}
              readOnly
              className="mt-1 w-full rounded-xl border border-ink-900/15 bg-sand-50 px-3 py-2 dark:border-white/15 dark:bg-ink-950 dark:text-sand-50"
            />
          </label>
          <label className="block text-sm dark:text-sand-100">
            تاريخ ووقت الاستلام
            <input
              value={receivedAtLabel}
              readOnly
              className="mt-1 w-full rounded-xl border border-ink-900/15 bg-sand-50 px-3 py-2 dark:border-white/15 dark:bg-ink-950 dark:text-sand-50"
            />
          </label>
          <label className="block text-sm dark:text-sand-100">
            الفرع
            <input
              value={user.opsBranchName || "—"}
              readOnly
              className="mt-1 w-full rounded-xl border border-ink-900/15 bg-sand-50 px-3 py-2 dark:border-white/15 dark:bg-ink-950 dark:text-sand-50"
            />
          </label>
          <label className="block text-sm dark:text-sand-100">
            مسؤول الفرع
            <input
              value={user.fullName}
              readOnly
              className="mt-1 w-full rounded-xl border border-ink-900/15 bg-sand-50 px-3 py-2 dark:border-white/15 dark:bg-ink-950 dark:text-sand-50"
            />
          </label>
          <label className="block text-sm dark:text-sand-100">
            أولوية الطلب
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as BranchPriority)}
              className="mt-1 w-full rounded-xl border border-ink-900/15 px-3 py-2 dark:border-white/15 dark:bg-ink-950 dark:text-sand-50"
            >
              <option value="normal">عادي</option>
              <option value="urgent">عاجل</option>
            </select>
          </label>
          <label className="block text-sm dark:text-sand-100">
            مسار الصيانة *
            <select
              value={assignmentPath}
              onChange={(e) =>
                setAssignmentPath(e.target.value as MaintenanceAssignmentPath)
              }
              className="mt-1 w-full rounded-xl border border-ink-900/15 px-3 py-2 dark:border-white/15 dark:bg-ink-950 dark:text-sand-50"
            >
              <option value="service_center">
                {ASSIGNMENT_PATH_LABELS.service_center}
              </option>
              <option value="mobile_technician">
                {ASSIGNMENT_PATH_LABELS.mobile_technician}
              </option>
            </select>
          </label>
          <label className="block text-sm dark:text-sand-100">
            رقم الجوال *
            <input
              value={mobile}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, "").slice(0, 10);
                setMobile(value);
                const hits = findCustomersByMobile(value);
                if (hits[0]) setContactName(hits[0].contactName);
              }}
              placeholder="05xxxxxxxx"
              className="mt-1 w-full rounded-xl border border-ink-900/15 px-3 py-2 dark:border-white/15 dark:bg-ink-950 dark:text-sand-50"
            />
          </label>
          <label className="block text-sm md:col-span-2 dark:text-sand-100">
            اسم جهة التواصل *
            <input
              value={contactName}
              onChange={(e) => {
                setContactName(e.target.value);
                const hits = findCustomersByName(e.target.value);
                if (hits[0] && !mobile) setMobile(hits[0].mobile);
              }}
              className="mt-1 w-full rounded-xl border border-ink-900/15 px-3 py-2 dark:border-white/15 dark:bg-ink-950 dark:text-sand-50"
            />
          </label>
          <label className="block text-sm dark:text-sand-100">
            رقم فاتورة الشراء
            <input
              value={purchaseInvoice}
              onChange={(e) => setPurchaseInvoice(e.target.value)}
              className="mt-1 w-full rounded-xl border border-ink-900/15 px-3 py-2 dark:border-white/15 dark:bg-ink-950 dark:text-sand-50"
            />
          </label>
          <label className="block text-sm dark:text-sand-100">
            ملاحظات عامة على الطلب
            <input
              value={generalNotes}
              onChange={(e) => setGeneralNotes(e.target.value)}
              className="mt-1 w-full rounded-xl border border-ink-900/15 px-3 py-2 dark:border-white/15 dark:bg-ink-950 dark:text-sand-50"
            />
          </label>
        </div>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-xl dark:text-sand-50">الأجهزة المستلمة في هذا الطلب</h2>
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="rounded-full bg-aroma-500 px-4 py-2 text-sm text-white hover:bg-aroma-600"
            >
              إضافة جهاز
            </button>
          </div>

          <div className="arms-scroll-x mt-4">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-ink-900/10 text-right text-ink-700/70 dark:border-white/10 dark:text-sand-100/70">
                  <th className="px-2 py-2 font-medium">الصورة</th>
                  <th className="px-2 py-2 font-medium">كود الجهاز</th>
                  <th className="px-2 py-2 font-medium">الموديل</th>
                  <th className="px-2 py-2 font-medium">السيريال</th>
                  <th className="px-2 py-2 font-medium">شكوى العميل</th>
                  <th className="px-2 py-2 font-medium">الحالة الخارجية</th>
                  <th className="px-2 py-2 font-medium">الملحقات</th>
                  <th className="px-2 py-2 font-medium">الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {devices.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-2 py-6 text-ink-700/60 dark:text-sand-100/60">
                      لم تتم إضافة أجهزة بعد.
                    </td>
                  </tr>
                ) : (
                  devices.map((device) => (
                    <tr key={device.localId} className="border-b border-ink-900/5 dark:border-white/5">
                      <td className="px-2 py-3">
                        {device.deviceImageDataUrl ? (
                          <ClickableImage
                            src={device.deviceImageDataUrl}
                            alt={device.deviceCode}
                            size="sm"
                          />
                        ) : (
                          <ImagePlaceholder size="sm" />
                        )}
                      </td>
                      <td className="px-2 py-3 font-medium dark:text-sand-50">{device.deviceCode}</td>
                      <td className="px-2 py-3 dark:text-sand-100">{device.modelName}</td>
                      <td className="px-2 py-3 dark:text-sand-100">{device.serialNumber || "—"}</td>
                      <td className="px-2 py-3 dark:text-sand-100">{device.fault || "—"}</td>
                      <td className="px-2 py-3 dark:text-sand-100">
                        {EXTERNAL_CONDITION_LABELS[device.externalCondition]}
                      </td>
                      <td className="px-2 py-3 dark:text-sand-100">
                        {device.accessoryNames.join("، ") || "—"}
                      </td>
                      <td className="px-2 py-3">
                        <button
                          type="button"
                          onClick={() =>
                            setDevices((prev) => prev.filter((item) => item.localId !== device.localId))
                          }
                          className="text-rose-700 dark:text-rose-300"
                        >
                          حذف
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {error ? <p className="text-sm text-rose-700 dark:text-rose-300">{error}</p> : null}
        {success ? <p className="text-sm text-aroma-700 dark:text-aroma-200">{success}</p> : null}

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => {
              setError(null);
              setSuccess(null);
              if (!isValidSaudiMobile(mobile)) {
                setError("رقم الجوال يجب أن يبدأ بـ 05 ويتكون من 10 أرقام.");
                return;
              }
              if (!contactName.trim()) {
                setError("اسم جهة التواصل إلزامي.");
                return;
              }
              if (!devices.length) {
                setError("أضف جهازًا واحدًا على الأقل قبل حفظ الطلب.");
                return;
              }
              try {
                const saved = saveMaintenanceRequest({
                  user,
                  priority,
                  assignmentPath,
                  customerMobile: mobile,
                  contactName: contactName.trim(),
                  purchaseInvoice,
                  generalNotes,
                  devices,
                  requestNumber,
                });
                setSuccess(`تم حفظ الطلب ${saved.requestNumber} بنجاح.`);
                setTimeout(() => router.push("/dashboard"), 700);
              } catch (err) {
                setError(err instanceof Error ? err.message : "تعذر حفظ الطلب.");
              }
            }}
            className="rounded-full bg-ink-900 px-6 py-2.5 text-sm text-white dark:bg-aroma-600"
          >
            حفظ الطلب
          </button>
          <Link
            href="/service-requests"
            className="rounded-full border border-ink-900/15 px-6 py-2.5 text-sm text-ink-900 dark:border-white/15 dark:text-sand-50"
          >
            {t("common.back")}
          </Link>
        </div>
      </div>

      <DeviceFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={(device, addAnother) => {
          setDevices((prev) => [...prev, device]);
          setModalOpen(addAnother);
        }}
      />
    </div>
  );
}

export default function NewServiceRequestPage() {
  return (
    <RoleGuard allow="branch">
      <NewServiceRequestContent />
    </RoleGuard>
  );
}
