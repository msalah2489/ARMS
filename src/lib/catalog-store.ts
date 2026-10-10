import {
  BRANDS_SEED,
  DEVICE_TYPES_SEED,
  MODELS_SEED,
} from "@/lib/branch-catalog";
import { isDemoMode } from "@/lib/auth";
import { pushAppCatalog } from "@/lib/supabase/app-sync";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { AccessoryItem, CatalogItem, ModelItem, SparePartItem } from "@/types/domain";

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

function normalizeColoredItem<T extends { id: string; name: string; color?: string }>(item: T): T {
  const color = item.color?.trim();
  const next = { ...item, name: item.name };
  if (color) next.color = color;
  else delete next.color;
  return next;
}

function normalizeSparePart(part: SparePartItem): SparePartItem {
  const next = normalizeColoredItem(part);
  const image = part.imageDataUrl?.trim();
  if (image) next.imageDataUrl = image;
  else delete next.imageDataUrl;
  return next;
}

function normalizeAccessory(accessory: AccessoryItem): AccessoryItem {
  return normalizeColoredItem(accessory);
}

/** Normalize and de-dupe model body colors; migrates legacy `color` → `colors`. */
export function normalizeModelColors(model: Pick<ModelItem, "colors" | "color">): string[] {
  const fromList = Array.isArray(model.colors) ? model.colors : [];
  const legacy = model.color?.trim() ? [model.color.trim()] : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of [...fromList, ...legacy]) {
    const value = String(raw ?? "").trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

export function getModelColors(model: Pick<ModelItem, "colors" | "color"> | null | undefined): string[] {
  if (!model) return [];
  return normalizeModelColors(model);
}

/** True if any accessory or spare part on the model has a non-empty color. */
export function modelHasColoredParts(
  model: Pick<ModelItem, "accessories" | "spareParts"> | null | undefined,
): boolean {
  if (!model) return false;
  return (
    model.accessories.some((item) => Boolean(item.color?.trim())) ||
    model.spareParts.some((item) => Boolean(item.color?.trim()))
  );
}

function normalizeModel(model: ModelItem): ModelItem {
  const image = model.imageDataUrl?.trim();
  const colors = normalizeModelColors(model);
  const next: ModelItem = {
    ...model,
    imageDataUrl: image || undefined,
    colors,
    accessories: (model.accessories ?? []).map(normalizeAccessory),
    spareParts: (model.spareParts ?? []).map(normalizeSparePart),
  };
  delete next.color;
  return next;
}

function seedCatalog(): DeviceCatalogState {
  return {
    deviceTypes: DEVICE_TYPES_SEED.map((item) => ({ ...item })),
    brands: BRANDS_SEED.map((item) => ({ ...item })),
    models: MODELS_SEED.map((model) => normalizeModel({ ...model })),
  };
}

/** Raw localStorage catalog with no demo seed fallback (for Supabase hydrate). */
export function getCatalogLocalRaw(): DeviceCatalogState | null {
  if (typeof window === "undefined") return null;
  const stored = readJson<DeviceCatalogState | null>(CATALOG_KEY, null);
  if (!stored) return null;
  return {
    deviceTypes: stored.deviceTypes ?? [],
    brands: stored.brands ?? [],
    models: (stored.models ?? []).map(normalizeModel),
  };
}

export function getCatalogLocal(): DeviceCatalogState {
  const raw = getCatalogLocalRaw();
  if (raw && (raw.deviceTypes.length || raw.brands.length || raw.models.length)) {
    return raw;
  }
  // Cloud mode: empty until hydrate / admin fills catalog.
  if (isSupabaseConfigured() && !isDemoMode()) {
    return raw ?? { deviceTypes: [], brands: [], models: [] };
  }
  return seedCatalog();
}

export function replaceCatalog(catalog: DeviceCatalogState) {
  if (typeof window === "undefined") return;
  writeJson(CATALOG_KEY, catalog);
}

export function applyRemoteCatalog(catalog: DeviceCatalogState) {
  replaceCatalog({
    deviceTypes: catalog.deviceTypes ?? [],
    brands: catalog.brands ?? [],
    models: (catalog.models ?? []).map(normalizeModel),
  });
}

export function getCatalog(): DeviceCatalogState {
  if (typeof window === "undefined") {
    return isSupabaseConfigured() && !isDemoMode()
      ? { deviceTypes: [], brands: [], models: [] }
      : seedCatalog();
  }

  const stored = readJson<DeviceCatalogState | null>(CATALOG_KEY, null);

  // Cloud mode: never auto-seed or push demo catalog; show stored or empty.
  if (isSupabaseConfigured() && !isDemoMode()) {
    if (!stored) return { deviceTypes: [], brands: [], models: [] };
    return {
      deviceTypes: stored.deviceTypes ?? [],
      brands: stored.brands ?? [],
      models: (stored.models ?? []).map(normalizeModel),
    };
  }

  const fallback = seedCatalog();
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
  if (isSupabaseConfigured() && !isDemoMode()) {
    void pushAppCatalog(next);
  }
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
  colors: string[];
  imageDataUrl: string;
}): { ok: true; id: string } | { ok: false; error: string } {
  const name = input.name.trim();
  const colors = normalizeModelColors({ colors: input.colors });
  const imageDataUrl = input.imageDataUrl.trim();
  if (!name) return { ok: false, error: "اسم الموديل إلزامي." };
  if (!colors.length) return { ok: false, error: "لون الجهاز مطلوب مرة واحدة على الأقل (لون واحد يكفي)." };
  if (!imageDataUrl) return { ok: false, error: "صورة الموديل إلزامية." };
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
  const id = crypto.randomUUID();
  catalog.models.push({
    id,
    name,
    deviceTypeId: input.deviceTypeId,
    brandId: input.brandId,
    colors,
    imageDataUrl,
    accessories: [],
    spareParts: [],
  });
  saveCatalog(catalog);
  return { ok: true, id };
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
  colors: string[];
  imageDataUrl: string;
}): { ok: true } | { ok: false; error: string } {
  const name = input.name.trim();
  const colors = normalizeModelColors({ colors: input.colors });
  const imageDataUrl = input.imageDataUrl.trim();
  if (!name) return { ok: false, error: "اسم الموديل إلزامي." };
  if (!colors.length) return { ok: false, error: "لون الجهاز مطلوب مرة واحدة على الأقل (لون واحد يكفي)." };
  if (!imageDataUrl) return { ok: false, error: "صورة الموديل إلزامية." };
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
  model.colors = colors;
  delete model.color;
  model.imageDataUrl = imageDataUrl;
  saveCatalog(catalog);
  return { ok: true };
}

