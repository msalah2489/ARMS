"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { usePreferences } from "@/components/preferences-provider";
import { isNavHrefActive, navForUser, usesRoleBottomNav } from "@/lib/nav";
import type { Profile } from "@/types/domain";

/** Mobile bottom tabs for cycle roles (branch / courier / tech / manager). */
export function RoleBottomNav({ user }: { user: Profile }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { t } = usePreferences();

  if (!usesRoleBottomNav(user.role)) return null;

  const items = navForUser(user);
  if (items.length === 0) return null;

  const search = searchParams?.toString() ? `?${searchParams.toString()}` : "";

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-ink-900/10 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden dark:border-white/10 dark:bg-ink-900/95"
      aria-label="التنقل السفلي"
    >
      <ul
        className="mx-auto grid max-w-lg gap-0 px-1 pt-1"
        style={{ gridTemplateColumns: `repeat(${Math.min(items.length, 5)}, minmax(0, 1fr))` }}
      >
        {items.slice(0, 5).map((item) => {
          const Icon = item.icon;
          const label = t(item.labelKey);
          const active = isNavHrefActive(pathname ?? "", search, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={[
                  "flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 text-[0.65rem] font-semibold",
                  active
                    ? "text-aroma-800 dark:text-aroma-200"
                    : "text-ink-700/60 dark:text-sand-100/55",
                ].join(" ")}
              >
                <span
                  className={[
                    "inline-flex h-7 w-7 items-center justify-center rounded-lg",
                    active ? "bg-aroma-100 dark:bg-aroma-900/40" : "",
                  ].join(" ")}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <span className="max-w-full truncate">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
