"use client";

import { BellRing, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  dismissWebPushPrompt,
  enableWebPushForUser,
  ensureWebPushSubscription,
  getWebPushStatusMessage,
  getWebPushSupportState,
  wasWebPushPromptDismissed,
  type WebPushSupportState,
} from "@/lib/web-push-client";
import type { Profile } from "@/types/domain";

const CONFIG_DISMISSED_KEY = "arms_web_push_config_hint_dismissed_v1";

function wasConfigHintDismissed(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.sessionStorage.getItem(CONFIG_DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

function dismissConfigHint() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(CONFIG_DISMISSED_KEY, "1");
  } catch {
    /* ignore */
  }
}

/**
 * After login: offer browser notification permission (Arabic UX),
 * or silently refresh the push subscription when already granted.
 * When VAPID/Supabase is missing from the build, show a clear setup hint
 * instead of hiding all Web Push UI silently.
 */
export function WebPushPrompt({ user }: { user: Profile }) {
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<"hidden" | "enable" | "config">("hidden");
  const [configState, setConfigState] = useState<WebPushSupportState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const state = getWebPushSupportState();
    if (state === "granted") {
      void ensureWebPushSubscription(user);
      setMode("hidden");
      return;
    }
    if (state === "default") {
      if (wasWebPushPromptDismissed()) {
        setMode("hidden");
        return;
      }
      const timer = window.setTimeout(() => setMode("enable"), 1200);
      return () => window.clearTimeout(timer);
    }
    // Misconfigured build / unsupported / denied — never pretend nothing exists.
    if (state === "no_vapid" || state === "no_supabase") {
      if (wasConfigHintDismissed()) {
        setMode("hidden");
        return;
      }
      setConfigState(state);
      const timer = window.setTimeout(() => setMode("config"), 1200);
      return () => window.clearTimeout(timer);
    }
    setMode("hidden");
  }, [mounted, user]);

  if (!mounted || mode === "hidden") return null;

  async function enable() {
    setBusy(true);
    setError(null);
    const result = await enableWebPushForUser(user);
    setBusy(false);
    if (result.ok) {
      setMode("hidden");
      return;
    }
    setError(result.error);
    if (/رفض|denied/i.test(result.error)) {
      dismissWebPushPrompt();
    }
  }

  function later() {
    if (mode === "config") {
      dismissConfigHint();
    } else {
      dismissWebPushPrompt();
    }
    setMode("hidden");
  }

  const title =
    mode === "config" ? "إشعارات المتصفح غير جاهزة" : "تفعيل إشعارات المتصفح";
  const body =
    mode === "config"
      ? getWebPushStatusMessage(configState ?? "no_vapid")
      : "استلم تنبيهات مهمة حتى لو كانت نافذة ARMS مغلقة أو في الخلفية — مثل رسائل المدير ونقص المخزون.";

  return createPortal(
    <div
      className="fixed inset-x-0 bottom-0 z-[90] flex justify-center p-3 sm:p-4"
      data-arms-web-push-prompt="true"
      data-arms-web-push-mode={mode}
    >
      <div
        role="dialog"
        aria-labelledby="web-push-prompt-title"
        className="w-full max-w-md rounded-2xl border border-ink-900/15 bg-white p-4 text-ink-900 shadow-panel dark:border-white/20 dark:bg-[#2a3d33] dark:text-[#fbf7f0] sm:p-5"
      >
        <div className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-aroma-100 text-aroma-800 dark:bg-aroma-900/40 dark:text-aroma-100">
            <BellRing className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h2
              id="web-push-prompt-title"
              className="font-display text-base text-ink-900 dark:text-[#fbf7f0] sm:text-lg"
            >
              {title}
            </h2>
            <p className="mt-1.5 text-sm text-ink-700 dark:text-[rgba(251,247,240,0.9)]">{body}</p>
            {error ? (
              <p className="mt-2 text-xs text-rose-700 dark:text-rose-300" role="alert">
                {error}
              </p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              {mode === "enable" ? (
                <button
                  type="button"
                  disabled={busy}
                  className="rounded-full bg-ink-900 px-4 py-2.5 text-sm text-white disabled:opacity-60 dark:bg-aroma-600 dark:text-[#fbf7f0]"
                  onClick={() => void enable()}
                >
                  {busy ? "جاري التفعيل…" : "تفعيل الإشعارات"}
                </button>
              ) : null}
              <button
                type="button"
                disabled={busy}
                className="rounded-full border border-ink-900/15 bg-white px-4 py-2.5 text-sm text-ink-900 hover:border-aroma-400 disabled:opacity-60 dark:border-white/25 dark:bg-ink-950 dark:text-[#fbf7f0]"
                onClick={later}
              >
                {mode === "config" ? "حسناً" : "لاحقاً"}
              </button>
            </div>
          </div>
          <button
            type="button"
            className="inline-flex min-h-9 min-w-9 shrink-0 items-center justify-center rounded-lg text-ink-700 hover:bg-ink-900/5 dark:text-[#fbf7f0] dark:hover:bg-white/10"
            aria-label="إغلاق"
            onClick={later}
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
