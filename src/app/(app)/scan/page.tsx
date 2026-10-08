"use client";

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

type BarcodeDetectorLike = {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>;
};

function ScanPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanLoopRef = useRef<number | null>(null);

  const [user, setUser] = useState<Profile | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TechnicianQueueItem[]>([]);
  const [searched, setSearched] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraSupported, setCameraSupported] = useState(true);

  function stopCamera() {
    if (scanLoopRef.current != null) {
      window.clearInterval(scanLoopRef.current);
      scanLoopRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
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
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraSupported(false);
      setError("الكاميرا غير متاحة على هذا الجهاز — الصق الكود يدويًا.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraOn(true);

      const Detector = (
        window as unknown as { BarcodeDetector?: new (opts?: { formats: string[] }) => BarcodeDetectorLike }
      ).BarcodeDetector;

      if (!Detector) {
        setMessage("المتصفح لا يدعم قراءة QR تلقائيًا — صوّر الملصق أو الصق الرابط/الكود أدناه.");
        return;
      }

      const detector = new Detector({ formats: ["qr_code"] });
      scanLoopRef.current = window.setInterval(() => {
        const video = videoRef.current;
        if (!video || video.readyState < 2) return;
        void detector
          .detect(video)
          .then((codes) => {
            const raw = codes[0]?.rawValue?.trim();
            if (!raw) return;
            stopCamera();
            runSearch(raw);
          })
          .catch(() => {
            /* ignore frame errors */
          });
      }, 700);
    } catch {
      setCameraSupported(false);
      setError("تعذر فتح الكاميرا. الصق كود الجهاز أو رابط QR يدويًا.");
    }
  }

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
        {cameraSupported ? (
          <button
            type="button"
            onClick={() => (cameraOn ? stopCamera() : void startCamera())}
            className="rounded-full border border-ink-900/20 px-5 py-2 text-sm dark:border-white/20"
          >
            {cameraOn ? "إيقاف الكاميرا" : "فتح الكاميرا"}
          </button>
        ) : null}
      </form>

      {cameraOn ? (
        <div className="mt-4 overflow-hidden rounded-2xl border border-ink-900/10 bg-ink-950">
          <video ref={videoRef} className="mx-auto max-h-72 w-full object-cover" muted playsInline />
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
