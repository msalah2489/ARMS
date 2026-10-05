"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DEMO_USERS, ROLE_LABELS, isDemoMode } from "@/lib/auth";
import { signIn, writeSession } from "@/lib/session";

export default function LoginPage() {
  const router = useRouter();
  const demo = isDemoMode();
  const [email, setEmail] = useState(demo ? "branch@arms.local" : "manager@arms.app");
  const [password, setPassword] = useState(demo ? "demo" : "");
  const [error, setError] = useState<string | null>(null);

  function enterAs(role: "branch" | "technician" | "maintenance_manager") {
    if (role === "branch") {
      writeSession({
        id: "branch-local",
        fullName: "نورة الفرع",
        role: "branch",
        email: "branch@arms.local",
        opsBranchId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1",
        opsBranchName: "فرع الرياض",
      });
    } else if (role === "technician") {
      writeSession({
        id: "tech-local",
        fullName: "كريم الفني",
        role: "technician",
        email: "tech@arms.local",
        opsBranchId: null,
        opsBranchName: "مركز الصيانة",
      });
    } else {
      writeSession({
        id: "maint-manager-local",
        fullName: "سارة مدير الصيانة",
        role: "maintenance_manager",
        email: "maint-manager@arms.local",
        opsBranchId: null,
        opsBranchName: null,
      });
    }
    router.replace("/dashboard");
  }

  return (
    <main className="grid min-h-screen md:grid-cols-2">
      <section className="hidden bg-ink-950 p-12 text-sand-50 md:flex md:flex-col md:justify-between">
        <div>
          <p className="font-display text-3xl">ARMS</p>
          <p className="mt-2 text-sm text-aroma-200">نظام إدارة صيانة الأجهزة</p>
        </div>
        <p className="max-w-md text-sand-100/80">
          كل حساب له تبويباته فقط: الفرع لإدارة الطلبات والاستلام، والفني للصيانة وسكان الأجهزة.
        </p>
      </section>
      <section className="flex items-center justify-center bg-sand-50 px-6 py-12">
        <div className="w-full max-w-md">
          <h1 className="font-display text-3xl text-ink-900">تسجيل الدخول</h1>
          <p className="mt-2 text-sm text-ink-700/70">
            {demo ? "اختر دورًا تجريبيًا أو أدخل بيانات الدخول." : "اختر الحساب المناسب لصلاحياتك."}
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
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => enterAs("branch")}
                className="rounded-2xl border border-ink-900/10 bg-white p-4 text-right hover:border-aroma-400"
              >
                <p className="font-medium text-ink-900">حساب الفرع</p>
                <p className="mt-1 text-xs text-ink-700/70">إنشاء طلب · استلام · تسليم للشحن</p>
              </button>
              <button
                type="button"
                onClick={() => enterAs("technician")}
                className="rounded-2xl border border-ink-900/10 bg-white p-4 text-right hover:border-aroma-400"
              >
                <p className="font-medium text-ink-900">حساب الفني</p>
                <p className="mt-1 text-xs text-ink-700/70">الرئيسية · سكان · عمل الفني</p>
              </button>
              <button
                type="button"
                onClick={() => enterAs("maintenance_manager")}
                className="rounded-2xl border border-ink-900/10 bg-white p-4 text-right hover:border-aroma-400 sm:col-span-2"
              >
                <p className="font-medium text-ink-900">مدير الصيانة</p>
                <p className="mt-1 text-xs text-ink-700/70">إنشاء بوالص الشحن للأجهزة في الفروع</p>
              </button>
              <p className="sm:col-span-2 text-xs text-ink-700/60">
                حساب المدير (Supabase): manager@arms.app / ArmsDemo123!
              </p>
            </div>
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
