import { getModelById, getModels, getSparePartsForModel } from "@/lib/catalog-store";
import type {
  Profile,
  SpareInventoryBalance,
  SpareReceiveReceipt,
  SpareStockMovement,
} from "@/types/domain";

const BALANCE_KEY = "arms_spare_inventory_v1";
const RECEIPTS_KEY = "arms_spare_receipts_v1";
const MOVEMENTS_KEY = "arms_spare_movements_v1";

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
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function balanceIdFor(modelId: string, partId: string) {
  return `${modelId}::${partId}`;
}

export function listInventoryBalances(): SpareInventoryBalance[] {
  return readJson<SpareInventoryBalance[]>(BALANCE_KEY, []).sort((a, b) =>
    a.modelName.localeCompare(b.modelName, "ar"),
  );
}

export function listReceiveReceipts(): SpareReceiveReceipt[] {
  return readJson<SpareReceiveReceipt[]>(RECEIPTS_KEY, []).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}

export function listStockMovements(): SpareStockMovement[] {
  return readJson<SpareStockMovement[]>(MOVEMENTS_KEY, []).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}

export function getBalance(modelId: string, partId: string) {
  const id = balanceIdFor(modelId, partId);
  return listInventoryBalances().find((item) => item.id === id) ?? null;
}

export function getAvailableQty(modelId: string, partId: string) {
  return getBalance(modelId, partId)?.quantity ?? 0;
}

function upsertBalance(input: {
  modelId: string;
  modelName: string;
  partId: string;
  partName: string;
  color?: string;
  delta: number;
}): { ok: true; balance: SpareInventoryBalance } | { ok: false; error: string } {
  const all = listInventoryBalances();
  const id = balanceIdFor(input.modelId, input.partId);
  const existing = all.find((item) => item.id === id);
  const nextQty = (existing?.quantity ?? 0) + input.delta;
  if (nextQty < 0) {
    return {
      ok: false,
      error: `المخزون غير كافٍ لـ «${input.partName}» (المتاح: ${existing?.quantity ?? 0}).`,
    };
  }

  const balance: SpareInventoryBalance = {
    id,
    modelId: input.modelId,
    modelName: input.modelName,
    partId: input.partId,
    partName: input.partName,
    color: input.color || existing?.color,
    quantity: nextQty,
    updatedAt: new Date().toISOString(),
  };

  writeJson(
    BALANCE_KEY,
    existing ? all.map((item) => (item.id === id ? balance : item)) : [balance, ...all],
  );
  return { ok: true, balance };
}

function addMovement(movement: SpareStockMovement) {
  writeJson(MOVEMENTS_KEY, [movement, ...listStockMovements()].slice(0, 1000));
}

