"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { RoleScreenGuide } from "@/components/role-screen-guide";
import { subscribeMaintenanceRequestsChanged } from "@/lib/branch-store";
import { getMyTasksForUser, type MyTasksResult } from "@/lib/my-tasks";
import { readSession } from "@/lib/session";
import { hydrateOpsFromSupabase } from "@/lib/supabase/hydrate";
import type { Profile } from "@/types/domain";

export default function MyTasksPage() {
  const [user, setUser] = useState<Profile | null>(null);
  const [tasks, setTasks] = useState<MyTasksResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: number | null = null;

    function load() {
      if (cancelled) return;
      const session = readSession();
      setUser(session);
      if (!session) {
        setTasks(null);
        return;
      }
      setTasks(getMyTasksForUser(session));
    }

    function schedule() {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(load, 100);
    }

    setUser(readSession());
    timer = window.setTimeout(load, 0);
    void hydrateOpsFromSupabase().then(() => {
      if (!cancelled) schedule();
    });
    const unsub = subscribeMaintenanceRequestsChanged(schedule);
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
      unsub();
    };
  }, []);

  if (!user) {
    return <p className="text-sm text-ink-700/70 dark:text-sand-100/70">جاري التحميل…</p>;
  }

  const result = tasks ?? { groups: [], total: 0, overdueCount: 0 };

  return (
    <div>
      <PageHeader
        title="مهامي اليوم"
        description="قائمة العمل المطلوب منك الآن حسب دورك — مع تمييز المتأخر عن المهلة"
        backHref="/dashboard"
        backLabel="الرئيسية"
      />

      <RoleScreenGuide screen="my_tasks" role={user.role} className="mb-4" />

      {result.total === 0 ? (
        <section className="rounded-2xl border border-ink-900/10 bg-white p-6 shadow-panel dark:border-white/10 dark:bg-ink-900">
          <p className="text-sm text-ink-700/70 dark:text-sand-100/70">
            لا توجد مهام معلّقة لك الآن. عد لاحقًا أو راجع لوحة الرئيسية.
          </p>
          <Link
            href="/dashboard"
            className="mt-4 inline-flex rounded-full bg-ink-900 px-4 py-2 text-sm text-white dark:bg-aroma-600"
          >
            العودة للرئيسية
          </Link>
        </section>
      ) : (
        <div className="space-y-4">
          {result.groups.map((group) => (
            <section
              key={group.key}
              className="rounded-2xl border border-ink-900/10 bg-white p-5 shadow-panel dark:border-white/10 dark:bg-ink-900"
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-display text-xl text-ink-900 dark:text-sand-50">
                  {group.label}
                </h2>
                <span className="inline-flex min-w-8 items-center justify-center rounded-full bg-ink-900 px-2.5 py-1 text-sm font-semibold text-white dark:bg-aroma-600">
                  {group.items.length}
                </span>
              </div>
              <ul className="mt-3 space-y-2">
                {group.items.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      className={[
                        "block rounded-xl border px-3 py-2 transition hover:border-aroma-400 dark:hover:border-aroma-400",
                        item.overdue
                          ? "border-amber-400/60 bg-amber-50/70 dark:border-amber-500/40 dark:bg-amber-950/35"
                          : "border-ink-900/10 dark:border-white/10",
                      ].join(" ")}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-aroma-800 underline decoration-2 decoration-aroma-400/70 underline-offset-4 dark:text-aroma-200">
                          {item.title}
                        </span>
                        {item.urgent ? (
                          <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs text-rose-800 dark:bg-rose-950/60 dark:text-rose-200">
                            عاجل
                          </span>
                        ) : null}
                        {item.overdue ? (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900 dark:bg-amber-950/70 dark:text-amber-100">
                            متأخر
                          </span>
                        ) : null}
                        {item.badge && !item.overdue ? (
                          <span className="rounded-full bg-sand-100 px-2 py-0.5 text-xs text-ink-800 dark:bg-ink-950 dark:text-sand-100">
                            {item.badge}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-sm text-ink-700/70 dark:text-sand-100/70">
                        {item.subtitle}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
