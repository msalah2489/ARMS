"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DEMO_USERS, ROLE_LABELS, isDemoMode } from "@/lib/auth";
import { signIn } from "@/lib/session";

export default function LoginPage() {
  const router = useRouter();
  const demo = isDemoMode();
  const [email, setEmail] = useState(demo ? "branch@arms.local" : "manager@arms.app");
  const [password, setPassword] = useState(demo ? "demo" : "");
  const [error, setError] = useState<string | null>(null);

  return (
    <main className="grid min-h-screen md:grid-cols-2">
      <section className="hidden bg-ink-950 p-12 text-sand-50 md:flex md:flex-col md:justify-between">
        <div>
          <p className="font-display text-3xl">ARMS</p>
          <p className="mt-2 text-sm text-aroma-200">نظام إدارة صيانة الأجهزة</p>
        </div>
        <p className="max-w-md text-sand-100/80">
          منصة لإدارة طلبات الصيانة حسب صلاحيات كل دور: مدير النظام، مدير الصيانة، الفرع، الفني، المشرف،
          والفني المتنقل.
        </p>
      </section>
      <section className="flex items-center justify-center bg-sand-50 px-6 py-12">
        <div className="w-full max-w-md">
          <h1 className="font-display text-3xl text-ink-900">تسجيل الدخول</h1>
          <p className="mt-2 text-sm text-ink-700/70">
            {demo ? "اختر دورًا تجريبيًا أو أدخل بيانات الدخول." : "استخدم حساب Supabase الخاص بك."}
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
            <p className="mt-4 rounded-xl bg-sand-100 px-3 py-2 text-xs text-ink-700/70">
              للتجربة الحالية: manager@arms.app / ArmsDemo123!
              <br />
              بعد تشغيل SQL الخاص بالفرع يمكن إنشاء حساب دور «فرع».
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
              البريد
              <input
                name="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-1 w-full rounded-xl border border-ink-900/15 bg-white px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              كلمة المرور
              <input
                name="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-1 w-full rounded-xl border border-ink-900/15 bg-white px-3 py-2"
              />
            </label>
            {error ? <p className="text-sm text-rose-700">{error}</p> : null}
            <button
              type="submit"
              className="w-full rounded-full bg-ink-900 py-2.5 text-sm font-medium text-white hover:bg-ink-800"
            >
              دخول
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
