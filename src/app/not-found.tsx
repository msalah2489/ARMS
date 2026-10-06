import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-sand-50 px-4 text-ink-900 dark:bg-ink-950 dark:text-sand-50">
      <h1 className="font-display text-3xl">الصفحة غير موجودة</h1>
      <p className="text-sm text-ink-700/70 dark:text-sand-100/70">Not found</p>
      <Link
        href="/dashboard/"
        className="text-sm font-medium text-aroma-700 underline underline-offset-4 dark:text-aroma-200"
      >
        العودة إلى الرئيسية
      </Link>
    </main>
  );
}
