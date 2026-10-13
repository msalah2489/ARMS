"use client";

import type { TimelineEvent } from "@/lib/request-timeline";
import { formatDate } from "@/lib/utils";

type Props = {
  events: TimelineEvent[];
  title?: string;
  emptyMessage?: string;
};

function kindTone(kind: TimelineEvent["kind"]): string {
  switch (kind) {
    case "request_created":
      return "bg-ink-900 dark:bg-aroma-600";
    case "shipment":
      return "bg-sky-700 dark:bg-sky-500";
    case "receipt":
      return "bg-amber-700 dark:bg-amber-500";
    case "work":
      return "bg-emerald-700 dark:bg-emerald-500";
    case "delivery":
      return "bg-teal-700 dark:bg-teal-500";
    case "return_link":
      return "bg-violet-700 dark:bg-violet-500";
    default:
      return "bg-ink-500 dark:bg-sand-400";
  }
}

export function RequestTimeline({
  events,
  title = "الخط الزمني",
  emptyMessage = "لا توجد أحداث مسجّلة بعد لهذا الطلب.",
}: Props) {
  return (
    <section className="rounded-2xl border border-ink-900/10 bg-white p-6 shadow-panel dark:border-white/10 dark:bg-ink-900">
      <h2 className="font-display text-xl text-ink-900 dark:text-sand-50">{title}</h2>
      <p className="mt-1 text-sm text-ink-700/70 dark:text-sand-100/70">
        تسلسل الاستلام والشحن وأعمال الصيانة من السجلات الحالية
      </p>

      {events.length === 0 ? (
        <p className="mt-4 text-sm text-ink-700/60 dark:text-sand-100/60">{emptyMessage}</p>
      ) : (
        <ol className="relative mt-5 space-y-0 border-s border-ink-900/15 pe-0 ps-5 dark:border-white/15">
          {events.map((event) => (
            <li key={event.id} className="relative pb-5 last:pb-0">
              <span
                className={`absolute -start-[1.4rem] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-white dark:ring-ink-900 ${kindTone(event.kind)}`}
                aria-hidden
              />
              <p className="text-xs text-ink-700/60 dark:text-sand-100/60">
                {formatDate(event.at)}
              </p>
              <p className="mt-0.5 font-medium text-ink-900 dark:text-sand-50">
                {event.title}
              </p>
              {event.detail ? (
                <p className="mt-0.5 text-sm text-ink-700/75 dark:text-sand-100/70">
                  {event.detail}
                </p>
              ) : null}
              {event.actor ? (
                <p className="mt-0.5 text-xs text-ink-700/55 dark:text-sand-100/55">
                  بواسطة: {event.actor}
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
