/**
 * Browser Web Push subscribe / unsubscribe for ARMS staff devices.
 * Sending uses Supabase Edge Function + VAPID private secret (never in client).
 */
import { isDemoMode } from "@/lib/auth";
import { getAppBasePath } from "@/lib/device-qr";
import { createClient } from "@/lib/supabase/client";
import {
  getSupabaseAnonKey,
  getSupabaseUrl,
  isSupabaseConfigured,
} from "@/lib/supabase/config";
import type { ArmsNotification, Profile } from "@/types/domain";

const PROMPT_DISMISSED_KEY = "arms_web_push_prompt_dismissed_v1";
const VAPID_FP_KEY = "arms_vapid_public_fp_v1";
const SW_PATH = "/sw.js";

export type WebPushSupportState =
  | "unsupported"
  | "ios_not_standalone"
  | "denied"
  | "default"
  | "granted"
  | "demo"
  | "no_supabase"
  | "no_vapid";

export type WebPushDeliveryResult = {
  ok: boolean;
  sent?: number;
  total?: number;
  removed?: number;
  skipped?: string;
  error?: string;
  httpStatus?: number;
  failures?: Array<{ id: string; status: number; message: string }>;
};

function getVapidPublicKey(): string {
  return (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "").trim();
}

export function isWebPushConfigured(): boolean {
  return Boolean(getVapidPublicKey()) && isSupabaseConfigured() && !isDemoMode();
}

/** True when the public VAPID key was inlined at build time. */
export function hasVapidPublicKey(): boolean {
  return Boolean(getVapidPublicKey());
}

/** iPhone / iPad (incl. iPadOS desktop UA spoof). */
export function isAppleMobileDevice(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (/iPad|iPhone|iPod/i.test(ua)) return true;
  // iPadOS 13+ may report as Mac with touch.
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

/** Home Screen / installed PWA (required for Web Push on iOS). */
export function isStandaloneWebApp(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.matchMedia("(display-mode: standalone)").matches) return true;
  } catch {
    /* ignore */
  }
  const nav = navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true;
}

/**
 * Arabic hint for why the enable UI is unavailable or what to do next.
 * Empty string when the user can enable push normally (`default`).
 */
export function getWebPushStatusMessage(state: WebPushSupportState = getWebPushSupportState()): string {
  switch (state) {
    case "no_vapid":
      return "إشعارات المتصفح غير مفعّلة في هذا البناء: مفتاح VAPID العام ناقص. أضف NEXT_PUBLIC_VAPID_PUBLIC_KEY في GitHub Actions ثم أعد النشر.";
    case "no_supabase":
      return "إشعارات المتصفح تحتاج اتصال Supabase مضبوطاً في البناء.";
    case "demo":
      return "وضع العرض التجريبي لا يدعم إشعارات المتصفح.";
    case "ios_not_standalone":
      return "على الآيفون/الآيباد: افتح الموقع في Safari ثم مشاركة ← إضافة إلى الشاشة الرئيسية، وافتح ARMS من الأيقونة (ليس من تبويب Safari)، ثم فعّل الإشعارات من داخل التطبيق.";
    case "unsupported":
      return "هذا المتصفح أو الجهاز لا يدعم إشعارات الدفع (أو الاتصال ليس عبر HTTPS).";
    case "denied":
      return "إذن الإشعارات مرفوض لهذا الموقع. امسح الحظر من إعدادات الموقع/التطبيق ثم أعد المحاولة.";
    case "granted":
      return "إذن الإشعارات مفعّل على هذا الجهاز. إن لم يصل إشعار النظام، اضغط «إعادة ربط إشعارات الجهاز» وتأكد من نشر دالة send-web-push.";
    case "default":
    default:
      return "";
  }
}

let warnedMissingVapid = false;

