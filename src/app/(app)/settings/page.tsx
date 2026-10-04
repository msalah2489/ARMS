"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { ROLE_LABELS } from "@/lib/auth";
import { readSession } from "@/lib/session";
import type { Profile } from "@/types/domain";

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<Profile | null>(null);

  useEffect(() => {
    const session = readSession();
    if (!session) return;
    if (session.role !== "manager") {
      router.replace("/dashboard");
      return;
    }
    setUser(session);
  }, [router]);

  if (!user) {
    return <p className="text-sm text-ink-700/70">Loading settings…</p>;
  }

  return (
    <div>
      <PageHeader
        title="Configuration"
        description="Users, roles, device models, statuses, and system settings. Manager workspace only."
      />
      <div className="grid gap-4 md:grid-cols-2">
        {[
          ["Users and permissions", "Invite staff and assign Manager, Supervisor, Technician, Branch, or Service Center roles."],
          ["Device models", "Catalog of aroma device types, compatible accessories, and spare parts."],
          ["Status workflow", "Control allowed device and service-request status values."],
          ["Service centers", "Central repair locations that receive dispatched devices."],
        ].map(([title, body]) => (
          <section key={title} className="rounded-2xl border border-ink-900/10 bg-white p-6 shadow-panel">
            <h2 className="font-display text-xl">{title}</h2>
            <p className="mt-2 text-sm text-ink-700/70">{body}</p>
          </section>
        ))}
      </div>
      <p className="mt-6 text-xs text-ink-700/50">
        Signed in as {user.email} · {ROLE_LABELS[user.role]}
      </p>
    </div>
  );
}
