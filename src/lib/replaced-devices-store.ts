/**
 * Replaced-devices inventory (localStorage).
 * No dedicated Supabase table yet — keep local-only until a migration exists.
 * Mirrors spare-inventory localStorage patterns for UI consistency.
 */
import type { Profile, ReplacedDeviceStockItem } from "@/types/domain";

const STORAGE_KEY = "arms_replaced_devices_v1";

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

export function replaceReplacedDevices(items: ReplacedDeviceStockItem[]) {
  writeJson(STORAGE_KEY, items);
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
  writeJson(STORAGE_KEY, [item, ...listReplacedDevices()]);
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
  writeJson(
    STORAGE_KEY,
    all.map((row) => (row.id === input.id ? item : row)),
  );
  return { ok: true, item };
}

export function removeReplacedDevice(id: string): { ok: true } | { ok: false; error: string } {
  const all = listReplacedDevices();
  if (!all.some((row) => row.id === id)) return { ok: false, error: "العنصر غير موجود." };
  writeJson(
    STORAGE_KEY,
    all.filter((row) => row.id !== id),
  );
  return { ok: true };
}
