import { isDemoMode, isSystemAdminRole, normalizeRole } from "@/lib/auth";
import {
  pushAppNotificationReads,
  pushAppNotifications,
} from "@/lib/supabase/app-sync";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type {
  AppRole,
  ArmsNotification,
  ArmsNotificationRead,
  NotificationAudienceType,
  Profile,
} from "@/types/domain";

const NOTIFICATIONS_KEY = "arms_notifications_v1";
const READS_KEY = "arms_notification_reads_v1";
export const NOTIFICATIONS_CHANGED_EVENT = "arms-notifications-changed";

let notificationsCache: ArmsNotification[] | null = null;
let readsCache: ArmsNotificationRead[] | null = null;

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function notifyChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(NOTIFICATIONS_CHANGED_EVENT));
}

export function subscribeNotificationsChanged(handler: () => void) {
  if (typeof window === "undefined") return () => {};
  const onChanged = () => handler();
  window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, onChanged);
  window.addEventListener("arms-ops-hydrated", onChanged);
  return () => {
    window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, onChanged);
    window.removeEventListener("arms-ops-hydrated", onChanged);
  };
}

function listNotificationsLocal(): ArmsNotification[] {
  if (notificationsCache) return notificationsCache;
  notificationsCache = readJson<ArmsNotification[]>(NOTIFICATIONS_KEY, []);
  return notificationsCache;
}

function listReadsLocal(): ArmsNotificationRead[] {
  if (readsCache) return readsCache;
  readsCache = readJson<ArmsNotificationRead[]>(READS_KEY, []);
  return readsCache;
}

function saveNotifications(rows: ArmsNotification[]) {
  notificationsCache = rows;
  writeJson(NOTIFICATIONS_KEY, rows);
  notifyChanged();
}

function saveReads(rows: ArmsNotificationRead[]) {
  readsCache = rows;
  writeJson(READS_KEY, rows);
  notifyChanged();
}

export function replaceNotifications(rows: ArmsNotification[]) {
  if (typeof window === "undefined") return;
  saveNotifications(rows);
}

export function replaceNotificationReads(rows: ArmsNotificationRead[]) {
  if (typeof window === "undefined") return;
  saveReads(rows);
}

