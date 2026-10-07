"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { clsx } from "clsx";

export function ExpandableSection({
  title,
  defaultOpen = true,
  children,
  className,
  titleClassName,
  bodyClassName,
}: {
  title: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
  titleClassName?: string;
  bodyClassName?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section
      className={clsx(
        "rounded-2xl border border-ink-900/10 bg-white p-5 shadow-panel dark:border-white/15 dark:bg-ink-800",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className={clsx(
          "flex w-full items-center justify-between gap-3 text-right transition hover:opacity-90",
          titleClassName,
        )}
      >
        <span className="font-display text-xl text-ink-900 dark:text-sand-50">{title}</span>
        <ChevronDown
          className={clsx(
            "h-5 w-5 shrink-0 text-ink-700/60 transition-transform dark:text-sand-100/60",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>
      {open ? <div className={clsx("mt-4", bodyClassName)}>{children}</div> : null}
    </section>
  );
}
