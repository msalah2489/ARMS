"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ExpandableSection } from "@/components/expandable-section";
import { ImagePickerField, type ImageValue } from "@/components/image-picker-field";
import { PageHeader } from "@/components/page-header";
import { usePreferences } from "@/components/preferences-provider";
import { ROLE_LABELS, isSystemAdminRole, normalizeRole } from "@/lib/auth";
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

const inputClass =
  "mt-1 w-full rounded-xl border border-ink-900/15 bg-white px-3 py-2 dark:border-white/15 dark:bg-ink-950 dark:text-sand-50";

export default function SettingsPage() {
  const { t, locale, theme, setLocale, setTheme } = usePreferences();
  const [user, setUser] = useState<Profile | null>(null);
  const [managedId, setManagedId] = useState<string | null>(null);
  const [mobile, setMobile] = useState("");
  const [photo, setPhoto] = useState<ImageValue | null>(null);
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
      setPhoto(
        managed.photoDataUrl
          ? { name: managed.photoName || "photo.jpg", dataUrl: managed.photoDataUrl }
          : null,
      );
      return;
    }

    setUser(session);
    setMobile(session.mobile ?? "");
    setPhoto(
      session.photoDataUrl
        ? { name: session.photoName || "photo.jpg", dataUrl: session.photoDataUrl }
        : null,
    );
    setManagedId(null);
  }, []);

  if (!user) {
    return <p className="text-sm text-ink-700/70 dark:text-sand-100/70">{t("common.loading")}</p>;
  }

  const role = normalizeRole(user.role);
  const showSystem = isSystemAdminRole(role) || role === "manager";
  const roleLabel =
    ASSIGNABLE_ROLE_LABELS[user.role as AssignableUserRole] ?? ROLE_LABELS[user.role];

  return (
    <div className="space-y-6">
      <PageHeader title={t("settings.title")} description={t("settings.description")} />

      {error ? <p className="text-sm text-rose-700 dark:text-rose-300">{error}</p> : null}
      {message ? <p className="text-sm text-aroma-700 dark:text-aroma-200">{message}</p> : null}

      <ExpandableSection title={t("account.preferences")} defaultOpen>
        <p className="text-sm text-ink-700/70 dark:text-sand-100/70">{t("account.preferencesHint")}</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="block text-sm dark:text-sand-100">
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
          <label className="block text-sm dark:text-sand-100">
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
      </ExpandableSection>

      <ExpandableSection title={t("account.details")} defaultOpen>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-ink-700/60 dark:text-sand-100/60">{t("account.name")}</dt>
            <dd className="font-medium dark:text-sand-50">{user.fullName}</dd>
          </div>
          <div>
            <dt className="text-ink-700/60 dark:text-sand-100/60">{t("account.username")}</dt>
            <dd className="font-medium dark:text-sand-50">{user.username || "—"}</dd>
          </div>
          <div>
            <dt className="text-ink-700/60 dark:text-sand-100/60">{t("account.role")}</dt>
            <dd className="font-medium dark:text-sand-50">{roleLabel}</dd>
          </div>
          <div>
            <dt className="text-ink-700/60 dark:text-sand-100/60">{t("account.branch")}</dt>
            <dd className="font-medium dark:text-sand-50">{user.opsBranchName || "—"}</dd>
          </div>
          <div>
            <dt className="text-ink-700/60 dark:text-sand-100/60">{t("account.mobile")}</dt>
            <dd className="font-medium dark:text-sand-50">{user.mobile || "—"}</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-ink-700/50 dark:text-sand-100/50">{t("account.immutableHint")}</p>
      </ExpandableSection>

      {managedId ? (
        <ExpandableSection title={t("account.updateTitle")} defaultOpen={false}>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2 dark:text-sand-100">
              <ImagePickerField
                label={t("account.photo")}
                hint={t("account.photoHint")}
                value={photo}
                onChange={setPhoto}
                roundPreview
                compressOptions={{ maxEdge: 320, quality: 0.7 }}
              />
            </div>
            <label className="block text-sm md:col-span-2 dark:text-sand-100">
              {t("account.mobileRequired")}
              <input
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                placeholder="05xxxxxxxx"
                className={inputClass}
              />
            </label>
            <label className="block text-sm dark:text-sand-100">
              {t("account.currentPassword")}
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="block text-sm dark:text-sand-100">
              {t("account.newPassword")}
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="block text-sm md:col-span-2 dark:text-sand-100">
              {t("account.confirmPassword")}
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={inputClass}
              />
            </label>
          </div>
          <p className="mt-2 text-xs text-ink-700/50 dark:text-sand-100/50">{t("account.passwordHint")}</p>
          <button
            type="button"
            className="mt-5 rounded-full bg-ink-900 px-5 py-2.5 text-sm text-white dark:bg-aroma-600"
            onClick={() => {
              void (async () => {
                setError(null);
                setMessage(null);
                if (newPassword && newPassword !== confirmPassword) {
                  setError(t("account.passwordMismatch"));
                  return;
                }
                const result = await updateManagedUserSelf(managedId, {
                  mobile,
                  currentPassword: newPassword ? currentPassword : undefined,
                  newPassword: newPassword || undefined,
                  photoDataUrl: photo?.dataUrl ?? null,
                  photoName: photo?.name ?? null,
                });
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                const nextSession = managedUserToProfile(result.user);
                writeSession(nextSession);
                setUser(nextSession);
                setPhoto(
                  result.user.photoDataUrl
                    ? {
                        name: result.user.photoName || "photo.jpg",
                        dataUrl: result.user.photoDataUrl,
                      }
                    : null,
                );
                setCurrentPassword("");
                setNewPassword("");
                setConfirmPassword("");
                setMessage(t("account.saved"));
              })();
            }}
          >
            {t("common.save")}
          </button>
        </ExpandableSection>
      ) : (
        <p className="rounded-2xl border border-dashed border-ink-900/15 bg-white px-4 py-6 text-sm text-ink-700/60 dark:border-white/15 dark:bg-ink-900 dark:text-sand-100/70">
          {t("account.notEditable")}
        </p>
      )}

      {showSystem ? (
        <ExpandableSection title={t("settings.system")} defaultOpen={false}>
          <p className="text-sm text-ink-700/70 dark:text-sand-100/70">{t("settings.systemHint")}</p>
          <div className="mt-4 grid gap-3">
            <Link
              href="/admin/catalog"
              className="rounded-xl border border-ink-900/10 px-4 py-3 hover:border-aroma-400 dark:border-white/10 dark:hover:border-aroma-400"
            >
              <p className="font-medium dark:text-sand-50">{t("settings.catalog")}</p>
              <p className="mt-1 text-sm text-ink-700/70 dark:text-sand-100/70">{t("settings.catalogHint")}</p>
            </Link>
            <Link
              href="/admin/users"
              className="rounded-xl border border-ink-900/10 px-4 py-3 hover:border-aroma-400 dark:border-white/10 dark:hover:border-aroma-400"
            >
              <p className="font-medium dark:text-sand-50">{t("settings.users")}</p>
              <p className="mt-1 text-sm text-ink-700/70 dark:text-sand-100/70">{t("settings.usersHint")}</p>
            </Link>
            <Link
              href="/admin/branches"
              className="rounded-xl border border-ink-900/10 px-4 py-3 hover:border-aroma-400 dark:border-white/10 dark:hover:border-aroma-400"
            >
              <p className="font-medium dark:text-sand-50">{t("settings.branches")}</p>
              <p className="mt-1 text-sm text-ink-700/70 dark:text-sand-100/70">{t("settings.branchesHint")}</p>
            </Link>
          </div>
          <p className="mt-4 text-xs text-ink-700/50 dark:text-sand-100/50">
            {t("settings.signedInAs")
              .replace("{email}", user.email)
              .replace("{role}", ROLE_LABELS[user.role])}
          </p>
        </ExpandableSection>
      ) : null}
    </div>
  );
}
