import { Sidebar } from "@/components/sidebar";
import { requireSession } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireSession();

  return (
    <div className="flex min-h-screen">
      <div className="sticky top-0 hidden h-screen md:block">
        <Sidebar user={user} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-ink-900/10 bg-white/80 px-4 py-3 backdrop-blur md:hidden">
          <span className="font-display text-xl">ARMS</span>
          <span className="text-xs text-ink-700/70">{user.fullName}</span>
        </header>
        <main className="flex-1 px-4 py-6 md:px-8">{children}</main>
      </div>
    </div>
  );
}
