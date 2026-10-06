export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <h1 className="font-display text-2xl text-ink-900 dark:text-sand-50 sm:text-3xl">{title}</h1>
        {description ? (
          <p className="mt-1 text-sm text-ink-700/70 dark:text-sand-100/70">{description}</p>
        ) : null}
      </div>
      {action ? <div className="flex flex-wrap items-center gap-2 [&_a]:inline-flex [&_a]:min-h-11 [&_a]:items-center [&_button]:min-h-11">{action}</div> : null}
    </div>
  );
}