export function receiveSpareParts(input: {
  user: Profile;
  modelId: string;
  partId: string;
  quantity: number;
  receiptNumber: string;
  receiptDate: string;
  supplier: string;
  receiptPhotoName: string;
  receiptPhotoDataUrl: string;
}): { ok: true; receipt: SpareReceiveReceipt; balance: SpareInventoryBalance } | { ok: false; error: string } {
  const model = getModelById(input.modelId);
  if (!model) return { ok: false, error: "الموديل غير موجود." };

  const part = getSparePartsForModel(input.modelId).find((item) => item.id === input.partId);
  if (!part) return { ok: false, error: "قطعة الغيار غير مسجلة لهذا الموديل." };

  const receiptNumber = input.receiptNumber.trim();
  const receiptDate = input.receiptDate.trim();
  const supplier = input.supplier.trim();
  const receiptPhotoName = input.receiptPhotoName.trim();
  const receiptPhotoDataUrl = input.receiptPhotoDataUrl.trim();
  const quantity = Number(input.quantity);

  if (!receiptNumber) return { ok: false, error: "رقم سند الاستلام إلزامي." };
  if (!receiptDate) return { ok: false, error: "تاريخ سند الاستلام إلزامي." };
  if (!supplier) return { ok: false, error: "جهة التوريد إلزامية." };
  if (!receiptPhotoName || !receiptPhotoDataUrl) {
    return { ok: false, error: "رفع صورة سند الاستلام إلزامي." };
  }
  if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isInteger(quantity)) {
    return { ok: false, error: "الكمية يجب أن تكون رقمًا صحيحًا أكبر من صفر." };
  }

  const duplicate = listReceiveReceipts().some(
    (item) => item.receiptNumber.toLowerCase() === receiptNumber.toLowerCase(),
  );
  if (duplicate) return { ok: false, error: "رقم سند الاستلام مستخدم مسبقًا." };

  const balanceResult = upsertBalance({
    modelId: model.id,
    modelName: model.name,
    partId: part.id,
    partName: part.name,
    color: part.color,
    delta: quantity,
  });
  if (!balanceResult.ok) return balanceResult;

  const now = new Date().toISOString();
  const receipt: SpareReceiveReceipt = {
    id: crypto.randomUUID(),
    receiptNumber,
    receiptDate,
    supplier,
    receiptPhotoName,
    receiptPhotoDataUrl,
    modelId: model.id,
    modelName: model.name,
    partId: part.id,
    partName: part.name,
    color: part.color,
    quantity,
    receivedById: input.user.id,
    receivedByName: input.user.fullName,
    createdAt: now,
  };

  writeJson(RECEIPTS_KEY, [receipt, ...listReceiveReceipts()]);
  addMovement({
    id: crypto.randomUUID(),
    type: "receive",
    balanceId: balanceResult.balance.id,
    modelId: model.id,
    modelName: model.name,
    partId: part.id,
    partName: part.name,
    color: part.color,
    quantity,
    reference: receiptNumber,
    actorId: input.user.id,
    actorName: input.user.fullName,
    createdAt: now,
  });

  return { ok: true, receipt, balance: balanceResult.balance };
}

/** Deduct parts used during technician maintenance. */
export function consumeSpareParts(input: {
  user: Profile;
  modelId: string;
  modelName?: string;
  parts: Array<{ partId: string; partName: string; qty: number; color?: string }>;
  reference?: string;
}): { ok: true } | { ok: false; error: string } {
  const model = getModelById(input.modelId);
  const modelName = model?.name ?? input.modelName ?? "موديل";

  for (const part of input.parts) {
    if (part.qty <= 0) continue;
    const available = getAvailableQty(input.modelId, part.partId);
    if (available < part.qty) {
      return {
        ok: false,
        error: `المخزون غير كافٍ لـ «${part.partName}» (مطلوب ${part.qty} · متاح ${available}). راجع استلام قطع الغيار.`,
      };
    }
  }

  const now = new Date().toISOString();
  for (const part of input.parts) {
    if (part.qty <= 0) continue;
    const result = upsertBalance({
      modelId: input.modelId,
      modelName,
      partId: part.partId,
      partName: part.partName,
      color: part.color,
      delta: -part.qty,
    });
    if (!result.ok) return result;

    addMovement({
      id: crypto.randomUUID(),
      type: "consume",
      balanceId: result.balance.id,
      modelId: input.modelId,
      modelName,
      partId: part.partId,
      partName: part.partName,
      color: part.color,
      quantity: part.qty,
      reference: input.reference,
      actorId: input.user.id,
      actorName: input.user.fullName,
      createdAt: now,
    });
  }

  return { ok: true };
}

export function listModelsWithSpareParts() {
  return getModels()
    .filter((model) => model.spareParts.length > 0)
    .map((model) => ({
      id: model.id,
      name: model.name,
      sparePartsCount: model.spareParts.length,
    }));
}

export function partLabel(part: { name?: string; partName?: string; color?: string }) {
  const name = part.name ?? part.partName ?? "";
  return part.color ? `${name} · ${part.color}` : name;
}