export function addModelAccessory(
  modelId: string,
  name: string,
  color?: string,
): { ok: true } | { ok: false; error: string } {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "اسم الملحق إلزامي." };
  const colorTrimmed = color?.trim() || undefined;
  const catalog = getCatalog();
  const model = catalog.models.find((item) => item.id === modelId);
  if (!model) return { ok: false, error: "الموديل غير موجود." };
  if (
    model.accessories.some(
      (item) => item.name === trimmed && (item.color ?? "") === (colorTrimmed ?? ""),
    )
  ) {
    return { ok: false, error: "الملحق موجود مسبقًا لهذا الموديل." };
  }
  model.accessories.push(
    normalizeAccessory({
      id: crypto.randomUUID(),
      name: trimmed,
      color: colorTrimmed,
    }),
  );
  saveCatalog(catalog);
  return { ok: true };
}

export function updateModelAccessory(
  modelId: string,
  accessoryId: string,
  name: string,
  color?: string,
): { ok: true } | { ok: false; error: string } {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "اسم الملحق إلزامي." };
  const colorTrimmed = color?.trim() || undefined;
  const catalog = getCatalog();
  const model = catalog.models.find((item) => item.id === modelId);
  if (!model) return { ok: false, error: "الموديل غير موجود." };
  const accessory = model.accessories.find((item) => item.id === accessoryId);
  if (!accessory) return { ok: false, error: "الملحق غير موجود." };
  if (
    model.accessories.some(
      (item) =>
        item.id !== accessoryId &&
        item.name === trimmed &&
        (item.color ?? "") === (colorTrimmed ?? ""),
    )
  ) {
    return { ok: false, error: "الملحق موجود مسبقًا لهذا الموديل." };
  }
  accessory.name = trimmed;
  if (colorTrimmed) accessory.color = colorTrimmed;
  else delete accessory.color;
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
  imageDataUrl?: string,
): { ok: true } | { ok: false; error: string } {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "اسم قطعة الغيار إلزامي." };
  const colorTrimmed = color?.trim() || undefined;
  const image = imageDataUrl?.trim() || undefined;
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
      imageDataUrl: image,
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
  imageDataUrl?: string,
): { ok: true } | { ok: false; error: string } {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "اسم قطعة الغيار إلزامي." };
  const colorTrimmed = color?.trim() || undefined;
  const image = imageDataUrl?.trim() || undefined;
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
  if (image) part.imageDataUrl = image;
  else delete part.imageDataUrl;
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
  // Cloud / production: clearing means empty catalog, never re-inject demo seed.
  if (isSupabaseConfigured() && !isDemoMode()) {
    return saveCatalog({ deviceTypes: [], brands: [], models: [] });
  }
  return saveCatalog(seedCatalog());
}

