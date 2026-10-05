import type { DamageOption, HoldReason, MaintenanceOutcome } from "@/types/domain";
import { getSparePartsForModel } from "@/lib/catalog-store";

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

/** Spare parts come from the admin-managed catalog. */
export function getModelSpareParts(modelId: string) {
  return getSparePartsForModel(modelId);
}

/** @deprecated use getModelSpareParts */
export const MODEL_SPARE_PARTS: Record<string, Array<{ id: string; name: string }>> = {};
