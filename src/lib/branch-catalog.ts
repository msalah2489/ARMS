import type { CatalogItem, ExternalCondition, ModelItem } from "@/types/domain";

export const EXTERNAL_CONDITION_LABELS: Record<ExternalCondition, string> = {
  intact: "سليم",
  broken: "مكسور",
  scratched: "به خدوش",
  leak_marks: "آثار تسريب",
  other: "أخرى",
};

export const DEVICE_TYPES: CatalogItem[] = [
  { id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1", name: "جهاز تعطير" },
  { id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2", name: "جهاز توزيع" },
];

export const BRANDS: CatalogItem[] = [
  { id: "cccccccc-cccc-cccc-cccc-ccccccccccc1", name: "AromaTech" },
  { id: "cccccccc-cccc-cccc-cccc-ccccccccccc2", name: "ScentPro" },
];

export const MODELS: ModelItem[] = [
  {
    id: "dddddddd-dddd-dddd-dddd-ddddddddddd1",
    name: "Nimbus 300",
    deviceTypeId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1",
    brandId: "cccccccc-cccc-cccc-cccc-ccccccccccc1",
    accessories: [
      { id: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1", name: "سلك كهرباء" },
      { id: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee2", name: "قاعدة تثبيت" },
      { id: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee3", name: "عبوة عطر" },
    ],
  },
  {
    id: "dddddddd-dddd-dddd-dddd-ddddddddddd2",
    name: "Aura Mini",
    deviceTypeId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1",
    brandId: "cccccccc-cccc-cccc-cccc-ccccccccccc1",
    accessories: [
      { id: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee4", name: "سلك كهرباء" },
      { id: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee5", name: "ريموت" },
    ],
  },
  {
    id: "dddddddd-dddd-dddd-dddd-ddddddddddd3",
    name: "Pro Diffuser",
    deviceTypeId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2",
    brandId: "cccccccc-cccc-cccc-cccc-ccccccccccc2",
    accessories: [{ id: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee6", name: "حامل جداري" }],
  },
];

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