export function getWebPushSupportState(): WebPushSupportState {
  if (typeof window === "undefined") return "unsupported";
  if (isDemoMode()) return "demo";
  if (!isSupabaseConfigured()) return "no_supabase";
  if (!getVapidPublicKey()) {
    if (!warnedMissingVapid && typeof console !== "undefined") {
      warnedMissingVapid = true;
      console.warn(
        "[arms] Web Push unavailable: NEXT_PUBLIC_VAPID_PUBLIC_KEY was empty at build time.",
      );
    }
    return "no_vapid";
  }

  const hasPushApis =
    "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;

  // iOS/iPadOS: Web Push only inside a Home Screen web app (standalone).
  if (isAppleMobileDevice() && !isStandaloneWebApp()) {
    return "ios_not_standalone";
  }

  if (!hasPushApis) {
    return "unsupported";
  }

  const permission = Notification.permission;
  if (permission === "denied") return "denied";
  if (permission === "granted") return "granted";
  return "default";
}

/** Clear the “later” dismiss so the bottom banner can appear again. */
export function clearWebPushPromptDismissed() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(PROMPT_DISMISSED_KEY);
  } catch {
    /* ignore */
  }
}

export function wasWebPushPromptDismissed(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(PROMPT_DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

export function dismissWebPushPrompt() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PROMPT_DISMISSED_KEY, "1");
  } catch {
    /* ignore */
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

function bufferSourceToBase64Url(source: BufferSource): string {
  const bytes =
    source instanceof ArrayBuffer
      ? new Uint8Array(source)
      : new Uint8Array(source.buffer, source.byteOffset, source.byteLength);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function applicationServerKeysMatch(
  existing: PushSubscription,
  expected: Uint8Array,
): boolean {
  try {
    const options = existing.options as PushSubscriptionOptions | undefined;
    const key = options?.applicationServerKey;
    if (!key) return true; // older engines — fall back to fingerprint / reuse
    return bufferSourceToBase64Url(key) === bufferSourceToBase64Url(expected);
  } catch {
    return true;
  }
}

function subscriptionId(endpoint: string): string {
  // Stable id from endpoint so re-subscribe upserts the same row.
  let hash = 0;
  for (let i = 0; i < endpoint.length; i += 1) {
    hash = (hash * 31 + endpoint.charCodeAt(i)) | 0;
  }
  const abs = Math.abs(hash).toString(16);
  return `push_${abs}_${endpoint.length}`;
}

function swScriptUrl(): string {
  const base = getAppBasePath();
  return `${base}${SW_PATH}`;
}

function swScope(): string {
  const base = getAppBasePath();
  return `${base}/`;
}

/** In-app deep link path for the SW (respects GitHub Pages basePath `/ARMS`). */
function notificationOpenPath(): string {
  return "/";
}

function vapidFingerprint(key: string): string {
  return key.slice(0, 24);
}

function readStoredVapidFingerprint(): string | null {
  try {
    return window.localStorage.getItem(VAPID_FP_KEY);
  } catch {
    return null;
  }
}

function storeVapidFingerprint(key: string) {
  try {
    window.localStorage.setItem(VAPID_FP_KEY, vapidFingerprint(key));
  } catch {
    /* ignore */
  }
}

export async function registerArmsServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register(swScriptUrl(), { scope: swScope() });
  } catch (error) {
    console.warn("[arms] service worker register failed", error);
    return null;
  }
}

/** True when this browser already has an active PushSubscription. */
export async function hasActivePushSubscription(): Promise<boolean> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return false;
  try {
    const registration =
      (await navigator.serviceWorker.getRegistration(swScope())) ??
      (await navigator.serviceWorker.getRegistration());
    if (!registration) return false;
    const sub = await registration.pushManager.getSubscription();
    return Boolean(sub?.endpoint);
  } catch {
    return false;
  }
}

async function persistSubscription(userId: string, subscription: PushSubscription) {
  const json = subscription.toJSON();
  const endpoint = json.endpoint ?? subscription.endpoint;
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!endpoint || !p256dh || !auth) {
    throw new Error("Incomplete push subscription keys.");
  }

  const row = {
    id: subscriptionId(endpoint),
    user_id: userId,
    endpoint,
    p256dh,
    auth,
    user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 400) : null,
    updated_at: new Date().toISOString(),
    synced_at: new Date().toISOString(),
  };

  const supabase = createClient();
  const { error } = await supabase.from("app_push_subscriptions").upsert(row, {
    onConflict: "id",
  });
  if (error) {
    if (/does not exist|Could not find the table|PGRST/i.test(error.message ?? "")) {
      throw new Error(
        "جدول app_push_subscriptions غير موجود — شغّل ملف SQL رقم 026 في Supabase.",
      );
    }
    throw new Error(error.message || "تعذّر حفظ اشتراك الإشعارات.");
  }
}

