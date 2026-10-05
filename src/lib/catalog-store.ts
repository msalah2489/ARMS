import {
  BRANDS_SEED,
  DEVICE_TYPES_SEED,
  MODELS_SEED,
} from "@/lib/branch-catalog";
import type { CatalogItem, ModelItem, SparePartItem } from "@/types/domain";

const CATALOG_KEY = "arms_device_catalog_v1";

export type DeviceCatalogState = {
  deviceTypes: CatalogItem[];
  brands: CatalogItem[];
  models: ModelItem[];
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

function normalizeSparePart(part: SparePartItem): SparePartItem {
  const color = part.color?.trim();
  return {
    id: part.id,
    name: part.name,
    ...(color ? { color } : {}),
  };
}

function normalizeModel(model: ModelItem): ModelItem {
  return {
    ...model,
    accessories: model.accessories ?? [],
    spareParts: (model.spareParts ?? []).map(normalizeSparePart),
  };
}

function seedCatalog(): DeviceCatalogState {
  return {
    deviceTypes: DEVICE_TYPES_SEED.map((item) => ({ ...item })),
    brands: BRANDS_SEED.map((item) => ({ ...item })),
    models: MODELS_SEED.map((model) => normalizeModel({ ...model })),
  };
}

export function getCatalog(): DeviceCatalogState {
  const fallback = seedCatalog();
  if (typeof window === "undefined") return fallback;
  const stored = readJson<DeviceCatalogState | null>(CATALOG_KEY, null);
  if (!stored) {
    writeJson(CATALOG_KEY, fallback);
    return fallback;
  }
  return {
    deviceTypes: stored.deviceTypes?.length ? stored.deviceTypes : fallback.deviceTypes,
    brands: stored.brands?.length ? stored.brands : fallback.brands,
    models: (stored.models?.length ? stored.models : fallback.models).map(normalizeModel),
  };
}

function saveCatalog(next: DeviceCatalogState) {
  writeJson(CATALOG_KEY, next);
  return next;
}

export function getDeviceTypes() {
  return getCatalog().deviceTypes;
}

export function getBrands() {
  return getCatalog().brands;
}

export function getModels() {
  return getCatalog().models;
}

export function getModelById(modelId: string) {
  return getModels().find((model) => model.id === modelId) ?? null;
}

export function getSparePartsForModel(modelId: string) {
  return getModelById(modelId)?.spareParts ?? [];
}

export function addDeviceType(name: string): { ok: true } | { ok: false; error: string } {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "اسم التصنيف إلزامي." };
  const catalog = getCatalog();
  if (catalog.deviceTypes.some((item) => item.name === trimmed)) {
    return { ok: false, error: "هذا التصنيف موجود مسبقًا." };
  }
  catalog.deviceTypes.push({ id: crypto.randomUUID(), name: trimmed });
  saveCatalog(catalog);
  return { ok: true };
}

export function deleteDeviceType(id: string): { ok: true } | { ok: false; error: string } {
  const catalog = getCatalog();
  if (catalog.models.some((model) => model.deviceTypeId === id)) {
    return { ok: false, error: "لا يمكن حذف تصنيف مرتبط بموديلات." };
  }
  catalog.deviceTypes = catalog.deviceTypes.filter((item) => item.id !== id);
  saveCatalog(catalog);
  return { ok: true };
}

export function updateDeviceType(
  id: string,
  name: string,
): { ok: true } | { ok: false; error: string } {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "اسم التصنيف إلزامي." };
  const catalog = getCatalog();
  const item = catalog.deviceTypes.find((row) => row.id === id);
  if (!item) return { ok: false, error: "التصنيف غير موجود." };
  if (catalog.deviceTypes.some((row) => row.id !== id && row.name === trimmed)) {
    return { ok: false, error: "هذا التصنيف موجود مسبقًا." };
  }
  item.name = trimmed;
  saveCatalog(catalog);
  return { ok: true };
}

