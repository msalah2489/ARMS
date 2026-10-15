"use client";

import { useEffect, useState } from "react";
import { ChevronDown, CircleHelp } from "lucide-react";
import { clsx } from "clsx";
import {
  getRoleScreenGuide,
  type RoleGuideScreen,
} from "@/lib/role-screen-guides";
import type { AppRole } from "@/types/domain";

const STORAGE_PREFIX = "arms_role_guide_open:";

function storageKey(screen: RoleGuideScreen, role: string) {
  return `${STORAGE_PREFIX}${screen}:${role}`;
}

/**
 * Compact collapsible «ماذا أفعل الآن؟» tip panel, tailored by role.
 * Remembers open/closed per screen+role in localStorage (default: open).
 */
export function RoleScreenGuide({
  screen,
  role,
  className,
}: {
  screen: RoleGuideScreen;
  role: AppRole | string | null | undefined;
  className?: string;
}) {
  const guide = getRoleScreenGuide(screen, role);
  const [open, setOpen] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!guide || !role) {
      setReady(true);
      return;
    }
    try {
      const raw = window.localStorage.getItem(storageKey(screen, String(role)));
      if (raw === "0") setOpen(false);
      else if (raw === "1") setOpen(true);
    } catch {
      /* ignore */
    }
    setReady(true);
  }, [guide, role, screen]);

  if (!guide || !role) return null;

  function toggle() {
    setOpen((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(storageKey(screen, String(role)), next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  return (
    <section
      className={clsx(
        "rounded-2xl border border-aroma-400/35 bg-sand-50/90 shadow-sm dark:border-aroma-400/25 dark:bg-ink-900/80",
        className,
      )}
      aria-label="ماذا أفعل الآن؟"
    >
      <button
        type="button"
        onClick={toggle}
        aria-expanded={ready ? open : true}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-right transition hover:opacity-90 sm:px-5"
      >
        <span className="inline-flex items-center gap-2 font-display text-base text-ink-900 dark:text-sand-50 sm:text-lg">
          <CircleHelp
            className="h-5 w-5 shrink-0 text-aroma-700 dark:text-aroma-300"
            aria-hidden
          />
          ماذا أفعل الآن؟
        </span>
        <ChevronDown
          className={clsx(
            "h-5 w-5 shrink-0 text-ink-700/60 transition-transform dark:text-sand-100/60",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>
      {open ? (
        <div className="border-t border-aroma-400/20 px-4 pb-4 pt-3 sm:px-5">
          <ol className="list-decimal space-y-1.5 pe-5 text-sm leading-relaxed text-ink-800 dark:text-sand-100">
            {guide.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          {guide.tip ? (
            <p className="mt-3 rounded-xl border border-ink-900/10 bg-white/70 px-3 py-2 text-xs text-ink-700/80 dark:border-white/10 dark:bg-ink-950/50 dark:text-sand-100/75">
              {guide.tip}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
