"use client";

import { BrowserQRCodeReader, type IScannerControls } from "@zxing/browser";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { DeviceHistoryPanel } from "@/components/device-history-panel";
import { PageHeader } from "@/components/page-header";
import { isPickupCourierRole, isTechnicianRole, normalizeRole } from "@/lib/auth";
import {
  findDeviceByQrQuery,
  parseDeviceQrPayload,
  resolveDeviceScanRoute,
} from "@/lib/device-qr";
import { readSession } from "@/lib/session";
import { hydrateOpsFromSupabase } from "@/lib/supabase/hydrate";
import type { TechnicianQueueItem } from "@/lib/branch-store";
import type { Profile } from "@/types/domain";

function waitForVideoElement(
  getEl: () => HTMLVideoElement | null,
  attempts = 20,
): Promise<HTMLVideoElement | null> {
  return new Promise((resolve) => {
    let left = attempts;
    const tick = () => {
      const el = getEl();
      if (el) {
        resolve(el);
        return;
      }
      left -= 1;
      if (left <= 0) {
        resolve(null);
        return;
      }
      requestAnimationFrame(tick);
    };
    tick();
  });
}

function cameraErrorMessage(err: unknown): { text: string; fatal: boolean } {
  const name =
    err && typeof err === "object" && "name" in err ? String((err as { name: unknown }).name) : "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return {
      text: "تم رفض إذن الكاميرا. اسمح بالوصول من إعدادات المتصفح ثم اضغط «إعادة المحاولة».",
      fatal: false,
    };
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return {
      text: "لم يتم العثور على كاميرا على هذا الجهاز — الصق الكود يدويًا.",
      fatal: true,
    };
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return {
      text: "الكاميرا مشغولة بتطبيق آخر. أغلقه ثم أعد المحاولة، أو الصق الكود يدويًا.",
      fatal: false,
    };
  }
  return {
    text: "تعذر فتح الكاميرا. الصق كود الجهاز أو رابط QR يدويًا، أو أعد المحاولة.",
    fatal: false,
  };
}

function ScanPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const handledRef = useRef(false);

  const [user, setUser] = useState<Profile | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TechnicianQueueItem[]>([]);
  const [searched, setSearched] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [cameraAvailable, setCameraAvailable] = useState(true);
  const [permissionDenied, setPermissionDenied] = useState(false);

  function stopCamera() {
    try {
      controlsRef.current?.stop();
    } catch {
      /* ignore */
    }
    controlsRef.current = null;
    handledRef.current = false;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraOn(false);
    setCameraStarting(false);
  }

  function applyResolve(matches: TechnicianQueueItem[], session: Profile) {
    setResults(matches);
    setSearched(true);
    if (matches.length === 0) {
      setMessage(null);
      setError("لا يوجد جهاز مطابق لهذا الرمز.");
      return;
    }
    setError(null);

    // Single match → role-based routing
    if (matches.length === 1) {
      const route = resolveDeviceScanRoute(matches[0], session);
      if (route.kind === "technician_claim") {
        setMessage("جهاز جاهز للصيانة — جاري فتح مسار بدء العمل…");
        stopCamera();
        router.push(route.href);
        return;
      }
      if (route.kind === "courier_action") {
        setMessage("الجهاز لدى المندوب — جاري فتح نماذج الاستلام…");
        stopCamera();
        router.push(route.href);
        return;
      }
      // readonly: stay on scan with history (also link to detail)
      const role = normalizeRole(session.role);
      if (isTechnicianRole(session.role)) {
        setMessage("عرض للقراءة فقط — الجهاز ليس بانتظار بدء صيانة من دورك الحالي.");
      } else if (isPickupCourierRole(session.role)) {
        setMessage("عرض للقراءة فقط — الجهاز ليس في عهدة المندوب حاليًا.");
      } else if (role === "branch") {
        setMessage("ملف الجهاز (قراءة فقط) مع سجل الصيانة وقطع الغيار.");
      } else {
        setMessage("ملف الجهاز (قراءة فقط).");
      }
    }
  }

  function runSearch(raw: string, session?: Profile | null) {
    const current = session ?? user ?? readSession();
    if (!current) {
      setError("يجب تسجيل الدخول أولاً.");
      return;
    }
    const token = parseDeviceQrPayload(raw);
    if (!token) {
      setError("أدخل كود الجهاز أو امسح رمز QR.");
      return;
    }
    setQuery(token);
    const matches = findDeviceByQrQuery(token);
    applyResolve(matches, current);
  }

  useEffect(() => {
    const session = readSession();
    setUser(session);
    void hydrateOpsFromSupabase().then(() => {
      const fresh = readSession();
      setUser(fresh);
      const deep = searchParams?.get("d")?.trim() || searchParams?.get("code")?.trim();
      if (deep && fresh) {
        runSearch(deep, fresh);
      }
    });
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deep-link once from URL
  }, [searchParams]);

  async function startCamera() {
    setError(null);
    setMessage(null);
    setPermissionDenied(false);
    stopCamera();

    if (typeof window !== "undefined" && window.location.protocol === "file:") {
      setCameraAvailable(false);
      setError(
        "لا يمكن استخدام الكاميرا عند فتح الصفحة كملف محلي (file://). افتح الموقع عبر HTTPS أو localhost.",
      );
      return;
    }

    if (typeof window !== "undefined" && !window.isSecureContext) {
      setCameraAvailable(false);
      setError("الكاميرا تحتاج سياقًا آمنًا (HTTPS أو localhost).");
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraAvailable(false);
      setError("الكاميرا غير متاحة على هذا الجهاز — الصق الكود يدويًا.");
      return;
    }

    setCameraStarting(true);
    setCameraOn(true);

    const video = await waitForVideoElement(() => videoRef.current);
    if (!video) {
      setCameraStarting(false);
      setCameraOn(false);
      setError("تعذر تجهيز معاينة الكاميرا. أعد المحاولة أو الصق الكود يدويًا.");
      return;
    }

    try {
      const reader = new BrowserQRCodeReader(undefined, {
        delayBetweenScanAttempts: 250,
        delayBetweenScanSuccess: 800,
      });

      handledRef.current = false;
      const controls = await reader.decodeFromConstraints(
        {
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        },
        video,
        (result, _err, ctrl) => {
          if (!result || handledRef.current) return;
          const raw = result.getText()?.trim();
          if (!raw) return;
          handledRef.current = true;
          try {
            ctrl.stop();
          } catch {
            /* ignore */
          }
          stopCamera();
          runSearch(raw);
        },
      );

      controlsRef.current = controls;
      setCameraStarting(false);
      setMessage("وجّه الكاميرا نحو ملصق QR…");
    } catch (err) {
      stopCamera();
      const { text, fatal } = cameraErrorMessage(err);
      const name =
        err && typeof err === "object" && "name" in err
          ? String((err as { name: unknown }).name)
          : "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setPermissionDenied(true);
      }
      if (fatal) setCameraAvailable(false);
      setError(text);
    }
  }

  const showCameraButton = cameraAvailable;

  return (
    <div>
      <PageHeader
        title="مسح جهاز"
        description="امسح ملصق QR أو الصق الكود — بعد الدخول يوجّهك النظام حسب دورك وحالة الجهاز."
      />

      <form
        className="flex flex-wrap gap-3 rounded-2xl border border-ink-900/10 bg-white p-4 shadow-panel dark:border-white/10 dark:bg-ink-900"
        onSubmit={(event) => {
          event.preventDefault();
          runSearch(query);
        }}
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="كود الجهاز / السيريال / رابط QR"
          className="min-w-[240px] flex-1 rounded-xl border border-ink-900/15 px-3 py-2 dark:border-white/15 dark:bg-ink-950"
        />
        <button
          type="submit"
          className="rounded-full bg-ink-900 px-5 py-2 text-sm text-white dark:bg-sand-100 dark:text-ink-900"
        >
          عرض / توجيه
        </button>
        {showCameraButton ? (
          <button
            type="button"
            disabled={cameraStarting}
            onClick={() => (cameraOn ? stopCamera() : void startCamera())}
            className="rounded-full border border-ink-900/20 px-5 py-2 text-sm disabled:opacity-60 dark:border-white/20"
          >
            {cameraStarting
              ? "جاري فتح الكاميرا…"
              : cameraOn
                ? "إيقاف الكاميرا"
                : permissionDenied
                  ? "إعادة المحاولة"
                  : "فتح الكاميرا"}
          </button>
        ) : null}
      </form>

      {cameraOn ? (
        <div className="mt-4 overflow-hidden rounded-2xl border border-ink-900/10 bg-ink-950">
          <video
            ref={videoRef}
            className="mx-auto max-h-72 w-full object-cover"
            muted
            playsInline
            autoPlay
          />
          {cameraStarting ? (
            <p className="px-4 py-3 text-center text-sm text-sand-100/80">جاري طلب إذن الكاميرا…</p>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="mt-4 text-sm text-rose-700 dark:text-rose-300">{error}</p> : null}
      {message ? <p className="mt-4 text-sm text-aroma-700 dark:text-aroma-200">{message}</p> : null}

      <div className="mt-6 space-y-4">
        {!searched ? (
          <p className="text-sm text-ink-700/70 dark:text-sand-100/70">
            امسح الملصق أو أدخل المعرّف لفتح الجهاز.
          </p>
        ) : results.length === 0 ? null : (
          results.map(({ request, device }) => (
            <div key={`${request.id}-${device.localId}`} className="space-y-3">
              <DeviceHistoryPanel request={request} device={device} compact />
              <div className="flex flex-wrap gap-3">
                <Link
                  href={`/devices/detail/?id=${encodeURIComponent(device.localId)}`}
                  className="rounded-full border border-ink-900/15 px-4 py-2 text-sm dark:border-white/15"
                >
                  فتح ملف الجهاز
                </Link>
                {user && isTechnicianRole(user.role) ? (
                  <Link
                    href={`/technician/work/?claim=${encodeURIComponent(device.localId)}`}
                    className="rounded-full bg-ink-900 px-4 py-2 text-sm text-white dark:bg-aroma-600"
                  >
                    محاولة بدء الصيانة
                  </Link>
                ) : null}
                {user && isPickupCourierRole(user.role) ? (
                  <Link
                    href={`/courier/receipts/?d=${encodeURIComponent(device.localId)}`}
                    className="rounded-full bg-ink-900 px-4 py-2 text-sm text-white dark:bg-aroma-600"
                  >
                    نماذج الاستلام
                  </Link>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function ScanPage() {
  return (
    <Suspense fallback={<p className="text-sm text-ink-700/70">جاري التحميل…</p>}>
      <ScanPageContent />
    </Suspense>
  );
}