export function addBrand(name: string): { ok: true } | { ok: false; error: string } {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "اسم البراند إلزامي." };
  const catalog = getCatalog();
  if (catalog.brands.some((item) => item.name === trimmed)) {
    return { ok: false, error: "هذا البراند موجود مسبقًا." };
  }
  catalog.brands.push({ id: crypto.randomUUID(), name: trimmed });
  saveCatalog(catalog);
  return { ok: true };
}

export function deleteBrand(id: string): { ok: true } | { ok: false; error: string } {
  const catalog = getCatalog();
  if (catalog.models.some((model) => model.brandId === id)) {
    return { ok: false, error: "لا يمكن حذف براند مرتبط بموديلات." };
  }
  catalog.brands = catalog.brands.filter((item) => item.id !== id);
  saveCatalog(catalog);
  return { ok: true };
}

export function updateBrand(
  id: string,
  name: string,
): { ok: true } | { ok: false; error: string } {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "اسم البراند إلزامي." };
  const catalog = getCatalog();
  const item = catalog.brands.find((row) => row.id === id);
  if (!item) return { ok: false, error: "البراند غير موجود." };
  if (catalog.brands.some((row) => row.id !== id && row.name === trimmed)) {
    return { ok: false, error: "هذا البراند موجود مسبقًا." };
  }
  item.name = trimmed;
  saveCatalog(catalog);
  return { ok: true };
}

export function addModel(input: {
  name: string;
  deviceTypeId: string;
  brandId: string;
}): { ok: true } | { ok: false; error: string } {
  const name = input.name.trim();
  if (!name) return { ok: false, error: "اسم الموديل إلزامي." };
  if (!input.deviceTypeId || !input.brandId) {
    return { ok: false, error: "اختر التصنيف والبراند." };
  }
  const catalog = getCatalog();
  if (!catalog.deviceTypes.some((item) => item.id === input.deviceTypeId)) {
    return { ok: false, error: "التصنيف غير موجود." };
  }
  if (!catalog.brands.some((item) => item.id === input.brandId)) {
    return { ok: false, error: "البراند غير موجود." };
  }
  catalog.models.push({
    id: crypto.randomUUID(),
    name,
    deviceTypeId: input.deviceTypeId,
    brandId: input.brandId,
    accessories: [],
    spareParts: [],
  });
  saveCatalog(catalog);
  return { ok: true };
}

export function deleteModel(id: string): { ok: true } | { ok: false; error: string } {
  const catalog = getCatalog();
  catalog.models = catalog.models.filter((item) => item.id !== id);
  saveCatalog(catalog);
  return { ok: true };
}

export function updateModel(input: {
  id: string;
  name: string;
  deviceTypeId: string;
  brandId: string;
}): { ok: true } | { ok: false; error: string } {
  const name = input.name.trim();
  if (!name) return { ok: false, error: "اسم الموديل إلزامي." };
  if (!input.deviceTypeId || !input.brandId) {
    return { ok: false, error: "اختر التصنيف والبراند." };
  }
  const catalog = getCatalog();
  const model = catalog.models.find((item) => item.id === input.id);
  if (!model) return { ok: false, error: "الموديل غير موجود." };
  if (!catalog.deviceTypes.some((item) => item.id === input.deviceTypeId)) {
    return { ok: false, error: "التصنيف غير موجود." };
  }
  if (!catalog.brands.some((item) => item.id === input.brandId)) {
    return { ok: false, error: "البراند غير موجود." };
  }
  if (catalog.models.some((item) => item.id !== input.id && item.name === name)) {
    return { ok: false, error: "اسم الموديل مستخدم مسبقًا." };
  }
  model.name = name;
  model.deviceTypeId = input.deviceTypeId;
  model.brandId = input.brandId;
  saveCatalog(catalog);
  return { ok: true };
}

