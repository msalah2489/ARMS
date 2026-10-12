"use client";

import { useMemo, type ReactNode } from "react";
import { SortableTh } from "@/components/sortable-th";
import { reactNodeToSortText, useColumnSort } from "@/lib/table-sort";

const EMPTY_INDEXES: number[] = [];

export function DataTable({
  columns,
  rows,
  mobilePrimaryIndex = 0,
  mobileBadgeIndexes = EMPTY_INDEXES,
  /** Column indexes that should not be clickable for sort (image / actions). */
  unsortableIndexes = EMPTY_INDEXES,
  /** Optional explicit sort keys per row; falls back to cell text. */
  sortValues,
  sortable = true,
}: {
  columns: string[];
  rows: ReactNode[][];
  /** Column shown as the card title on small screens (default: first). */
  mobilePrimaryIndex?: number;
  /** Columns rendered as a compact badge/meta row under the title. */
  mobileBadgeIndexes?: number[];
  unsortableIndexes?: number[];
  sortValues?: Array<Array<string | number | null | undefined>>;
  sortable?: boolean;
}) {
  const badgeSet = useMemo(() => new Set(mobileBadgeIndexes), [mobileBadgeIndexes]);
  const unsortableSet = useMemo(() => new Set(unsortableIndexes), [unsortableIndexes]);

  const indexedRows = useMemo(
    () => rows.map((cells, index) => ({ cells, index })),
    [rows],
  );

  const getValue = useMemo(() => {
    return (row: { cells: ReactNode[]; index: number }, columnKey: string) => {
      const col = Number(columnKey);
      if (!Number.isFinite(col)) return "";
      const explicit = sortValues?.[row.index]?.[col];
      if (explicit != null && explicit !== "") return explicit;
      return reactNodeToSortText(row.cells[col]);
    };
  }, [sortValues]);

  const { sorted, sortKey, sortDirection, toggleSort } = useColumnSort(
    indexedRows,
    getValue,
  );

  const displayRows = sortable ? sorted : indexedRows;

  return (
    <div className="overflow-hidden rounded-2xl border border-ink-900/10 bg-white shadow-panel dark:border-white/10 dark:bg-ink-900">
      {/* Mobile: stacked cards */}
      <div className="space-y-3 p-3 md:hidden">
        {sortable && columns.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {columns.map((column, columnIndex) => {
              if (unsortableSet.has(columnIndex)) return null;
              const active = sortKey === String(columnIndex);
              return (
                <button
                  key={`sort-${columnIndex}`}
                  type="button"
                  onClick={() => toggleSort(String(columnIndex))}
                  className={
                    active
                      ? "rounded-full bg-ink-900 px-2.5 py-1 text-[11px] text-white dark:bg-aroma-600"
                      : "rounded-full border border-ink-900/15 px-2.5 py-1 text-[11px] text-ink-700/80 dark:border-white/15 dark:text-sand-100/80"
                  }
                >
                  {column}
                  {active ? (sortDirection === "asc" ? " ▲" : " ▼") : ""}
                </button>
              );
            })}
          </div>
        ) : null}
        {displayRows.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-ink-700/60 dark:text-sand-100/60">—</p>
        ) : (
          displayRows.map((row) => {
            const cells = row.cells;
            const secondaryIndexes = cells
              .map((_, cellIndex) => cellIndex)
              .filter(
                (cellIndex) =>
                  cellIndex !== mobilePrimaryIndex && !badgeSet.has(cellIndex),
              );

            return (
              <article
                key={row.index}
                className="rounded-xl border border-ink-900/10 bg-sand-50/60 p-3.5 dark:border-white/10 dark:bg-ink-950/40"
              >
                <div className="min-w-0 text-base font-semibold text-ink-900 dark:text-sand-50">
                  {cells[mobilePrimaryIndex]}
                </div>
                {mobileBadgeIndexes.length > 0 ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {mobileBadgeIndexes.map((cellIndex) => (
                      <span key={cellIndex} className="inline-flex items-center">
                        {cells[cellIndex]}
                      </span>
                    ))}
                  </div>
                ) : null}
                {secondaryIndexes.length > 0 ? (
                  <dl className="mt-3 space-y-2 border-t border-ink-900/5 pt-3 dark:border-white/5">
                    {secondaryIndexes.map((cellIndex) => (
                      <div
                        key={cellIndex}
                        className="flex min-h-8 items-start justify-between gap-3 text-sm"
                      >
                        <dt className="shrink-0 pt-0.5 text-xs font-medium text-ink-700/60 dark:text-sand-100/60">
                          {columns[cellIndex]}
                        </dt>
                        <dd className="min-w-0 text-end text-ink-900 dark:text-sand-50">
                          {cells[cellIndex]}
                        </dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
              </article>
            );
          })
        )}
      </div>

      {/* Desktop / tablet: table */}
      <div className="arms-scroll-x hidden md:block">
        <table className="min-w-full text-start text-sm">
          <thead className="bg-sand-50 text-xs uppercase tracking-wide text-ink-700/70 dark:bg-ink-800 dark:text-sand-100/70">
            <tr>
              {columns.map((column, columnIndex) =>
                sortable && !unsortableSet.has(columnIndex) ? (
                  <SortableTh
                    key={`${column}-${columnIndex}`}
                    label={column}
                    columnKey={String(columnIndex)}
                    activeKey={sortKey}
                    direction={sortDirection}
                    onToggle={toggleSort}
                    className="px-4 py-3 font-medium"
                  />
                ) : (
                  <th key={`${column}-${columnIndex}`} className="px-4 py-3 font-medium">
                    {column}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row) => (
              <tr key={row.index} className="border-t border-ink-900/5 dark:border-white/5">
                {row.cells.map((cell, cellIndex) => (
                  <td key={cellIndex} className="px-4 py-3 align-middle">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
