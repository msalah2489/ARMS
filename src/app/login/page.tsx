"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArmsLogo } from "@/components/arms-logo";
import { ROLE_LABELS, isDemoMode } from "@/lib/auth";
import { signIn } from "@/lib/session";
import { hydrateOpsFromSupabase } from "@/lib/supabase/hydrate";
import { listManagedUsers } from "@/lib/users-store";
import type { ManagedUser } from "@/types/domain";

export default function LoginPage() {
  const router = useRouter();
  const demo = isDemoMode();
  const [email, setEmail] = useState(demo ? "admin" : "");
  const [password, setPassword] = useState(demo ? "demo" : "");
  const [error, setError] = useState<string | null>(null);
  // TEMPORARY: visible account shortcuts for easier login during setup — remove later.
  const [accounts, setAccounts] = useState<ManagedUser[]>([]);

  useEffect(() => {
    void (async () => {
      await hydrateOpsFromSupabase();
      setAccounts(listManagedUsers().filter((user) => user.isActive && !user.isArchived));
    })();
  }, []);

  return (
    <main className="grid min-h-screen md:grid-cols-[minmax(200px,28%)_minmax(0,1fr)]">
      <section className="hidden bg-ink-950 px-6 py-10 text-sand-50 md:flex md:flex-col md:items-center md:justify-center">
        <div className="flex flex-col items-center text-center">
          <ArmsLogo size="hero" animate />
          <p className="mt-4 text-sm text-aroma-200">نظام إدارة صيانة الأجهزة</p>
        </div>
      </section>
      <section className="flex items-center justify-center bg-sand-50 px-4 py-10 dark:bg-ink-950 sm:px-6 sm:py-12">
        <div className="w-full max-w-md">
          <div className="mb-6 flex justify-center md:hidden">
            <ArmsLogo size="xl" animate />
          </div>
          <h1 className="font-display text-2xl text-ink-900 dark:text-sand-50 sm:text-3xl">
            تسجيل الدخول
          </h1>
          <p className="mt-2 text-sm text-ink-700/70 dark:text-sand-100/70">
            {demo
              ? "اختر حسابًا من القائمة أو سجّل باسم المستخدم وكلمة المرور."
              : "سجّل الدخول بحساب موجود في قاعدة البيانات، أو اختر من القائمة المؤقتة أدناه."}
          </p>

          {/* TEMPORARY: account picker for convenience — remove when accounts are known. */}
          {accounts.length > 0 ? (
            <div className="mt-6">
              <p className="mb-2 text-xs text-ink-700/50 dark:text-sand-100/50">
                حسابات متاحة (مؤقت) — اضغط للتعبئة
              </p>
              <div className="grid max-h-48 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
                {accounts.map((user) => {
                  const showDemoHint = demo || user.password === "demo";
                  return (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => {
                        setEmail(user.username);
                        if (showDemoHint) setPassword(user.password);
                      }}
                      className="rounded-xl border border-ink-900/10 bg-white px-3 py-2 text-right text-sm hover:border-aroma-400 dark:border-white/10 dark:bg-ink-900 dark:hover:border-aroma-400"
                    >
                      <span className="block font-medium dark:text-sand-50">
                        {user.fullName}
                      </span>
                      <span className="text-xs text-ink-700/60 dark:text-sand-100/60">
                        {user.username}
                        {ROLE_LABELS[user.role] ? ` · ${ROLE_LABELS[user.role]}` : ""}
                      </span>
                      {showDemoHint ? (
                        <span className="mt-0.5 block text-[11px] text-aroma-700/80 dark:text-aroma-200/80">
                          كلمة المرور: {user.password}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="mt-4 rounded-2xl border border-ink-900/10 bg-white p-4 text-sm text-ink-700/70 dark:border-white/10 dark:bg-ink-900 dark:text-sand-100/70">
              {demo
                ? "جاري تحميل الحسابات التجريبية…"
                : "لا تُعرض حسابات بعد. استخدم اسم المستخدم وكلمة المرور المحفوظين في Supabase، أو انتظر مزامنة البيانات."}
            </p>
          )}

          <form
            className="mt-8 space-y-4"
            onSubmit={async (event) => {
              event.preventDefault();
              setError(null);
              const result = await signIn(email, password);
              if (result.error) {
                setError(result.error);
                return;
              }
              router.replace("/dashboard");
            }}
          >
            <label className="block text-sm dark:text-sand-100">
              اسم المستخدم
              <input
                name="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="مثال: nora.branch"
                autoComplete="username"
                className="mt-1 min-h-11 w-full rounded-xl border border-ink-900/15 bg-white px-3 py-2 dark:border-white/15 dark:bg-ink-900 dark:text-sand-50"
              />
            </label>
            <label className="block text-sm dark:text-sand-100">
              كلمة المرور
              <input
                name="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-1 min-h-11 w-full rounded-xl border border-ink-900/15 bg-white px-3 py-2 dark:border-white/15 dark:bg-ink-900 dark:text-sand-50"
              />
            </label>
            {error ? (
              <p className="text-sm text-rose-700 dark:text-rose-300">{error}</p>
            ) : null}
            <button
              type="submit"
              className="min-h-11 w-full rounded-full bg-ink-900 py-2.5 text-sm font-medium text-white hover:bg-ink-800 dark:bg-aroma-600 dark:hover:bg-aroma-500"
            >
              دخول
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
