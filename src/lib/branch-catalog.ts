import type { CatalogItem, ModelItem } from "@/types/domain";

export const EXTERNAL_CONDITION_LABELS = {
  intact: "سليم",
  broken: "مكسور",
  scratched: "به خدوش",
  leak_marks: "آثار تسريب",
  other: "أخرى",
} as const;

/** Seed defaults — copied into localStorage catalog on first use. */
export const DEVICE_TYPES_SEED: CatalogItem[] = [
  { id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1", name: "جهاز تعطير" },
  { id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2", name: "جهاز توزيع" },
];

export const BRANDS_SEED: CatalogItem[] = [
  { id: "cccccccc-cccc-cccc-cccc-ccccccccccc1", name: "AromaTech" },
  { id: "cccccccc-cccc-cccc-cccc-ccccccccccc2", name: "ScentPro" },
];

export const MODELS_SEED: ModelItem[] = [
  {
    id: "dddddddd-dddd-dddd-dddd-ddddddddddd1",
    name: "Nimbus 300",
    deviceTypeId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1",
    brandId: "cccccccc-cccc-cccc-cccc-ccccccccccc1",
    colors: ["أسود", "فضي", "ذهبي"],
    accessories: [
      { id: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1", name: "سلك كهرباء", color: "أسود" },
      { id: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee2", name: "قاعدة تثبيت" },
      { id: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee3", name: "عبوة عطر" },
    ],
    spareParts: [
      { id: "sp-fan", name: "مروحة هادئة" },
      { id: "sp-pump", name: "طقم مضخة مصغرة" },
      { id: "sp-nozzle", name: "طقم فوهات" },
      { id: "sp-charger", name: "شاحن", color: "أسود" },
    ],
  },
  {
    id: "dddddddd-dddd-dddd-dddd-ddddddddddd2",
    name: "Aura Mini",
    deviceTypeId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1",
    brandId: "cccccccc-cccc-cccc-cccc-ccccccccccc1",
    colors: ["فضي", "أسود"],
    accessories: [
      { id: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee4", name: "سلك كهرباء", color: "أسود" },
      { id: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee5", name: "ريموت" },
    ],
    spareParts: [
      { id: "sp-pump", name: "طقم مضخة مصغرة" },
      { id: "sp-board", name: "لوحة تشغيل" },
    ],
  },
  {
    id: "dddddddd-dddd-dddd-dddd-ddddddddddd3",
    name: "Pro Diffuser",
    deviceTypeId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2",
    brandId: "cccccccc-cccc-cccc-cccc-ccccccccccc2",
    colors: ["أبيض", "أسود"],
    accessories: [{ id: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee6", name: "حامل جداري" }],
    spareParts: [
      { id: "sp-nozzle", name: "طقم فوهات" },
      { id: "sp-cable", name: "سلك طاقة", color: "أسود" },
    ],
  },
];

/** @deprecated use getDeviceTypes from catalog-store */
export const DEVICE_TYPES = DEVICE_TYPES_SEED;
/** @deprecated use getBrands from catalog-store */
export const BRANDS = BRANDS_SEED;
/** @deprecated use getModels from catalog-store */
export const MODELS = MODELS_SEED;

export function generateDeviceCode() {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.floor(Math.random() * 900 + 100);
  return `ARMS-${stamp}-${rand}`;
}

export function generateRequestNumber() {
  const year = new Date().getFullYear();
  const seq = Math.floor(Math.random() * 900000 + 100000);
  return `SR-${year}-${seq}`;
}

export function isValidSaudiMobile(value: string) {
  return /^05\d{8}$/.test(value);
}
