"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { usePreferences } from "@/components/preferences-provider";
import { ROLE_LABELS } from "@/lib/auth";
import { translate } from "@/lib/i18n/messages";
import type { AppLocale, AppTheme } from "@/lib/preferences";
import { readSession, writeSession } from "@/lib/session";
import {
  ASSIGNABLE_ROLE_LABELS,
  findManagedUserForSession,
  managedUserToProfile,
  updateManagedUserSelf,
} from "@/lib/users-store";
import type { AssignableUserRole, Profile } from "@/types/domain";

const panelClass =
  "rounded-2xl border border-ink-900/10 bg-white p-5 shadow-panel dark:border-white/10 dark:bg-ink-900";
const inputClass =
  "mt-1 w-full rounded-xl border border-ink-900/15 bg-white px-3 py-2 dark:border-white/15 dark:bg-ink-950 dark:text-sand-50";

export default function AccountPage() {
  const { t, locale, theme, setLocale, setTheme } = usePreferences();
  const [user, setUser] = useState<Profile | null>(null);
  const [managedId, setManagedId] = useState<string | null>(null);
  const [mobile, setMobile] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const session = readSession();
    if (!session) return;

    const managed = findManagedUserForSession(session);
    if (managed) {
      const profile = managedUserToProfile(managed);
      writeSession(profile);
      setUser(profile);
      setManagedId(managed.id);
      setMobile(managed.mobile);
      return;
    }

    setUser(session);
    setMobile(session.mobile ?? "");
    setManagedId(null);
  }, []);

  if (!user) {
    return <p className="text-sm text-ink-700/70 dark:text-sand-100/70">{t("common.loading")}</p>;
  }

  const roleLabel =
    ASSIGNABLE_ROLE_LABELS[user.role as AssignableUserRole] ?? ROLE_LABELS[user.role];

  return (
    <div className="space-y-6">
      <PageHeader title={t("account.title")} description={t("account.description")} />

      {error ? <p className="text-sm text-rose-700 dark:text-rose-300">{error}</p> : null}
      {message ? <p className="text-sm text-aroma-700 dark:text-aroma-200">{message}</p> : null}

      <section className={panelClass}>
        <h2 className="font-display text-xl">{t("account.preferences")}</h2>
        <p className="mt-1 text-sm text-ink-700/70 dark:text-sand-100/70">
          {t("account.preferencesHint")}
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="block text-sm">
            {t("account.language")}
            <select
              value={locale}
              onChange={(e) => {
                const next = e.target.value as AppLocale;
                setLocale(next);
                setMessage(translate(next, "account.prefsSaved"));
                setError(null);
              }}
              className={inputClass}
            >
              <option value="ar">{t("account.languageAr")}</option>
              <option value="en">{t("account.languageEn")}</option>
            </select>
          </label>
          <label className="block text-sm">
            {t("account.theme")}
            <select
              value={theme}
              onChange={(e) => {
                const next = e.target.value as AppTheme;
                setTheme(next);
                setMessage(translate(locale, "account.prefsSaved"));
                setError(null);
              }}
              className={inputClass}
            >
              <option value="light">{t("account.themeLight")}</option>
              <option value="dark">{t("account.themeDark")}</option>
            </select>
          </label>
        </div>
      </section>

      <section className={panelClass}>
        <h2 className="font-display text-xl">{t("account.details")}</h2>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-ink-700/60 dark:text-sand-100/60">{t("account.name")}</dt>
            <dd className="font-medium">{user.fullName}</dd>
          </div>
          <div>
            <dt className="text-ink-700/60 dark:text-sand-100/60">{t("account.username")}</dt>
            <dd className="font-medium">{user.username || "—"}</dd>
          </div>
          <div>
            <dt className="text-ink-700/60 dark:text-sand-100/60">{t("account.role")}</dt>
            <dd className="font-medium">{roleLabel}</dd>
          </div>
          <div>
            <dt className="text-ink-700/60 dark:text-sand-100/60">{t("account.branch")}</dt>
            <dd className="font-medium">{user.opsBranchName || "—"}</dd>
          </div>
          <div>
            <dt className="text-ink-700/60 dark:text-sand-100/60">{t("account.mobile")}</dt>
            <dd className="font-medium">{user.mobile || "—"}</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-ink-700/50 dark:text-sand-100/50">
          {t("account.immutableHint")}
        </p>
      </section>

      {managedId ? (
        <section className={panelClass}>
          <h2 className="font-display text-xl">{t("account.updateTitle")}</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="block text-sm md:col-span-2">
              {t("account.mobileRequired")}
              <input
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                placeholder="05xxxxxxxx"
                className={inputClass}
              />
            </label>
            <label className="block text-sm">
              {t("account.currentPassword")}
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="block text-sm">
              {t("account.newPassword")}
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="block text-sm md:col-span-2">
              {t("account.confirmPassword")}
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={inputClass}
              />
            </label>
          </div>
          <p className="mt-2 text-xs text-ink-700/50 dark:text-sand-100/50">
            {t("account.passwordHint")}
          </p>
          <button
            type="button"
            className="mt-5 rounded-full bg-ink-900 px-5 py-2.5 text-sm text-white dark:bg-aroma-600"
            onClick={() => {
              setError(null);
              setMessage(null);
              if (newPassword && newPassword !== confirmPassword) {
                setError(t("account.passwordMismatch"));
                return;
              }
              const result = updateManagedUserSelf(managedId, {
                mobile,
                currentPassword: newPassword ? currentPassword : undefined,
                newPassword: newPassword || undefined,
              });
              if (!result.ok) {
                setError(result.error);
                return;
              }
              const nextSession = managedUserToProfile(result.user);
              writeSession(nextSession);
              setUser(nextSession);
              setCurrentPassword("");
              setNewPassword("");
              setConfirmPassword("");
              setMessage(t("account.saved"));
            }}
          >
            {t("common.save")}
          </button>
        </section>
      ) : (
        <p className="rounded-2xl border border-dashed border-ink-900/15 bg-white px-4 py-6 text-sm text-ink-700/60 dark:border-white/15 dark:bg-ink-900 dark:text-sand-100/70">
          {t("account.notEditable")}
        </p>
      )}
    </div>
  );
}
