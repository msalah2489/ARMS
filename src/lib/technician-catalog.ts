import type { DamageOption, HoldReason, MaintenanceOutcome } from "@/types/domain";

export const TECH_DAMAGE_LABELS: Record<DamageOption, string> = {
  break: "كسر",
  scratches: "خدوش",
  leak: "تسريب",
  missing_part: "جزء مفقود",
  other: "أخرى",
};

export const FAULT_CAUSE_OPTIONS = [
  "مشكلة في المضخة",
  "مشكلة في اللوحة الإلكترونية",
  "انسداد في نظام الرش",
  "مشكلة في التغذية الكهربائية",
  "مشكلة برمجية",
  "أخرى",
];

export const ACTION_OPTIONS = [
  "استبدال المضخة",
  "تنظيف نظام الرش",
  "إعادة برمجة",
  "استبدال لوحة",
  "فحص وتشغيل فقط",
  "أخرى",
];

export const OUTCOME_LABELS: Record<MaintenanceOutcome, string> = {
  repaired: "تم الإصلاح",
  no_repair_needed: "لم يحتاج إلى إصلاح",
  issue_persists: "ما زالت المشكلة قائمة",
  not_repairable: "غير قابل للإصلاح",
};

export const HOLD_REASON_LABELS: Record<HoldReason, string> = {
  no_spare_parts: "عدم توفر قطع غيار",
  unrepairable_fault: "عطل غير قابل للإصلاح",
  fully_damaged: "جهاز تالف بالكامل",
  other: "أخرى",
};

export const MODEL_SPARE_PARTS: Record<string, Array<{ id: string; name: string }>> = {
  "dddddddd-dddd-dddd-dddd-ddddddddddd1": [
    { id: "sp-fan", name: "مروحة هادئة" },
    { id: "sp-pump", name: "طقم مضخة مصغرة" },
    { id: "sp-nozzle", name: "طقم فوهات" },
  ],
  "dddddddd-dddd-dddd-dddd-ddddddddddd2": [
    { id: "sp-pump", name: "طقم مضخة مصغرة" },
    { id: "sp-board", name: "لوحة تشغيل" },
  ],
  "dddddddd-dddd-dddd-dddd-ddddddddddd3": [
    { id: "sp-nozzle", name: "طقم فوهات" },
    { id: "sp-cable", name: "سلك طاقة" },
  ],
};
