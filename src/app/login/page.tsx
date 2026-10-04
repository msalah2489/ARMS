"use client";

import { useActionState, useState } from "react";
import { loginAction } from "@/app/actions";
import { DEMO_USERS, ROLE_LABELS } from "@/lib/auth";

export default function LoginPage() {
  const [email, setEmail] = useState(DEMO_USERS[0].email);
  const [password, setPassword] = useState("demo");
  const [error, action] = useActionState(loginAction, null);

  return (
    <main className="grid min-h-screen md:grid-cols-2">
      <section className="hidden bg-ink-950 p-12 text-sand-50 md:flex md:flex-col md:justify-between">
        <div>
          <p className="font-display text-3xl">ARMS</p>
          <p className="mt-2 text-sm text-aroma-200">Aromatic Maintenance Service</p>
        </div>
        <p className="max-w-md text-sand-100/80">
          Sign in with a role workspace. Demo mode is on until Supabase is connected.
        </p>
      </section>
      <section className="flex items-center justify-center bg-sand-50 px-6 py-12">
        <div className="w-full max-w-md">
          <h1 className="font-display text-3xl text-ink-900">Sign in</h1>
          <p className="mt-2 text-sm text-ink-700/70">Choose a role or enter demo credentials.</p>
          <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {DEMO_USERS.map((user) => (
              <button
                key={user.email}
                type="button"
                onClick={() => {
                  setEmail(user.email);
                  setPassword(user.password);
                }}
                className="rounded-xl border border-ink-900/10 bg-white px-3 py-2 text-left text-sm hover:border-aroma-400"
              >
                <span className="block font-medium">{ROLE_LABELS[user.role]}</span>
                <span className="text-xs text-ink-700/60">{user.email}</span>
              </button>
            ))}
          </div>
          <form className="mt-8 space-y-4" action={action}>
            <label className="block text-sm">
              Email
              <input
                name="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-1 w-full rounded-xl border border-ink-900/15 bg-white px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              Password
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
              Continue
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
