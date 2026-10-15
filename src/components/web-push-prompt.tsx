"use client";

import { BellRing, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  dismissWebPushPrompt,
  enableWebPushForUser,
  ensureWebPushSubscription,
  getWebPushSupportState,
  wasWebPushPromptDismissed,
} from "@/lib/web-push-client";
import type { Profile } from "@/types/domain";

/**
 * After login: offer browser notification permission (Arabic UX),
 * or silently refresh the push subscription when already granted.
 */
export function WebPushPrompt({ user }: { user: Profile }) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
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
      setVisible(false);
      return;
    }
    if (state !== "default") {
      setVisible(false);
      return;
    }
    if (wasWebPushPromptDismissed()) {
      setVisible(false);
      return;
    }
    // Slight delay so it does not fight the unread-notification banner.
    const timer = window.setTimeout(() => setVisible(true), 1200);
    return () => window.clearTimeout(timer);
  }, [mounted, user]);

  if (!mounted || !visible) return null;

  async function enable() {
    setBusy(true);
    setError(null);
    const result = await enableWebPushForUser(user);
    setBusy(false);
    if (result.ok) {
      setVisible(false);
      return;
    }
    setError(result.error);
    if (/رفض|denied/i.test(result.error)) {
      dismissWebPushPrompt();
    }
  }

  function later() {
    dismissWebPushPrompt();
    setVisible(false);
  }

  return createPortal(
    <div
      className="fixed inset-x-0 bottom-0 z-[90] flex justify-center p-3 sm:p-4"
      data-arms-web-push-prompt="true"
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
              تفعيل إشعارات المتصفح
            </h2>
            <p className="mt-1.5 text-sm text-ink-700 dark:text-[rgba(251,247,240,0.9)]">
              استلم تنبيهات مهمة حتى لو كانت نافذة ARMS مغلقة أو في الخلفية — مثل رسائل
              المدير ونقص المخزون.
            </p>
            {error ? (
              <p className="mt-2 text-xs text-rose-700 dark:text-rose-300" role="alert">
                {error}
              </p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                className="rounded-full bg-ink-900 px-4 py-2.5 text-sm text-white disabled:opacity-60 dark:bg-aroma-600 dark:text-[#fbf7f0]"
                onClick={() => void enable()}
              >
                {busy ? "جاري التفعيل…" : "تفعيل الإشعارات"}
              </button>
              <button
                type="button"
                disabled={busy}
                className="rounded-full border border-ink-900/15 bg-white px-4 py-2.5 text-sm text-ink-900 hover:border-aroma-400 disabled:opacity-60 dark:border-white/25 dark:bg-ink-950 dark:text-[#fbf7f0]"
                onClick={later}
              >
                لاحقاً
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
