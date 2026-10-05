"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { navForRole } from "@/lib/nav";
import { ROLE_LABELS } from "@/lib/auth";
import { signOut } from "@/lib/session";
import type { Profile } from "@/types/domain";

export function Sidebar({ user }: { user: Profile }) {
  const router = useRouter();
  const pathname = usePathname();
  const items = navForRole(user.role);

  return (
    <aside className="flex h-full w-64 flex-col bg-ink-950 text-sand-50">
      <div className="border-b border-white/10 px-5 py-6">
        <p className="font-display text-2xl tracking-tight">ARMS</p>
        <p className="mt-1 text-xs text-aroma-200">نظام إدارة الصيانة</p>
        {user.opsBranchName ? (
          <p className="mt-3 text-xs text-sand-100/70">{user.opsBranchName}</p>
        ) : null}
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {items.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${
                active ? "bg-white/15 text-white" : "text-sand-100 hover:bg-white/10"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0 opacity-80" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/10 p-4">
        <p className="text-sm font-medium">{user.fullName}</p>
        <p className="text-xs text-aroma-200">{ROLE_LABELS[user.role]}</p>
        <button
          type="button"
          onClick={async () => {
            await signOut();
            router.replace("/login");
          }}
          className="mt-3 text-xs text-sand-200 underline-offset-2 hover:underline"
        >
          تسجيل الخروج
        </button>
      </div>
    </aside>
  );
}
