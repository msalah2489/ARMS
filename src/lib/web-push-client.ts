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
  | "denied"
  | "default"
  | "granted"
  | "demo"
  | "no_supabase"
  | "no_vapid";

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

/**
 * Arabic hint for why the enable UI is unavailable or what to do next.
 * Empty string when the user can enable push normally (`default` / `granted`).
 */
export function getWebPushStatusMessage(state: WebPushSupportState = getWebPushSupportState()): string {
  switch (state) {
    case "no_vapid":
      return "إشعارات المتصفح غير مفعّلة في هذا البناء: مفتاح VAPID العام ناقص. أضف NEXT_PUBLIC_VAPID_PUBLIC_KEY في GitHub Actions ثم أعد النشر.";
    case "no_supabase":
      return "إشعارات المتصفح تحتاج اتصال Supabase مضبوطاً في البناء.";
    case "demo":
      return "وضع العرض التجريبي لا يدعم إشعارات المتصفح.";
    case "unsupported":
      return "هذا المتصفح أو الجهاز لا يدعم إشعارات الدفع (أو الاتصال ليس عبر HTTPS).";
    case "denied":
      return "إذن الإشعارات مرفوض لهذا الموقع. امسح الحظر من إعدادات الموقع في المتصفح ثم أعد المحاولة.";
    case "granted":
      return "إذن الإشعارات مفعّل على هذا الجهاز.";
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
  if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
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
  const storedFp = readStoredVapidFingerprint();
  const currentFp = vapidFingerprint(vapid);
  let existing = await registration.pushManager.getSubscription();

  // Public key rotated in a new deploy — drop old PushSubscription so keys match Edge secrets.
  if (existing && storedFp && storedFp !== currentFp) {
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
  if (!isWebPushConfigured()) {
    return { ok: false, error: "Web Push غير مضبوط (مفتاح VAPID العام أو Supabase)." };
  }
  if (!("Notification" in window) || !("serviceWorker" in navigator)) {
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
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    await enableWebPushForUser(user);
  } catch (error) {
    console.warn("[arms] ensureWebPushSubscription", error);
  }
}

/**
 * Ask Edge Function to deliver Web Push for an in-app notification.
 * Uses a minimal fetch (anon JWT + apikey) to avoid CORS preflight header mismatches.
 * Best-effort — never blocks the in-app notification path.
 */
export async function requestWebPushDelivery(notification: ArmsNotification): Promise<void> {
  if (!isWebPushConfigured() || typeof window === "undefined") return;

  const baseUrl = getSupabaseUrl().replace(/\/$/, "");
  const anonKey = getSupabaseAnonKey();
  if (!baseUrl || !anonKey) return;

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

    let payload: { ok?: boolean; error?: string; sent?: number; skipped?: string } | null = null;
    try {
      payload = (await response.json()) as typeof payload;
    } catch {
      payload = null;
    }

    if (!response.ok) {
      console.warn(
        "[arms] send-web-push HTTP",
        response.status,
        payload?.error ?? response.statusText,
      );
      return;
    }

    if (payload && payload.ok === false) {
      console.warn("[arms] send-web-push:", payload.error ?? "unknown error");
      return;
    }

    if (payload && typeof payload.sent === "number" && payload.sent === 0) {
      console.info(
        "[arms] send-web-push: no devices reached",
        payload.skipped ?? "check app_push_subscriptions",
      );
    }
  } catch (error) {
    console.warn("[arms] requestWebPushDelivery", error);
  }
}
