"use client";

import { LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArmsLogo } from "@/components/arms-logo";
import { usePreferences } from "@/components/preferences-provider";
import { ROLE_LABELS } from "@/lib/auth";
import { isNavHrefActive, navForUser } from "@/lib/nav";
import { signOut } from "@/lib/session";
import type { Profile } from "@/types/domain";

type SidebarProps = {
  user: Profile;
  /** `rail` = desktop icons-only (expand on hover/focus). `drawer` = full labels for mobile. */
  variant?: "rail" | "drawer";
  onNavigate?: () => void;
};

export function Sidebar({ user, variant = "rail", onNavigate }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { t } = usePreferences();
  const items = navForUser(user);
  const search = searchParams?.toString() ? `?${searchParams.toString()}` : "";
  const isRail = variant === "rail";
  const asideRef = useRef<HTMLElement>(null);
  const [railExpanded, setRailExpanded] = useState(false);

  // After route change, force-collapse the desktop rail (hover/focus would otherwise keep it open).
  useEffect(() => {
    if (!isRail) return;
    setRailExpanded(false);
    const active = document.activeElement;
    if (active instanceof HTMLElement && asideRef.current?.contains(active)) {
      active.blur();
    }
  }, [pathname, isRail]);

  const expandRail = () => {
    if (isRail) setRailExpanded(true);
  };

  const collapseRail = () => {
    if (isRail) setRailExpanded(false);
  };

  // Desktop rail open state (drawer always shows full labels).
  const open = !isRail || railExpanded;

  return (
    <aside
      ref={asideRef}
      data-expanded={isRail && railExpanded ? "true" : "false"}
      onMouseEnter={expandRail}
      onMouseLeave={collapseRail}
      onFocus={expandRail}
      onBlur={(e) => {
        if (!asideRef.current?.contains(e.relatedTarget as Node | null)) {
          collapseRail();
        }
      }}
      className={[
        "flex h-full flex-col bg-ink-950 text-sand-50",
        isRail
          ? [
              "arms-sidebar-rail overflow-hidden transition-[width] duration-200 ease-out",
              open ? "w-64" : "w-16",
            ].join(" ")
          : "w-full",
      ].join(" ")}
    >
      <div
        className={[
          "border-b border-white/10",
          isRail ? (open ? "px-5 py-5" : "px-3 py-5") : "px-5 py-6",
        ].join(" ")}
      >
        <div className={isRail ? (open ? "flex justify-start" : "flex justify-center") : ""}>
          <ArmsLogo size={isRail ? "sm" : "md"} />
        </div>
        <p
          className={[
            "mt-1 text-xs text-aroma-200",
            isRail
              ? open
                ? "mt-1 max-h-8 overflow-hidden opacity-100 transition-all duration-200"
                : "max-h-0 overflow-hidden opacity-0 transition-all duration-200"
              : "",
          ].join(" ")}
        >
          {t("app.subtitle")}
        </p>
        {user.opsBranchName ? (
          <p
            className={[
              "mt-3 text-xs text-sand-100/70",
              isRail
                ? open
                  ? "max-h-10 overflow-hidden opacity-100 transition-all duration-200"
                  : "max-h-0 overflow-hidden opacity-0 transition-all duration-200"
                : "",
            ].join(" ")}
          >
            {user.opsBranchName}
          </p>
        ) : null}
      </div>

      <nav
        className={[
          "flex flex-1 flex-col space-y-1 overflow-y-auto py-3",
          isRail ? (open ? "px-3" : "px-2") : "px-2",
        ].join(" ")}
      >
        {items.map((item) => {
          const Icon = item.icon;
          const label = t(item.labelKey);
          const path = pathname ?? "";
          const active = isNavHrefActive(path, search, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={label}
              onClick={onNavigate}
              className={[
                "flex min-h-11 items-center rounded-lg text-sm transition-colors",
                isRail
                  ? open
                    ? "justify-start gap-3 px-3"
                    : "justify-center gap-0 px-0"
                  : "gap-3 px-3",
                active ? "bg-white/15 text-white" : "text-sand-100 hover:bg-white/10",
              ].join(" ")}
            >
              <Icon className="h-5 w-5 shrink-0 opacity-80" aria-hidden />
              <span
                className={[
                  "truncate",
                  isRail
                    ? open
                      ? "max-w-[12rem] overflow-hidden opacity-100 transition-all duration-200"
                      : "max-w-0 overflow-hidden opacity-0 transition-all duration-200"
                    : "",
                ].join(" ")}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </nav>

      <div
        className={[
          "border-t border-white/10",
          isRail ? (open ? "p-4" : "px-2 py-3") : "p-4",
        ].join(" ")}
      >
        <div
          className={[
            "flex items-center gap-2",
            isRail && !open ? "flex-col" : "",
          ].join(" ")}
        >
          {user.photoDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.photoDataUrl}
              alt=""
              className={[
                "shrink-0 rounded-full object-cover ring-1 ring-white/25",
                isRail && !open ? "h-8 w-8" : "h-9 w-9",
              ].join(" ")}
            />
          ) : (
            <span
              className={[
                "inline-flex shrink-0 items-center justify-center rounded-full bg-white/15 text-xs font-medium text-sand-50 ring-1 ring-white/25",
                isRail && !open ? "h-8 w-8" : "h-9 w-9",
              ].join(" ")}
              aria-hidden
            >
              {user.fullName.trim().charAt(0) || "?"}
            </span>
          )}
          <div className={isRail && !open ? "sr-only" : "min-w-0 flex-1"}>
            <p className="truncate text-sm font-medium text-sand-50" title={user.fullName}>
              {user.fullName}
              {user.gender === "male" ? " ♂" : user.gender === "female" ? " ♀" : ""}
            </p>
            <p className="mt-0.5 truncate text-xs text-aroma-200">{ROLE_LABELS[user.role]}</p>
          </div>
        </div>
        <button
          type="button"
          title={t("common.logout")}
          onClick={async () => {
            await signOut();
            onNavigate?.();
            router.replace("/login");
          }}
          className={[
            "mt-3 inline-flex min-h-11 appearance-none items-center justify-center gap-2 rounded-lg border border-white/25 bg-white/10 text-xs font-medium text-sand-50 hover:bg-white/20 hover:text-white",
            isRail ? (open ? "w-full px-3" : "w-full px-2") : "px-3 py-1.5",
          ].join(" ")}
        >
          <LogOut className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
          <span
            className={
              isRail
                ? open
                  ? "max-w-[10rem] overflow-hidden whitespace-nowrap opacity-100 transition-all duration-200"
                  : "max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-200"
                : ""
            }
          >
            {t("common.logout")}
          </span>
        </button>
      </div>
    </aside>
  );
}
