/**
 * Browser Web Push subscribe / unsubscribe for ARMS staff devices.
 * Sending uses Supabase Edge Function + VAPID private secret (never in client).
 */
import { isDemoMode } from "@/lib/auth";
import { getAppBasePath } from "@/lib/device-qr";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { ArmsNotification, Profile } from "@/types/domain";

const PROMPT_DISMISSED_KEY = "arms_web_push_prompt_dismissed_v1";
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

export function getWebPushSupportState(): WebPushSupportState {
  if (typeof window === "undefined") return "unsupported";
  if (isDemoMode()) return "demo";
  if (!isSupabaseConfigured()) return "no_supabase";
  if (!getVapidPublicKey()) return "no_vapid";
  if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    return "unsupported";
  }
  const permission = Notification.permission;
  if (permission === "denied") return "denied";
  if (permission === "granted") return "granted";
  return "default";
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
    // Soft-fail if migration not applied yet.
    if (/does not exist|Could not find the table|PGRST/i.test(error.message ?? "")) {
      console.warn("[arms] app_push_subscriptions missing — run migration 026");
      return;
    }
    throw error;
  }
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
    const existing = await registration.pushManager.getSubscription();
    const subscription =
      existing ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(getVapidPublicKey()) as BufferSource,
      }));
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
 * Best-effort — never blocks the in-app notification path.
 */
export async function requestWebPushDelivery(notification: ArmsNotification): Promise<void> {
  if (!isWebPushConfigured() || typeof window === "undefined") return;
  try {
    const supabase = createClient();
    const { error } = await supabase.functions.invoke("send-web-push", {
      body: {
        notificationId: notification.id,
        title: notification.title,
        body: notification.body,
        audienceType: notification.audienceType,
        audienceRole: notification.audienceRole ?? null,
        audienceUserId: notification.audienceUserId ?? null,
        url: "/",
      },
    });
    if (error) {
      console.warn("[arms] send-web-push invoke:", error.message);
    }
  } catch (error) {
    console.warn("[arms] requestWebPushDelivery", error);
  }
}
