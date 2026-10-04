import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-sand-50">
      <h1 className="font-display text-3xl">Not found</h1>
      <Link href="/dashboard" className="text-sm text-aroma-700 underline">
        Back to dashboard
      </Link>
    </main>
  );
}