export function applyRemoteNotifications(rows: ArmsNotification[]) {
  const local = listNotificationsLocal();
  const byId = new Map(local.map((row) => [row.id, row]));
  for (const row of rows) byId.set(row.id, row);
  const merged = [...byId.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  saveNotifications(merged);
}

export function applyRemoteNotificationReads(rows: ArmsNotificationRead[]) {
  const local = listReadsLocal();
  const byId = new Map(local.map((row) => [row.id, row]));
  for (const row of rows) byId.set(row.id, row);
  saveReads([...byId.values()]);
}

function readKey(notificationId: string, userId: string) {
  return `${notificationId}::${userId}`;
}

export function notificationVisibleToUser(
  notification: ArmsNotification,
  user: Profile,
): boolean {
  if (notification.audienceType === "all") return true;
  if (notification.audienceType === "role") {
    if (!notification.audienceRole) return false;
    return normalizeRole(user.role) === normalizeRole(notification.audienceRole);
  }
  if (notification.audienceType === "user") {
    return Boolean(notification.audienceUserId && notification.audienceUserId === user.id);
  }
  return false;
}

export function listNotificationsForUser(user: Profile): ArmsNotification[] {
  return listNotificationsLocal()
    .filter((row) => notificationVisibleToUser(row, user))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function isNotificationRead(notificationId: string, userId: string): boolean {
  const key = readKey(notificationId, userId);
  return listReadsLocal().some((row) => row.id === key);
}

export function countUnreadNotifications(user: Profile): number {
  return listNotificationsForUser(user).filter(
    (row) => !isNotificationRead(row.id, user.id),
  ).length;
}

export function listUnreadNotifications(user: Profile): ArmsNotification[] {
  return listNotificationsForUser(user).filter(
    (row) => !isNotificationRead(row.id, user.id),
  );
}

export function markNotificationRead(notificationId: string, user: Profile) {
  if (isNotificationRead(notificationId, user.id)) return;
  const row: ArmsNotificationRead = {
    id: readKey(notificationId, user.id),
    notificationId,
    userId: user.id,
    readAt: new Date().toISOString(),
  };
  const next = [row, ...listReadsLocal()];
  saveReads(next);
  if (isSupabaseConfigured() && !isDemoMode()) {
    void pushAppNotificationReads([row]);
  }
}

export function markAllNotificationsRead(user: Profile) {
  const unread = listUnreadNotifications(user);
  if (!unread.length) return;
  const now = new Date().toISOString();
  const extras: ArmsNotificationRead[] = unread.map((item) => ({
    id: readKey(item.id, user.id),
    notificationId: item.id,
    userId: user.id,
    readAt: now,
  }));
  const byId = new Map(listReadsLocal().map((row) => [row.id, row]));
  for (const row of extras) byId.set(row.id, row);
  saveReads([...byId.values()]);
  if (isSupabaseConfigured() && !isDemoMode()) {
    void pushAppNotificationReads(extras);
  }
}

function persistNewNotification(notification: ArmsNotification) {
  saveNotifications([notification, ...listNotificationsLocal()]);
  if (isSupabaseConfigured() && !isDemoMode()) {
    void pushAppNotifications([notification]);
  }
}

/**
 * Automated system alert (no admin sender required).
 * Used for low-stock and similar operational notices.
 */
export function createSystemNotification(input: {
  title: string;
  body: string;
  audienceType: NotificationAudienceType;
  audienceRole?: AppRole | null;
  audienceUserId?: string | null;
}): ArmsNotification {
  const notification: ArmsNotification = {
    id: crypto.randomUUID(),
    title: input.title.trim(),
    body: input.body.trim(),
    audienceType: input.audienceType,
    audienceRole: input.audienceType === "role" ? (input.audienceRole ?? null) : null,
    audienceUserId:
      input.audienceType === "user"
        ? String(input.audienceUserId ?? "").trim() || null
        : null,
    createdBy: "system",
    createdByName: "النظام",
    createdAt: new Date().toISOString(),
  };
  persistNewNotification(notification);
  return notification;
}

export function sendNotification(input: {
  title: string;
  body: string;
  audienceType: NotificationAudienceType;
  audienceRole?: AppRole | null;
  audienceUserId?: string | null;
  sender: Profile;
}): { ok: true; notification: ArmsNotification } | { ok: false; error: string } {
  if (!isSystemAdminRole(input.sender.role)) {
    return { ok: false, error: "إرسال الرسائل متاح لمدير النظام فقط." };
  }
  const title = input.title.trim();
  const body = input.body.trim();
  if (!title) return { ok: false, error: "عنوان الرسالة مطلوب." };
  if (!body) return { ok: false, error: "نص الرسالة مطلوب." };
  if (input.audienceType === "role" && !input.audienceRole) {
    return { ok: false, error: "اختر الدور المستهدف." };
  }
  if (input.audienceType === "user" && !String(input.audienceUserId ?? "").trim()) {
    return { ok: false, error: "اختر الحساب المستهدف." };
  }

  const notification: ArmsNotification = {
    id: crypto.randomUUID(),
    title,
    body,
    audienceType: input.audienceType,
    audienceRole: input.audienceType === "role" ? input.audienceRole : null,
    audienceUserId: input.audienceType === "user" ? String(input.audienceUserId).trim() : null,
    createdBy: input.sender.id,
    createdByName: input.sender.fullName,
    createdAt: new Date().toISOString(),
  };

  persistNewNotification(notification);
  return { ok: true, notification };
}

export function listAllNotificationsAdmin(): ArmsNotification[] {
  return [...listNotificationsLocal()].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}

export function listNotificationsLocalRaw(): ArmsNotification[] {
  return listNotificationsLocal();
}

export function listNotificationReadsLocalRaw(): ArmsNotificationRead[] {
  return listReadsLocal();
}