export function addModelAccessory(
  modelId: string,
  name: string,
): { ok: true } | { ok: false; error: string } {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "اسم الملحق إلزامي." };
  const catalog = getCatalog();
  const model = catalog.models.find((item) => item.id === modelId);
  if (!model) return { ok: false, error: "الموديل غير موجود." };
  if (model.accessories.some((item) => item.name === trimmed)) {
    return { ok: false, error: "الملحق موجود مسبقًا لهذا الموديل." };
  }
  model.accessories.push({ id: crypto.randomUUID(), name: trimmed });
  saveCatalog(catalog);
  return { ok: true };
}

export function updateModelAccessory(
  modelId: string,
  accessoryId: string,
  name: string,
): { ok: true } | { ok: false; error: string } {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "اسم الملحق إلزامي." };
  const catalog = getCatalog();
  const model = catalog.models.find((item) => item.id === modelId);
  if (!model) return { ok: false, error: "الموديل غير موجود." };
  const accessory = model.accessories.find((item) => item.id === accessoryId);
  if (!accessory) return { ok: false, error: "الملحق غير موجود." };
  if (model.accessories.some((item) => item.id !== accessoryId && item.name === trimmed)) {
    return { ok: false, error: "الملحق موجود مسبقًا لهذا الموديل." };
  }
  accessory.name = trimmed;
  saveCatalog(catalog);
  return { ok: true };
}

export function deleteModelAccessory(
  modelId: string,
  accessoryId: string,
): { ok: true } | { ok: false; error: string } {
  const catalog = getCatalog();
  const model = catalog.models.find((item) => item.id === modelId);
  if (!model) return { ok: false, error: "الموديل غير موجود." };
  model.accessories = model.accessories.filter((item) => item.id !== accessoryId);
  saveCatalog(catalog);
  return { ok: true };
}

export function addModelSparePart(
  modelId: string,
  name: string,
  color?: string,
): { ok: true } | { ok: false; error: string } {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "اسم قطعة الغيار إلزامي." };
  const colorTrimmed = color?.trim() || undefined;
  const catalog = getCatalog();
  const model = catalog.models.find((item) => item.id === modelId);
  if (!model) return { ok: false, error: "الموديل غير موجود." };
  if (model.spareParts.some((item) => item.name === trimmed && (item.color ?? "") === (colorTrimmed ?? ""))) {
    return { ok: false, error: "قطعة الغيار موجودة مسبقًا لهذا الموديل." };
  }
  model.spareParts.push(
    normalizeSparePart({
      id: crypto.randomUUID(),
      name: trimmed,
      color: colorTrimmed,
    }),
  );
  saveCatalog(catalog);
  return { ok: true };
}

export function updateModelSparePart(
  modelId: string,
  partId: string,
  name: string,
  color?: string,
): { ok: true } | { ok: false; error: string } {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "اسم قطعة الغيار إلزامي." };
  const colorTrimmed = color?.trim() || undefined;
  const catalog = getCatalog();
  const model = catalog.models.find((item) => item.id === modelId);
  if (!model) return { ok: false, error: "الموديل غير موجود." };
  const part = model.spareParts.find((item) => item.id === partId);
  if (!part) return { ok: false, error: "قطعة الغيار غير موجودة." };
  if (
    model.spareParts.some(
      (item) =>
        item.id !== partId &&
        item.name === trimmed &&
        (item.color ?? "") === (colorTrimmed ?? ""),
    )
  ) {
    return { ok: false, error: "قطعة الغيار موجودة مسبقًا لهذا الموديل." };
  }
  part.name = trimmed;
  if (colorTrimmed) part.color = colorTrimmed;
  else delete part.color;
  saveCatalog(catalog);
  return { ok: true };
}

export function deleteModelSparePart(
  modelId: string,
  partId: string,
): { ok: true } | { ok: false; error: string } {
  const catalog = getCatalog();
  const model = catalog.models.find((item) => item.id === modelId);
  if (!model) return { ok: false, error: "الموديل غير موجود." };
  model.spareParts = model.spareParts.filter((item) => item.id !== partId);
  saveCatalog(catalog);
  return { ok: true };
}

export function resetCatalogToSeed() {
  return saveCatalog(seedCatalog());
}
