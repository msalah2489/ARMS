"use client";

import type { SortDirection } from "@/lib/table-sort";

type Props = {
  label: string;
  columnKey: string;
  activeKey: string | null;
  direction: SortDirection;
  onToggle: (columnKey: string) => void;
  className?: string;
  /** When false, render a plain header (e.g. actions / image). */
  sortable?: boolean;
};

export function SortableTh({
  label,
  columnKey,
  activeKey,
  direction,
  onToggle,
  className = "px-2 py-2 font-medium",
  sortable = true,
}: Props) {
  if (!sortable) {
    return <th className={className}>{label}</th>;
  }

  const active = activeKey === columnKey;

  return (
    <th
      className={className}
      aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={() => onToggle(columnKey)}
        className="inline-flex max-w-full items-center gap-1 text-start hover:text-ink-900 dark:hover:text-sand-50"
      >
        <span>{label}</span>
        <span className="shrink-0 text-[10px] opacity-60" aria-hidden>
          {active ? (direction === "asc" ? "▲" : "▼") : "⇅"}
        </span>
      </button>
    </th>
  );
}
