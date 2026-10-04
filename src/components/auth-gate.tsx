"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { readSession } from "@/lib/session";
import type { Profile } from "@/types/domain";

export function AuthGate({
  children,
  render,
}: {
  children?: React.ReactNode;
  render: (user: Profile) => React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<Profile | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const session = readSession();
    if (!session) {
      router.replace("/login");
      return;
    }
    setUser(session);
    setReady(true);
  }, [pathname, router]);

  if (!ready || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-sand-50 text-sm text-ink-700/70">
        Loading workspace…
      </div>
    );
  }

  return <>{render(user)}</>;
}
