"use client";

import { LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArmsLogo } from "@/components/arms-logo";
import { usePreferences } from "@/components/preferences-provider";
import { ROLE_LABELS } from "@/lib/auth";
import { navForUser } from "@/lib/nav";
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
  const { t } = usePreferences();
  const items = navForUser(user);
  const isRail = variant === "rail";

  return (
    <aside
      className={[
        "group/sidebar flex h-full flex-col bg-ink-950 text-sand-50",
        isRail
          ? "arms-sidebar-rail w-16 overflow-hidden transition-[width] duration-200 ease-out hover:w-64 focus-within:w-64"
          : "w-full",
      ].join(" ")}
    >
      <div
        className={[
          "border-b border-white/10",
          isRail ? "px-3 py-5 group-hover/sidebar:px-5 group-focus-within/sidebar:px-5" : "px-5 py-6",
        ].join(" ")}
      >
        <div className={isRail ? "flex justify-center group-hover/sidebar:justify-start group-focus-within/sidebar:justify-start" : ""}>
          <ArmsLogo size={isRail ? "sm" : "md"} />
        </div>
        <p
          className={[
            "mt-1 text-xs text-aroma-200",
            isRail
              ? "max-h-0 overflow-hidden opacity-0 transition-all duration-200 group-hover/sidebar:mt-1 group-hover/sidebar:max-h-8 group-hover/sidebar:opacity-100 group-focus-within/sidebar:mt-1 group-focus-within/sidebar:max-h-8 group-focus-within/sidebar:opacity-100"
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
                ? "max-h-0 overflow-hidden opacity-0 transition-all duration-200 group-hover/sidebar:max-h-10 group-hover/sidebar:opacity-100 group-focus-within/sidebar:max-h-10 group-focus-within/sidebar:opacity-100"
                : "",
            ].join(" ")}
          >
            {user.opsBranchName}
          </p>
        ) : null}
      </div>

      <nav className="flex flex-1 flex-col space-y-1 overflow-y-auto px-2 py-3 group-hover/sidebar:px-3 group-focus-within/sidebar:px-3">
        {items.map((item) => {
          const Icon = item.icon;
          const label = t(item.labelKey);
          const path = pathname ?? "";
          const active = path === item.href || path.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              title={label}
              onClick={onNavigate}
              className={[
                "flex min-h-11 items-center rounded-lg text-sm transition-colors",
                isRail
                  ? "justify-center gap-0 px-0 group-hover/sidebar:justify-start group-hover/sidebar:gap-3 group-hover/sidebar:px-3 group-focus-within/sidebar:justify-start group-focus-within/sidebar:gap-3 group-focus-within/sidebar:px-3"
                  : "gap-3 px-3",
                active ? "bg-white/15 text-white" : "text-sand-100 hover:bg-white/10",
              ].join(" ")}
            >
              <Icon className="h-5 w-5 shrink-0 opacity-80" aria-hidden />
              <span
                className={[
                  "truncate",
                  isRail
                    ? "max-w-0 overflow-hidden opacity-0 transition-all duration-200 group-hover/sidebar:max-w-[12rem] group-hover/sidebar:opacity-100 group-focus-within/sidebar:max-w-[12rem] group-focus-within/sidebar:opacity-100"
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
          isRail
            ? "px-2 py-3 group-hover/sidebar:p-4 group-focus-within/sidebar:p-4"
            : "p-4",
        ].join(" ")}
      >
        <p
          className={[
            "truncate text-sm font-medium text-sand-50",
            isRail
              ? "text-center text-xs group-hover/sidebar:text-start group-hover/sidebar:text-sm group-focus-within/sidebar:text-start group-focus-within/sidebar:text-sm"
              : "",
          ].join(" ")}
          title={user.fullName}
        >
          {isRail ? (
            <>
              <span className="inline group-hover/sidebar:hidden group-focus-within/sidebar:hidden">
                {user.fullName.trim().charAt(0) || "?"}
              </span>
              <span className="hidden group-hover/sidebar:inline group-focus-within/sidebar:inline">
                {user.fullName}
              </span>
            </>
          ) : (
            user.fullName
          )}
        </p>
        <p
          className={[
            "text-xs text-aroma-200",
            isRail
              ? "max-h-0 overflow-hidden text-center opacity-0 transition-all duration-200 group-hover/sidebar:mt-0.5 group-hover/sidebar:max-h-6 group-hover/sidebar:text-start group-hover/sidebar:opacity-100 group-focus-within/sidebar:mt-0.5 group-focus-within/sidebar:max-h-6 group-focus-within/sidebar:text-start group-focus-within/sidebar:opacity-100"
              : "",
          ].join(" ")}
        >
          {ROLE_LABELS[user.role]}
        </p>
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
            isRail
              ? "w-full px-2 group-hover/sidebar:px-3 group-focus-within/sidebar:px-3"
              : "px-3 py-1.5",
          ].join(" ")}
        >
          <LogOut className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
          <span
            className={
              isRail
                ? "max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-200 group-hover/sidebar:max-w-[10rem] group-hover/sidebar:opacity-100 group-focus-within/sidebar:max-w-[10rem] group-focus-within/sidebar:opacity-100"
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