async function getOrCreatePushSubscription(
  registration: ServiceWorkerRegistration,
): Promise<PushSubscription> {
  const vapid = getVapidPublicKey();
  const applicationServerKey = urlBase64ToUint8Array(vapid) as BufferSource;
  const expectedKey = urlBase64ToUint8Array(vapid);
  const storedFp = readStoredVapidFingerprint();
  const currentFp = vapidFingerprint(vapid);
  let existing = await registration.pushManager.getSubscription();

  const keyRotated =
    (storedFp && storedFp !== currentFp) ||
    (existing ? !applicationServerKeysMatch(existing, expectedKey) : false);

  // Public key rotated / mismatched — drop old PushSubscription so keys match Edge secrets.
  if (existing && keyRotated) {
    try {
      await existing.unsubscribe();
    } catch {
      /* ignore */
    }
    existing = null;
  }

  if (existing) {
    storeVapidFingerprint(vapid);
    return existing;
  }

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey,
  });
  storeVapidFingerprint(vapid);
  return subscription;
}

/**
 * Request permission (if needed), subscribe this browser, store row for user.
 */
export async function enableWebPushForUser(
  user: Profile,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const state = getWebPushSupportState();
  if (state === "ios_not_standalone") {
    return { ok: false, error: getWebPushStatusMessage("ios_not_standalone") };
  }
  if (!isWebPushConfigured()) {
    return { ok: false, error: "Web Push غير مضبوط (مفتاح VAPID العام أو Supabase)." };
  }
  if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    return { ok: false, error: "المتصفح لا يدعم إشعارات الدفع." };
  }

  let permission = Notification.permission;
  if (permission === "default") {
    permission = await Notification.requestPermission();
  }
  if (permission !== "granted") {
    return { ok: false, error: "تم رفض إذن الإشعارات من المتصفح." };
  }

  const registration = await registerArmsServiceWorker();
  if (!registration) {
    return { ok: false, error: "تعذّر تسجيل Service Worker." };
  }

  try {
    await navigator.serviceWorker.ready;
    // Ensure the SW controls this client so push → showNotification is reliable.
    if (registration.waiting) {
      registration.waiting.postMessage?.({ type: "SKIP_WAITING" });
    }
    const subscription = await getOrCreatePushSubscription(registration);
    await persistSubscription(user.id, subscription);
    dismissWebPushPrompt();
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[arms] enableWebPushForUser", error);
    return { ok: false, error: message };
  }
}

/**
 * If permission already granted, ensure SW + subscription row exist (silent).
 */
export async function ensureWebPushSubscription(user: Profile): Promise<void> {
  if (!isWebPushConfigured()) return;
  if (typeof window === "undefined") return;
  if (getWebPushSupportState() === "ios_not_standalone") return;
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    await enableWebPushForUser(user);
  } catch (error) {
    console.warn("[arms] ensureWebPushSubscription", error);
  }
}

function formatDeliveryHint(result: WebPushDeliveryResult): string {
  if (result.ok && (result.sent ?? 0) > 0) {
    return `تم إرسال إشعار النظام إلى ${result.sent} جهاز/أجهزة.`;
  }
  if (result.skipped === "no subscriptions") {
    return "لم يُحفظ أي اشتراك أجهزة (app_push_subscriptions فارغ). على الجهاز المستقبل: فعّل إشعارات المتصفح من الجرس.";
  }
  if (result.skipped === "no target users") {
    return "لا يوجد مستلمون مطابقون للجمهور المحدد.";
  }
  if (result.error) {
    if (/VAPID/i.test(result.error)) {
      return `فشل Web Push (VAPID): ${result.error} — تأكد أن مفتاح GitHub العام يطابق أسرار Edge Function ثم أعد deploy.`;
    }
    return `فشل Web Push: ${result.error}`;
  }
  if ((result.sent ?? 0) === 0) {
    return "لم يصل إشعار النظام لأي جهاز (sent=0). راجع سجلات send-web-push واشتراكات الأجهزة.";
  }
  return "تعذّر تأكيد إرسال إشعار النظام.";
}

