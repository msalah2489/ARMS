"use client";

import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ArmsLogo } from "@/components/arms-logo";
import { AuthGate } from "@/components/auth-gate";
import { Sidebar } from "@/components/sidebar";
import { SyncStatusBanner } from "@/components/sync-status-banner";
import { usePreferences } from "@/components/preferences-provider";
import { hydrateOpsFromSupabase } from "@/lib/supabase/hydrate";
import { migrateExistingShippingToReceived } from "@/lib/shipping-store";
import { UnsavedChangesProvider } from "@/lib/unsaved-changes";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { t } = usePreferences();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    // Non-blocking: session cache makes this a no-op after first successful hydrate.
    void hydrateOpsFromSupabase().finally(() => {
      migrateExistingShippingToReceived();
    });
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  return (
    <AuthGate
      render={(user) => (
        <UnsavedChangesProvider>
          <div className="flex min-h-screen bg-sand-50 dark:bg-ink-950">
            {/* Desktop rail: icons by default; expands over content on hover/focus */}
            <div className="sticky top-0 z-30 hidden h-screen w-16 shrink-0 md:block">
              <div className="absolute inset-y-0 start-0 z-30 h-full">
                <Sidebar user={user} variant="rail" />
              </div>
            </div>

            <div className="flex min-w-0 flex-1 flex-col">
              <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-ink-900/10 bg-white/90 px-3 py-2.5 backdrop-blur dark:border-white/10 dark:bg-ink-900/90 md:hidden">
                <button
                  type="button"
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-ink-900/10 text-ink-900 dark:border-white/15 dark:text-sand-50"
                  aria-expanded={menuOpen}
                  aria-controls="mobile-nav-drawer"
                  onClick={() => setMenuOpen(true)}
                >
                  <Menu className="h-5 w-5" aria-hidden />
                  <span className="sr-only">{t("common.openMenu")}</span>
                </button>
                <ArmsLogo size="sm" />
                <span className="max-w-[40%] truncate text-end text-xs text-ink-700/70 dark:text-sand-100/70">
                  {user.fullName}
                </span>
              </header>

              {/* Mobile drawer */}
              {menuOpen ? (
                <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true">
                  <button
                    type="button"
                    className="absolute inset-0 bg-ink-950/50"
                    aria-label={t("common.closeMenu")}
                    onClick={() => setMenuOpen(false)}
                  />
                  <div
                    id="mobile-nav-drawer"
                    className="absolute inset-y-0 start-0 flex w-[min(18rem,86vw)] flex-col shadow-panel"
                  >
                    <div className="absolute end-2 top-2 z-10">
                      <button
                        type="button"
                        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-sand-50"
                        onClick={() => setMenuOpen(false)}
                      >
                        <X className="h-5 w-5" aria-hidden />
                        <span className="sr-only">{t("common.closeMenu")}</span>
                      </button>
                    </div>
                    <Sidebar user={user} variant="drawer" onNavigate={() => setMenuOpen(false)} />
                  </div>
                </div>
              ) : null}

              <SyncStatusBanner />
              <main className="flex-1 px-3 py-4 text-ink-900 dark:text-sand-50 sm:px-4 sm:py-6 md:px-8">
                {children}
              </main>
            </div>
          </div>
        </UnsavedChangesProvider>
      )}
    />
  );
}
