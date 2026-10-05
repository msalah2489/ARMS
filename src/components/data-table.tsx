export function DataTable({
  columns,
  rows,
}: {
  columns: string[];
  rows: React.ReactNode[][];
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-ink-900/10 bg-white shadow-panel dark:border-white/10 dark:bg-ink-900">
      <div className="overflow-x-auto">
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
