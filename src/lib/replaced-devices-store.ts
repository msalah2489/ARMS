/**
 * Replaced-devices inventory (localStorage + optional app_replaced_devices sync).
 * Mirrors spare-inventory localStorage patterns for UI consistency.
 */
import { isDemoMode } from "@/lib/auth";
import { pushAppReplacedDevices } from "@/lib/supabase/app-sync";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { Profile, ReplacedDeviceStockItem } from "@/types/domain";

const STORAGE_KEY = "arms_replaced_devices_v1";
export const REPLACED_DEVICES_CHANGED_EVENT = "arms-replaced-devices-changed";

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
  window.dispatchEvent(new CustomEvent(REPLACED_DEVICES_CHANGED_EVENT));
}

function schedulePersist(items: ReplacedDeviceStockItem[]) {
  if (!isSupabaseConfigured() || isDemoMode()) return;
  void pushAppReplacedDevices(items);
}

function normalizeItem(raw: Partial<ReplacedDeviceStockItem>): ReplacedDeviceStockItem | null {
  if (!raw?.id || !raw.deviceTypeName) return null;
  const quantity = Number(raw.quantity ?? 0);
  if (!Number.isFinite(quantity) || quantity < 0) return null;
  return {
    id: String(raw.id),
    deviceTypeName: String(raw.deviceTypeName).trim(),
    modelName: raw.modelName?.trim() || undefined,
    serialOrCode: raw.serialOrCode?.trim() || undefined,
    quantity: Math.floor(quantity),
    notes: raw.notes?.trim() || undefined,
    updatedAt: String(raw.updatedAt ?? new Date().toISOString()),
    createdAt: String(raw.createdAt ?? new Date().toISOString()),
    createdById: raw.createdById,
    createdByName: raw.createdByName,
  };
}

export function listReplacedDevices(): ReplacedDeviceStockItem[] {
  return readJson<Partial<ReplacedDeviceStockItem>[]>(STORAGE_KEY, [])
    .map(normalizeItem)
    .filter((item): item is ReplacedDeviceStockItem => item != null)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** Available stock rows (quantity > 0) for manager replacement picker. */
export function listAvailableReplacedDevices(): ReplacedDeviceStockItem[] {
  return listReplacedDevices().filter((item) => item.quantity > 0);
}

export function replaceReplacedDevices(items: ReplacedDeviceStockItem[]) {
  writeJson(STORAGE_KEY, items);
  notifyChanged();
}

export function applyRemoteReplacedDevices(items: ReplacedDeviceStockItem[]) {
  if (typeof window === "undefined") return;
  replaceReplacedDevices(
    (items ?? [])
      .map((row) => normalizeItem(row))
      .filter((item): item is ReplacedDeviceStockItem => item != null),
  );
}

/** Total quantity across all stock rows (manager dashboard card). */
export function totalReplacedDevicesQuantity(): number {
  return listReplacedDevices().reduce((sum, item) => sum + item.quantity, 0);
}

export function addReplacedDevice(input: {
  user: Profile;
  deviceTypeName: string;
  modelName?: string;
  serialOrCode?: string;
  quantity: number;
  notes?: string;
}): { ok: true; item: ReplacedDeviceStockItem } | { ok: false; error: string } {
  const deviceTypeName = input.deviceTypeName.trim();
  if (!deviceTypeName) return { ok: false, error: "نوع الجهاز إلزامي." };
  const quantity = Number(input.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isInteger(quantity)) {
    return { ok: false, error: "الكمية يجب أن تكون رقمًا صحيحًا أكبر من صفر." };
  }
  const now = new Date().toISOString();
  const item: ReplacedDeviceStockItem = {
    id: crypto.randomUUID(),
    deviceTypeName,
    modelName: input.modelName?.trim() || undefined,
    serialOrCode: input.serialOrCode?.trim() || undefined,
    quantity,
    notes: input.notes?.trim() || undefined,
    updatedAt: now,
    createdAt: now,
    createdById: input.user.id,
    createdByName: input.user.fullName,
  };
  const next = [item, ...listReplacedDevices()];
  writeJson(STORAGE_KEY, next);
  notifyChanged();
  schedulePersist(next);
  return { ok: true, item };
}

export function adjustReplacedDeviceQuantity(input: {
  id: string;
  delta: number;
}): { ok: true; item: ReplacedDeviceStockItem } | { ok: false; error: string } {
  const all = listReplacedDevices();
  const existing = all.find((row) => row.id === input.id);
  if (!existing) return { ok: false, error: "العنصر غير موجود." };
  const delta = Number(input.delta);
  if (!Number.isFinite(delta) || !Number.isInteger(delta) || delta === 0) {
    return { ok: false, error: "التعديل يجب أن يكون رقمًا صحيحًا غير صفر." };
  }
  const nextQty = existing.quantity + delta;
  if (nextQty < 0) {
    return { ok: false, error: `الكمية غير كافية (المتاح: ${existing.quantity}).` };
  }
  const item: ReplacedDeviceStockItem = {
    ...existing,
    quantity: nextQty,
    updatedAt: new Date().toISOString(),
  };
  const next = all.map((row) => (row.id === input.id ? item : row));
  writeJson(STORAGE_KEY, next);
  notifyChanged();
  schedulePersist(next);
  return { ok: true, item };
}

export function removeReplacedDevice(id: string): { ok: true } | { ok: false; error: string } {
  const all = listReplacedDevices();
  if (!all.some((row) => row.id === id)) return { ok: false, error: "العنصر غير موجود." };
  const next = all.filter((row) => row.id !== id);
  writeJson(STORAGE_KEY, next);
  notifyChanged();
  schedulePersist(next);
  return { ok: true };
}
