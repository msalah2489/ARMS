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
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-3xl text-ink-900">{title}</h1>
        {description ? <p className="mt-1 text-sm text-ink-700/70">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
