import { getModelById, getModels, getSparePartsForModel } from "@/lib/catalog-store";
import { isDemoMode } from "@/lib/auth";
import { pushClientStore } from "@/lib/supabase/client-store";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type {
  Profile,
  SpareInventoryBalance,
  SpareReceiveLine,
  SpareReceiveReceipt,
  SpareStockMovement,
} from "@/types/domain";

const BALANCE_KEY = "arms_spare_inventory_v1";
const RECEIPTS_KEY = "arms_spare_receipts_v1";
const MOVEMENTS_KEY = "arms_spare_movements_v1";

export type SpareInventoryState = {
  balances: SpareInventoryBalance[];
  receipts: SpareReceiveReceipt[];
  movements: SpareStockMovement[];
};

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

function schedulePersist() {
  if (!isSupabaseConfigured() || isDemoMode()) return;
  void pushClientStore("spare_inventory", getSpareInventoryLocal());
}

export function getSpareInventoryLocal(): SpareInventoryState {
  return {
    balances: readJson<SpareInventoryBalance[]>(BALANCE_KEY, []),
    receipts: readJson<SpareReceiveReceipt[]>(RECEIPTS_KEY, []).map(normalizeReceipt),
    movements: readJson<SpareStockMovement[]>(MOVEMENTS_KEY, []),
  };
}

export function replaceSpareInventory(state: SpareInventoryState) {
  if (typeof window === "undefined") return;
  writeJson(BALANCE_KEY, state.balances ?? []);
  writeJson(RECEIPTS_KEY, state.receipts ?? []);
  writeJson(MOVEMENTS_KEY, state.movements ?? []);
}

export function applyRemoteSpareInventory(state: SpareInventoryState) {
  replaceSpareInventory({
    balances: state.balances ?? [],
    receipts: (state.receipts ?? []).map(normalizeReceipt),
    movements: state.movements ?? [],
  });
}

export function balanceIdFor(modelId: string, partId: string) {
  return `${modelId}::${partId}`;
}

export function listInventoryBalances(): SpareInventoryBalance[] {
  return readJson<SpareInventoryBalance[]>(BALANCE_KEY, []).sort((a, b) =>
    a.modelName.localeCompare(b.modelName, "ar"),
  );
}

function normalizeReceipt(receipt: SpareReceiveReceipt): SpareReceiveReceipt {
  if (receipt.lines?.length) return receipt;
  if (receipt.modelId && receipt.partId && receipt.quantity) {
    return {
      ...receipt,
      lines: [
        {
          modelId: receipt.modelId,
          modelName: receipt.modelName ?? "",
          partId: receipt.partId,
          partName: receipt.partName ?? "",
          color: receipt.color,
          quantity: receipt.quantity,
        },
      ],
    };
  }
  return { ...receipt, lines: receipt.lines ?? [] };
}

export function listReceiveReceipts(): SpareReceiveReceipt[] {
  return readJson<SpareReceiveReceipt[]>(RECEIPTS_KEY, [])
    .map(normalizeReceipt)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
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
  schedulePersist();
  return { ok: true, balance };
}

function addMovement(movement: SpareStockMovement) {
  writeJson(MOVEMENTS_KEY, [movement, ...listStockMovements()].slice(0, 1000));
  schedulePersist();
}

export function receiveSpareParts(input: {
  user: Profile;
  receiptNumber: string;
  receiptDate: string;
  supplier: string;
  receiptPhotoName: string;
  receiptPhotoDataUrl: string;
  lines: Array<{ modelId: string; partId: string; quantity: number }>;
}): { ok: true; receipt: SpareReceiveReceipt } | { ok: false; error: string } {
  const receiptNumber = input.receiptNumber.trim();
  const receiptDate = input.receiptDate.trim();
  const supplier = input.supplier.trim();
  const receiptPhotoName = input.receiptPhotoName.trim();
  const receiptPhotoDataUrl = input.receiptPhotoDataUrl.trim();

  if (!receiptNumber) return { ok: false, error: "رقم سند الاستلام إلزامي." };
  if (!receiptDate) return { ok: false, error: "تاريخ سند الاستلام إلزامي." };
  if (!supplier) return { ok: false, error: "جهة التوريد إلزامية." };
  if (!receiptPhotoName || !receiptPhotoDataUrl) {
    return { ok: false, error: "رفع صورة سند الاستلام إلزامي." };
  }
  if (!input.lines.length) {
    return { ok: false, error: "أضف قطعة غيار واحدة على الأقل للسند." };
  }

  const duplicate = listReceiveReceipts().some(
    (item) => item.receiptNumber.toLowerCase() === receiptNumber.toLowerCase(),
  );
  if (duplicate) return { ok: false, error: "رقم سند الاستلام مستخدم مسبقًا." };

  const resolvedLines: SpareReceiveLine[] = [];
  const seen = new Set<string>();

  for (let index = 0; index < input.lines.length; index += 1) {
    const row = input.lines[index];
    const rowNo = index + 1;
    if (!row.modelId) return { ok: false, error: `اختر الموديل في الصف ${rowNo}.` };
    if (!row.partId) return { ok: false, error: `اختر قطعة الغيار في الصف ${rowNo}.` };

    const quantity = Number(row.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isInteger(quantity)) {
      return { ok: false, error: `الكمية في الصف ${rowNo} يجب أن تكون رقمًا صحيحًا أكبر من صفر.` };
    }

    const model = getModelById(row.modelId);
    if (!model) return { ok: false, error: `الموديل غير موجود في الصف ${rowNo}.` };

    const part = getSparePartsForModel(row.modelId).find((item) => item.id === row.partId);
    if (!part) {
      return { ok: false, error: `قطعة الغيار غير مسجلة لهذا الموديل في الصف ${rowNo}.` };
    }

    const key = balanceIdFor(model.id, part.id);
    if (seen.has(key)) {
      return {
        ok: false,
        error: `تم تكرار «${part.name}» لنفس الموديل في أكثر من صف. اجمع الكميات في صف واحد.`,
      };
    }
    seen.add(key);

    resolvedLines.push({
      modelId: model.id,
      modelName: model.name,
      partId: part.id,
      partName: part.name,
      color: part.color,
      quantity,
    });
  }

  const now = new Date().toISOString();
  for (const line of resolvedLines) {
    const balanceResult = upsertBalance({
      modelId: line.modelId,
      modelName: line.modelName,
      partId: line.partId,
      partName: line.partName,
      color: line.color,
      delta: line.quantity,
    });
    if (!balanceResult.ok) return balanceResult;

    addMovement({
      id: crypto.randomUUID(),
      type: "receive",
      balanceId: balanceResult.balance.id,
      modelId: line.modelId,
      modelName: line.modelName,
      partId: line.partId,
      partName: line.partName,
      color: line.color,
      quantity: line.quantity,
      reference: receiptNumber,
      actorId: input.user.id,
      actorName: input.user.fullName,
      createdAt: now,
    });
  }

  const receipt: SpareReceiveReceipt = {
    id: crypto.randomUUID(),
    receiptNumber,
    receiptDate,
    supplier,
    receiptPhotoName,
    receiptPhotoDataUrl,
    lines: resolvedLines,
    receivedById: input.user.id,
    receivedByName: input.user.fullName,
    createdAt: now,
  };

  writeJson(RECEIPTS_KEY, [receipt, ...listReceiveReceipts()]);
  schedulePersist();
  return { ok: true, receipt };
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

export function receiptTotalQty(receipt: SpareReceiveReceipt) {
  return (receipt.lines ?? []).reduce((sum, line) => sum + line.quantity, 0);
}
