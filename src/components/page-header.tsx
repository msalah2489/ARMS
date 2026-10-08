import Link from "next/link";

export function PageHeader({
  title,
  description,
  action,
  backHref,
  backLabel = "رجوع",
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  /** Optional back link shown above the title (detail pages). */
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-4">
      <div className="min-w-0">
        {backHref ? (
          <Link
            href={backHref}
            className="mb-2 inline-flex min-h-9 items-center gap-1.5 rounded-full border border-ink-900/15 bg-white px-3 py-1.5 text-sm text-ink-800 transition hover:border-aroma-400 hover:text-aroma-800 dark:border-white/15 dark:bg-ink-900 dark:text-sand-100 dark:hover:border-aroma-400 dark:hover:text-aroma-200"
          >
            <span aria-hidden className="text-base leading-none">
              →
            </span>
            {backLabel}
          </Link>
        ) : null}
        <h1 className="font-display text-2xl text-ink-900 dark:text-sand-50 sm:text-3xl">{title}</h1>
        {description ? (
          <p className="mt-1 text-sm text-ink-700/70 dark:text-sand-100/70">{description}</p>
        ) : null}
      </div>
      {action ? (
        <div className="flex flex-wrap items-center gap-2 [&_a]:inline-flex [&_a]:min-h-11 [&_a]:items-center [&_button]:min-h-11">
          {action}
        </div>
      ) : null}
    </div>
  );
}
