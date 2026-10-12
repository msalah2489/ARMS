"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";
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
 * Post-login unread notification overlay (modal).
 * «قراءة لاحقاً» hides for this browser tab session only — message stays unread in the bell.
 * «تمت القراءة» marks read via the notifications store / reads table.
 */
export function NotificationLoginBanner({ user }: { user: Profile }) {
  const [active, setActive] = useState<ArmsNotification | null>(null);
  const [tick, setTick] = useState(0);

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

  if (!active) return null;

  function dismissOnly() {
    dismissForSession(active.id);
    setActive(null);
  }

  function acknowledge() {
    markNotificationRead(active.id, user);
    dismissOnly();
  }

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center bg-ink-950/50 p-4">
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
        className="relative z-10 w-full max-w-md rounded-2xl border border-ink-900/10 bg-white p-5 shadow-panel dark:border-white/10 dark:bg-ink-900 sm:p-6"
      >
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2
              id="notification-login-title"
              className="font-display text-lg text-ink-900 dark:text-sand-50 sm:text-xl"
            >
              {active.title}
            </h2>
            <p className="mt-3 whitespace-pre-wrap text-sm text-ink-800/85 dark:text-sand-100/80">
              {active.body}
            </p>
          </div>
          <button
            type="button"
            className="inline-flex min-h-9 min-w-9 shrink-0 items-center justify-center rounded-lg text-ink-700/70 hover:bg-ink-900/5 dark:text-sand-100/70 dark:hover:bg-white/10"
            aria-label="إغلاق"
            onClick={dismissOnly}
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-full bg-ink-900 px-5 py-2.5 text-sm text-white dark:bg-aroma-600"
            onClick={acknowledge}
          >
            تمت القراءة
          </button>
          <button
            type="button"
            className="rounded-full border border-ink-900/15 bg-white px-5 py-2.5 text-sm text-ink-900 hover:border-aroma-400 dark:border-white/15 dark:bg-ink-950 dark:text-sand-50"
            onClick={dismissOnly}
          >
            قراءة لاحقاً
          </button>
        </div>
      </div>
    </div>
  );
}