export type CatalogNameSuggestion = {
  name: string;
  color?: string;
  modelNames: string[];
  count: number;
};

function matchesQuery(name: string, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return name.toLowerCase().includes(q);
}

/** Existing accessory names (and optional color) across models. */
export function suggestAccessoryNames(
  query: string,
  options?: { excludeModelId?: string; limit?: number },
): CatalogNameSuggestion[] {
  const catalog = getCatalog();
  const map = new Map<string, CatalogNameSuggestion>();

  for (const model of catalog.models) {
    if (options?.excludeModelId && model.id === options.excludeModelId) continue;
    for (const accessory of model.accessories) {
      if (
        !matchesQuery(accessory.name, query) &&
        !(accessory.color && matchesQuery(accessory.color, query))
      ) {
        continue;
      }
      const key = `${accessory.name.trim().toLowerCase()}::${(accessory.color ?? "").trim().toLowerCase()}`;
      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
        if (!existing.modelNames.includes(model.name)) existing.modelNames.push(model.name);
      } else {
        map.set(key, {
          name: accessory.name,
          color: accessory.color,
          modelNames: [model.name],
          count: 1,
        });
      }
    }
  }

  return [...map.values()]
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "ar"))
    .slice(0, options?.limit ?? 8);
}

/** Existing spare-part names (and optional color) across models. */
export function suggestSparePartNames(
  query: string,
  options?: { excludeModelId?: string; limit?: number },
): CatalogNameSuggestion[] {
  const catalog = getCatalog();
  const map = new Map<string, CatalogNameSuggestion>();

  for (const model of catalog.models) {
    if (options?.excludeModelId && model.id === options.excludeModelId) continue;
    for (const part of model.spareParts) {
      if (!matchesQuery(part.name, query) && !(part.color && matchesQuery(part.color, query))) {
        continue;
      }
      const key = `${part.name.trim().toLowerCase()}::${(part.color ?? "").trim().toLowerCase()}`;
      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
        if (!existing.modelNames.includes(model.name)) existing.modelNames.push(model.name);
      } else {
        map.set(key, {
          name: part.name,
          color: part.color,
          modelNames: [model.name],
          count: 1,
        });
      }
    }
  }

  return [...map.values()]
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "ar"))
    .slice(0, options?.limit ?? 8);
}

