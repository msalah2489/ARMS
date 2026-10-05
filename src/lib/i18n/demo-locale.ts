import type { AppLocale } from "@/lib/preferences";
import type { Branch, Customer, Device, ServiceRequest } from "@/types/domain";
import {
  demoBranches,
  demoCustomers,
  demoDevices,
  demoRequests,
} from "@/lib/demo-data";

const customerAr: Record<string, Partial<Customer>> = {
  c1: {
    name: "ميزون أروما",
    contactName: "رانيا الخوري",
    address: "وسط بيروت التجاري",
  },
  c2: {
    name: "مجموعة فنادق سيدار",
    contactName: "فادي منصور",
    address: "ضبية، المتن",
  },
  c3: {
    name: "أوليف آند أوك للتجزئة",
    contactName: "سارة ضاهر",
    address: "فردان، بيروت",
  },
};

const branchAr: Record<string, Partial<Branch>> = {
  b1: {
    name: "الفرع الرئيسي — وسط البلد",
    customerName: "ميزون أروما",
    address: "شارع ويغان",
  },
  b2: {
    name: "فرع الأشرفية",
    customerName: "ميزون أروما",
    address: "مجمع ABC",
  },
  b3: {
    name: "سيدار جراند",
    customerName: "مجموعة فنادق سيدار",
    address: "أوتوستراد ضبية",
  },
};

const deviceAr: Record<string, Partial<Device>> = {
  d1: {
    color: "أسود مطفي",
    customerName: "ميزون أروما",
    branchName: "الفرع الرئيسي — وسط البلد",
    currentLocation: "سيارة الفني — كريم",
  },
  d2: {
    color: "أبيض لؤلؤي",
    customerName: "ميزون أروما",
    branchName: "فرع الأشرفية",
    currentLocation: "فرع الأشرفية — الاستقبال",
  },
  d3: {
    color: "فولاذ مصقول",
    customerName: "مجموعة فنادق سيدار",
    branchName: "سيدار جراند",
    currentLocation: "مركز الصيانة المركزي",
  },
  d4: {
    color: "فولاذ مصقول",
    customerName: "مجموعة فنادق سيدار",
    branchName: "سيدار جراند",
    currentLocation: "سيدار جراند — السبا",
  },
};

const requestAr: Record<string, Partial<ServiceRequest>> = {
  sr1: {
    customerName: "ميزون أروما",
    branchName: "الفرع الرئيسي — وسط البلد",
    reportedProblem: "ضعف في الانتشار / صوت المضخة",
    assignedTechnician: "كريم صالح",
  },
  sr2: {
    customerName: "مجموعة فنادق سيدار",
    branchName: "سيدار جراند",
    reportedProblem: "عطل في اللوحة بعد ارتفاع التيار",
    assignedTechnician: "كريم صالح",
  },
  sr3: {
    customerName: "مجموعة فنادق سيدار",
    branchName: "سيدار جراند",
    reportedProblem: "تسريب عند ختم الخرطوشة",
    assignedTechnician: "كريم صالح",
  },
  sr4: {
    customerName: "أوليف آند أوك للتجزئة",
    branchName: "فردان",
    reportedProblem: "استبدال فلتر مجدول",
    assignedTechnician: null,
  },
};

export function localizedDemoCustomers(locale: AppLocale): Customer[] {
  if (locale !== "ar") return demoCustomers;
  return demoCustomers.map((item) => ({ ...item, ...customerAr[item.id] }));
}

export function localizedDemoBranches(locale: AppLocale): Branch[] {
  if (locale !== "ar") return demoBranches;
  return demoBranches.map((item) => ({ ...item, ...branchAr[item.id] }));
}

export function localizedDemoDevices(locale: AppLocale): Device[] {
  if (locale !== "ar") return demoDevices;
  return demoDevices.map((item) => ({ ...item, ...deviceAr[item.id] }));
}

export function localizedDemoRequests(locale: AppLocale): ServiceRequest[] {
  if (locale !== "ar") return demoRequests;
  return demoRequests.map((item) => ({ ...item, ...requestAr[item.id] }));
}
