import type { ReactNode } from "react";

export function DataTable({
  columns,
  rows,
  mobilePrimaryIndex = 0,
  mobileBadgeIndexes = [],
}: {
  columns: string[];
  rows: ReactNode[][];
  /** Column shown as the card title on small screens (default: first). */
  mobilePrimaryIndex?: number;
  /** Columns rendered as a compact badge/meta row under the title. */
  mobileBadgeIndexes?: number[];
}) {
  const badgeSet = new Set(mobileBadgeIndexes);

  return (
    <div className="overflow-hidden rounded-2xl border border-ink-900/10 bg-white shadow-panel dark:border-white/10 dark:bg-ink-900">
      {/* Mobile: stacked cards */}
      <div className="space-y-3 p-3 md:hidden">
        {rows.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-ink-700/60 dark:text-sand-100/60">—</p>
        ) : (
          rows.map((row, index) => {
            const secondaryIndexes = row
              .map((_, cellIndex) => cellIndex)
              .filter(
                (cellIndex) =>
                  cellIndex !== mobilePrimaryIndex && !badgeSet.has(cellIndex),
              );

            return (
              <article
                key={index}
                className="rounded-xl border border-ink-900/10 bg-sand-50/60 p-3.5 dark:border-white/10 dark:bg-ink-950/40"
              >
                <div className="min-w-0 text-base font-semibold text-ink-900 dark:text-sand-50">
                  {row[mobilePrimaryIndex]}
                </div>
                {mobileBadgeIndexes.length > 0 ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {mobileBadgeIndexes.map((cellIndex) => (
                      <span key={cellIndex} className="inline-flex items-center">
                        {row[cellIndex]}
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
                          {row[cellIndex]}
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
              {columns.map((column) => (
                <th key={column} className="px-4 py-3 font-medium">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index} className="border-t border-ink-900/5 dark:border-white/5">
                {row.map((cell, cellIndex) => (
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
