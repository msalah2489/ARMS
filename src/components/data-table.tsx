export function DataTable({
  columns,
  rows,
}: {
  columns: string[];
  rows: React.ReactNode[][];
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-ink-900/10 bg-white shadow-panel dark:border-white/10 dark:bg-ink-900">
      {/* Mobile: stacked cards */}
      <div className="space-y-3 p-3 md:hidden">
        {rows.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-ink-700/60 dark:text-sand-100/60">—</p>
        ) : (
          rows.map((row, index) => (
            <article
              key={index}
              className="rounded-xl border border-ink-900/10 bg-sand-50/60 p-3 dark:border-white/10 dark:bg-ink-950/40"
            >
              <dl className="space-y-2.5">
                {row.map((cell, cellIndex) => (
                  <div
                    key={cellIndex}
                    className="flex min-h-10 items-start justify-between gap-3 text-sm"
                  >
                    <dt className="shrink-0 pt-0.5 text-xs font-medium uppercase tracking-wide text-ink-700/60 dark:text-sand-100/60">
                      {columns[cellIndex]}
                    </dt>
                    <dd className="min-w-0 text-end text-ink-900 dark:text-sand-50">{cell}</dd>
                  </div>
                ))}
              </dl>
            </article>
          ))
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