export function getWebPushDeliveryMessage(result: WebPushDeliveryResult): string {
  return formatDeliveryHint(result);
}

/**
 * Ask Edge Function to deliver Web Push for an in-app notification.
 * Uses a minimal fetch (anon JWT + apikey) to avoid CORS preflight header mismatches.
 * Best-effort — never blocks the in-app notification path when fire-and-forget.
 */
export async function requestWebPushDelivery(
  notification: ArmsNotification,
): Promise<WebPushDeliveryResult> {
  if (!isWebPushConfigured() || typeof window === "undefined") {
    return {
      ok: false,
      error: "Web Push غير مضبوط في هذا البناء (VAPID أو Supabase).",
      sent: 0,
    };
  }

  const baseUrl = getSupabaseUrl().replace(/\/$/, "");
  const anonKey = getSupabaseAnonKey();
  if (!baseUrl || !anonKey) {
    return { ok: false, error: "إعدادات Supabase ناقصة.", sent: 0 };
  }

  const body = {
    notificationId: notification.id,
    title: notification.title,
    body: notification.body,
    audienceType: notification.audienceType,
    audienceRole: notification.audienceRole ?? null,
    audienceUserId: notification.audienceUserId ?? null,
    url: notificationOpenPath(),
  };

  try {
    const response = await fetch(`${baseUrl}/functions/v1/send-web-push`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
      body: JSON.stringify(body),
    });

    type SendWebPushResponse = {
      ok?: boolean;
      error?: string;
      sent?: number;
      total?: number;
      removed?: number;
      skipped?: string;
      failures?: Array<{ id: string; status: number; message: string }>;
    };
    let payload: SendWebPushResponse | null = null;
    try {
      payload = (await response.json()) as SendWebPushResponse;
    } catch {
      payload = null;
    }

    if (!response.ok) {
      const error = payload?.error ?? (response.statusText || `HTTP ${response.status}`);
      console.warn("[arms] send-web-push HTTP", response.status, error);
      return {
        ok: false,
        error,
        httpStatus: response.status,
        sent: 0,
      };
    }

    if (payload && payload.ok === false) {
      console.warn("[arms] send-web-push:", payload.error ?? "unknown error");
      return {
        ok: false,
        error: payload.error ?? "unknown error",
        sent: payload.sent ?? 0,
        skipped: payload.skipped,
        failures: payload.failures,
      };
    }

    const sent = typeof payload?.sent === "number" ? payload.sent : undefined;
    if (sent === 0) {
      console.info(
        "[arms] send-web-push: no devices reached",
        payload?.skipped ?? "check app_push_subscriptions",
      );
    }

    return {
      ok: true,
      sent,
      total: payload?.total,
      removed: payload?.removed,
      skipped: payload?.skipped,
      failures: payload?.failures,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn("[arms] requestWebPushDelivery", error);
    return { ok: false, error: message, sent: 0 };
  }
}

/**
 * Send a one-device test push to the signed-in user (after they enabled this browser).
 */
export async function sendTestWebPushToUser(user: Profile): Promise<WebPushDeliveryResult> {
  const ensure = await enableWebPushForUser(user);
  if (!ensure.ok) {
    return { ok: false, error: ensure.error, sent: 0 };
  }

  const testNotification: ArmsNotification = {
    id: `test_${crypto.randomUUID()}`,
    title: "اختبار إشعار ARMS",
    body: "إذا ظهر هذا في شريط إشعارات النظام، فـ Web Push يعمل على هذا الجهاز.",
    audienceType: "user",
    audienceRole: null,
    audienceUserId: user.id,
    createdBy: "system",
    createdByName: "النظام",
    createdAt: new Date().toISOString(),
  };

  return requestWebPushDelivery(testNotification);
}
