import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

export default async function HomePage() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  return (
    <main className="relative min-h-screen overflow-hidden bg-ink-950 text-sand-50">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(111,154,104,0.28),transparent_40%),radial-gradient(circle_at_80%_0%,rgba(230,211,179,0.18),transparent_35%)]" />
      <div className="relative mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-6 py-16">
        <p className="text-sm uppercase tracking-[0.28em] text-aroma-200">Operational platform</p>
        <h1 className="mt-4 font-display text-5xl leading-tight md:text-7xl">
          ARMS
          <span className="block text-3xl text-sand-200 md:text-4xl">Aromatic Maintenance Service</span>
        </h1>
        <p className="mt-6 max-w-xl text-base text-sand-100/80 md:text-lg">
          One connected environment for aroma devices: customers, branches, service
          requests, technicians, spare parts, service centers, and the full device
          history.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href="/login"
            className="rounded-full bg-aroma-500 px-6 py-3 text-sm font-medium text-white hover:bg-aroma-600"
          >
            Enter workspace
          </Link>
        </div>
      </div>
    </main>
  );
}
