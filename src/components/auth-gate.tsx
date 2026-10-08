"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { readSession } from "@/lib/session";
import type { Profile } from "@/types/domain";

function readSessionSafe(): Profile | null {
  if (typeof window === "undefined") return null;
  return readSession();
}

export function AuthGate({
  children,
  render,
}: {
  children?: React.ReactNode;
  render: (user: Profile) => React.ReactNode;
}) {
  const router = useRouter();
  // Sync init avoids "Loading workspace…" flash on every soft navigation remount.
  const [user, setUser] = useState<Profile | null>(readSessionSafe);
  const [ready, setReady] = useState(() => Boolean(readSessionSafe()));

  useEffect(() => {
    function syncFromSession() {
      const session = readSession();
      if (!session) {
        setUser(null);
        setReady(false);
        const next =
          typeof window !== "undefined"
            ? `${window.location.pathname}${window.location.search}`
            : "";
        const loginPath =
          next && next !== "/login" && next !== "/login/"
            ? `/login?next=${encodeURIComponent(next)}`
            : "/login";
        router.replace(loginPath);
        return;
      }
      setUser(session);
      setReady(true);
    }

    syncFromSession();
    window.addEventListener("arms-session-updated", syncFromSession);
    window.addEventListener("arms-ops-hydrated", syncFromSession);
    return () => {
      window.removeEventListener("arms-session-updated", syncFromSession);
      window.removeEventListener("arms-ops-hydrated", syncFromSession);
    };
  }, [router]);

  if (!ready || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-sand-50 text-sm text-ink-700/70">
        Loading workspace…
      </div>
    );
  }

  return <>{render(user)}</>;
}
