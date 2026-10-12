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

/**
 * Shows unread messages above the page after login.
 * Dismiss hides for this browser tab session only — messages stay in the bell list.
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

  if (!active) return null;

  function dismissOnly() {
    if (!active) return;
    const dismissed = readDismissed();
    dismissed.add(active.id);
    writeDismissed(dismissed);
    setActive(null);
  }

  function acknowledge() {
    if (!active) return;
    markNotificationRead(active.id, user);
    dismissOnly();
  }

  return (
    <div
      className="border-b border-aroma-300/50 bg-aroma-50 px-3 py-3 text-ink-900 dark:border-aroma-500/30 dark:bg-aroma-950/40 dark:text-sand-50 sm:px-4 md:px-8"
      role="status"
    >
      <div className="mx-auto flex max-w-5xl items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{active.title}</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-ink-800/85 dark:text-sand-100/80">
            {active.body}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-full bg-ink-900 px-3 py-1.5 text-xs text-white dark:bg-aroma-600"
              onClick={acknowledge}
            >
              حسناً — تعليم كمقروء
            </button>
            <button
              type="button"
              className="rounded-full border border-ink-900/15 bg-white px-3 py-1.5 text-xs dark:border-white/15 dark:bg-ink-900"
              onClick={dismissOnly}
            >
              إخفاء الآن
            </button>
          </div>
        </div>
        <button
          type="button"
          className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg text-ink-700/70 hover:bg-white/60 dark:text-sand-100/70 dark:hover:bg-white/10"
          aria-label="إغلاق"
          onClick={dismissOnly}
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
