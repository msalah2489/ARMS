"use client";

import { Bell } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  countUnreadNotifications,
  isNotificationRead,
  listNotificationsForUser,
  markAllNotificationsRead,
  markNotificationRead,
  subscribeNotificationsChanged,
} from "@/lib/notifications-store";
import { formatDate } from "@/lib/utils";
import {
  clearWebPushPromptDismissed,
  enableWebPushForUser,
  getWebPushStatusMessage,
  getWebPushSupportState,
} from "@/lib/web-push-client";
import type { Profile } from "@/types/domain";

export function NotificationBell({ user }: { user: Profile }) {
  const [open, setOpen] = useState(false);
  const [tick, setTick] = useState(0);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushNote, setPushNote] = useState<string | null>(null);
  const [pushState, setPushState] = useState<ReturnType<typeof getWebPushSupportState> | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return subscribeNotificationsChanged(() => setTick((n) => n + 1));
  }, []);

  useEffect(() => {
    setPushState(getWebPushSupportState());
  }, [tick, user.id]);

  useEffect(() => {
    if (!open) return;
    function onDoc(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  void tick;
  const items = listNotificationsForUser(user);
  const unread = countUnreadNotifications(user);
  const canOfferPush = pushState === "default";
  const pushStatusHint =
    pushState && pushState !== "default" ? getWebPushStatusMessage(pushState) : "";

  async function onEnablePush() {
    setPushBusy(true);
    setPushNote(null);
    clearWebPushPromptDismissed();
    const result = await enableWebPushForUser(user);
    setPushBusy(false);
    setPushNote(result.ok ? "تم تفعيل إشعارات هذا الجهاز." : result.error);
    setPushState(getWebPushSupportState());
    setTick((n) => n + 1);
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className="relative inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-ink-900/10 text-ink-900 hover:border-aroma-400 dark:border-white/15 dark:text-sand-50 dark:hover:border-aroma-400"
        aria-expanded={open}
        aria-label="الإشعارات"
        onClick={() => setOpen((v) => !v)}
      >
        <Bell className="h-5 w-5" aria-hidden />
        {unread > 0 ? (
          <span className="absolute -top-1 -end-1 inline-flex min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-semibold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute end-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-ink-900/10 bg-white shadow-panel dark:border-white/10 dark:bg-ink-900">
          <div className="flex items-center justify-between gap-2 border-b border-ink-900/10 px-3 py-2.5 dark:border-white/10">
            <p className="text-sm font-semibold text-ink-900 dark:text-sand-50">الإشعارات</p>
            {unread > 0 ? (
              <button
                type="button"
                className="text-xs text-aroma-700 underline underline-offset-2 dark:text-aroma-200"
                onClick={() => markAllNotificationsRead(user)}
              >
                تعليم الكل كمقروء
              </button>
            ) : null}
          </div>
          <ul className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <li className="px-3 py-6 text-center text-sm text-ink-700/60 dark:text-sand-100/60">
                لا توجد رسائل بعد.
              </li>
            ) : (
              items.map((item) => {
                const read = isNotificationRead(item.id, user.id);
                return (
                  <li key={item.id} className="border-b border-ink-900/5 last:border-0 dark:border-white/5">
                    <button
                      type="button"
                      className={[
                        "w-full px-3 py-3 text-start transition hover:bg-sand-50 dark:hover:bg-ink-950/50",
                        read ? "opacity-80" : "bg-aroma-50/40 dark:bg-aroma-900/10",
                      ].join(" ")}
                      onClick={() => markNotificationRead(item.id, user)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-ink-900 dark:text-sand-50">
                          {item.title}
                        </p>
                        {!read ? (
                          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-aroma-600" aria-hidden />
                        ) : null}
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-xs text-ink-700/80 dark:text-sand-100/70">
                        {item.body}
                      </p>
                      <p className="mt-1.5 text-[11px] text-ink-700/50 dark:text-sand-100/50">
                        {item.createdByName} · {formatDate(item.createdAt)}
                      </p>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
          <div className="border-t border-ink-900/10 px-3 py-2 dark:border-white/10">
            {canOfferPush ? (
              <button
                type="button"
                disabled={pushBusy}
                className="mb-1.5 w-full rounded-lg bg-aroma-50 px-2 py-2 text-xs font-medium text-aroma-900 hover:bg-aroma-100 disabled:opacity-60 dark:bg-aroma-900/30 dark:text-aroma-100"
                onClick={() => void onEnablePush()}
              >
                {pushBusy ? "جاري التفعيل…" : "تفعيل إشعارات هذا الجهاز"}
              </button>
            ) : null}
            {!canOfferPush && pushStatusHint ? (
              <p
                className="mb-1.5 text-[11px] leading-relaxed text-amber-800/90 dark:text-amber-200/90"
                data-arms-web-push-status={pushState ?? undefined}
              >
                {pushStatusHint}
              </p>
            ) : null}
            {pushNote ? (
              <p className="mb-1 text-[11px] text-ink-700/80 dark:text-sand-100/70">{pushNote}</p>
            ) : null}
            <p className="text-[11px] text-ink-700/55 dark:text-sand-100/55">
              الرسائل تبقى في السجل ولا تُحذف.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
