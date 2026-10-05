"use client";

import { useEffect } from "react";
import { AuthGate } from "@/components/auth-gate";
import { Sidebar } from "@/components/sidebar";
import { migrateExistingShippingToReceived } from "@/lib/shipping-store";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    migrateExistingShippingToReceived();
  }, []);

  return (
    <AuthGate
      render={(user) => (
        <div className="flex min-h-screen bg-sand-50 dark:bg-ink-950">
          <div className="sticky top-0 hidden h-screen w-64 shrink-0 md:block">
            <Sidebar user={user} />
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <header className="flex items-center justify-between gap-3 border-b border-ink-900/10 bg-white/80 px-4 py-3 backdrop-blur dark:border-white/10 dark:bg-ink-900/80 md:hidden">
              <span className="font-display text-xl text-ink-900 dark:text-sand-50">ARMS</span>
              <span className="truncate text-xs text-ink-700/70 dark:text-sand-100/70">{user.fullName}</span>
            </header>
            <main className="flex-1 px-4 py-6 text-ink-900 dark:text-sand-50 md:px-8">{children}</main>
          </div>
        </div>
      )}
    />
  );
}
