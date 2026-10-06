"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArmsLogo } from "@/components/arms-logo";
import { DEMO_USERS, ROLE_LABELS, isDemoMode } from "@/lib/auth";
import { signIn } from "@/lib/session";
import { hydrateOpsFromSupabase } from "@/lib/supabase/hydrate";

export default function LoginPage() {
  const router = useRouter();
  const demo = isDemoMode();
  const [email, setEmail] = useState(demo ? "admin" : "");
  const [password, setPassword] = useState(demo ? "demo" : "");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void hydrateOpsFromSupabase();
  }, []);

  return (
    <main className="grid min-h-screen md:grid-cols-2">
      <section className="hidden bg-ink-950 p-12 text-sand-50 md:flex md:flex-col md:justify-between">
        <div>
          <ArmsLogo size="lg" />
          <p className="mt-2 text-sm text-aroma-200">نظام إدارة صيانة الأجهزة</p>
        </div>
        <p className="max-w-md text-sand-100/80">
          كل حساب له تبويباته فقط: الفرع لإدارة الطلبات والاستلام، والفني للصيانة وسكان الأجهزة.
        </p>
      </section>
      <section className="flex items-center justify-center bg-sand-50 px-4 py-10 sm:px-6 sm:py-12">
        <div className="w-full max-w-md">
          <div className="mb-4 md:hidden">
            <ArmsLogo size="md" />
          </div>
          <h1 className="font-display text-2xl text-ink-900 sm:text-3xl">تسجيل الدخول</h1>
          <p className="mt-2 text-sm text-ink-700/70">
            {demo
              ? "اختر دورًا تجريبيًا أو سجّل باسم المستخدم الذي أنشأه مدير النظام + كلمة المرور."
              : "سجّل الدخول بحساب موجود في قاعدة البيانات (أنشأه مدير النظام)."}
          </p>

          {demo ? (
            <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {DEMO_USERS.map((user) => (
                <button
                  key={user.email}
                  type="button"
                  onClick={() => {
                    setEmail(user.email);
                    setPassword(user.password);
                  }}
                  className="rounded-xl border border-ink-900/10 bg-white px-3 py-2 text-right text-sm hover:border-aroma-400"
                >
                  <span className="block font-medium">{ROLE_LABELS[user.role]}</span>
                  <span className="text-xs text-ink-700/60">{user.email}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="mt-4 rounded-2xl border border-ink-900/10 bg-white p-4 text-sm text-ink-700/70">
              لا تُعرض حسابات تجريبية مضمّنة في الكود. استخدم اسم المستخدم وكلمة المرور المحفوظين في
              Supabase فقط.
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
            <label className="block text-sm">
              اسم المستخدم
              <input
                name="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="مثال: nora.branch"
                autoComplete="username"
                className="mt-1 min-h-11 w-full rounded-xl border border-ink-900/15 bg-white px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              كلمة المرور
              <input
                name="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-1 min-h-11 w-full rounded-xl border border-ink-900/15 bg-white px-3 py-2"
              />
            </label>
            {error ? <p className="text-sm text-rose-700">{error}</p> : null}
            <button
              type="submit"
              className="min-h-11 w-full rounded-full bg-ink-900 py-2.5 text-sm font-medium text-white hover:bg-ink-800"
            >
              دخول
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
