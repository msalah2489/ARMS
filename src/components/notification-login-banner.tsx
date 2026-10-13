"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  listUnreadNotifications,
  markNotificationRead,
  subscribeNotificationsChanged,
} from "@/lib/notifications-store";
import type { ArmsNotification, Profile } from "@/types/domain";

const DISMISSED_KEY = "arms_notif_banner_dismissed_ids";

function readDismissed(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.sessionStorage.getItem(DISMISSED_KEY);
    const parsed = raw ? (JSON.parse(raw) as string[]) : [];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function writeDismissed(ids: Set<string>) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(DISMISSED_KEY, JSON.stringify([...ids]));
}

function dismissForSession(notificationId: string) {
  const dismissed = readDismissed();
  dismissed.add(notificationId);
  writeDismissed(dismissed);
}

/**
 * Post-login unread notification overlay (modal via portal).
 * «قراءة لاحقاً» hides for this browser tab session only — message stays unread in the bell.
 * «تمت القراءة» marks read via the notifications store / reads table.
 */
export function NotificationLoginBanner({ user }: { user: Profile }) {
  const [active, setActive] = useState<ArmsNotification | null>(null);
  const [tick, setTick] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    return subscribeNotificationsChanged(() => setTick((n) => n + 1));
  }, []);

  useEffect(() => {
    const dismissed = readDismissed();
    const unread = listUnreadNotifications(user).filter((row) => !dismissed.has(row.id));
    setActive(unread[0] ?? null);
  }, [user, tick]);

  useEffect(() => {
    if (!active) return;
    const notificationId = active.id;
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      dismissForSession(notificationId);
      setActive(null);
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [active]);

  if (!active || !mounted) return null;

  // Capture after null check so nested handlers stay typed as ArmsNotification (CI/tsc).
  const notification = active;

  function dismissOnly() {
    dismissForSession(notification.id);
    setActive(null);
  }

  function acknowledge() {
    markNotificationRead(notification.id, user);
    dismissOnly();
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4 dark:bg-black/70"
      data-arms-notification-overlay="true"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="إغلاق"
        onClick={dismissOnly}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="notification-login-title"
        className="relative z-10 w-full max-w-md rounded-2xl border border-ink-900/15 bg-white p-5 text-ink-900 shadow-panel dark:border-white/20 dark:bg-[#2a3d33] dark:text-[#fbf7f0] sm:p-6"
      >
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2
              id="notification-login-title"
              className="font-display text-lg text-ink-900 dark:text-[#fbf7f0] sm:text-xl"
            >
              {notification.title}
            </h2>
            <p className="mt-3 whitespace-pre-wrap text-sm text-ink-700 dark:text-[rgba(251,247,240,0.92)]">
              {notification.body}
            </p>
          </div>
          <button
            type="button"
            className="inline-flex min-h-9 min-w-9 shrink-0 items-center justify-center rounded-lg text-ink-700 hover:bg-ink-900/5 dark:text-[#fbf7f0] dark:hover:bg-white/10"
            aria-label="إغلاق"
            onClick={dismissOnly}
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-full bg-ink-900 px-5 py-2.5 text-sm text-white dark:bg-aroma-600 dark:text-[#fbf7f0]"
            onClick={acknowledge}
          >
            تمت القراءة
          </button>
          <button
            type="button"
            className="rounded-full border border-ink-900/15 bg-white px-5 py-2.5 text-sm text-ink-900 hover:border-aroma-400 dark:border-white/25 dark:bg-ink-950 dark:text-[#fbf7f0]"
            onClick={dismissOnly}
          >
            قراءة لاحقاً
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
