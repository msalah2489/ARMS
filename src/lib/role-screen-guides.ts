import { normalizeRole } from "@/lib/auth";
import type { AppRole } from "@/types/domain";

/** Screens that show compact in-page «ماذا أفعل الآن؟» tips (v1). */
export type RoleGuideScreen =
  | "dashboard"
  | "service_request_new"
  | "technician_work"
  | "branch_shipping"
  | "branch_receiving"
  | "my_tasks";

export type RoleGuideContent = {
  steps: string[];
  /** Optional one-line reminder under the steps. */
  tip?: string;
};

type RoleKey =
  | "branch"
  | "technician"
  | "mobile_technician"
  | "maintenance_manager"
  | "maintenance_supervisor"
  | "system_admin"
  | "pickup_courier";

function roleKey(role: AppRole | string): RoleKey | null {
  const r = normalizeRole(String(role));
  switch (r) {
    case "branch":
    case "technician":
    case "mobile_technician":
    case "maintenance_manager":
    case "maintenance_supervisor":
    case "system_admin":
    case "pickup_courier":
      return r;
    default:
      return null;
  }
}

const GUIDES: Partial<Record<RoleGuideScreen, Partial<Record<RoleKey, RoleGuideContent>>>> = {
  dashboard: {
    branch: {
      steps: [
        "راجع بطاقات العمل اليوم (جاهز للإرسال، وارد من الصيانة، بانتظار العميل).",
        "أنشئ طلبًا جديدًا عند استلام جهاز من العميل.",
        "افتح «مهامي اليوم» إن ظهر تأخير أو عمل معلّق.",
      ],
      tip: "ملصق QR إلزامي قبل إرسال أي جهاز عبر المندوب.",
    },
    technician: {
      steps: [
        "افتح «عمل الفني» لاستلام جهاز من طابور الانتظار.",
        "أكمل الصيانة وسجّل القطع والملحقات قبل الإنهاء.",
        "راجع «مهامي اليوم» إن وُجدت أجهزة متأخرة لديك.",
      ],
    },
    mobile_technician: {
      steps: [
        "افتح «عمل الفني» لأجهزة فرعك بحالة الصيانة بالفرع.",
        "عند تعذّر الصيانة قد تحتاج إرجاع الجهاز لموظف الفرع.",
        "راجع «مهامي اليوم» للمتابعة السريعة.",
      ],
    },
    maintenance_manager: {
      steps: [
        "راجع التنبيهات وبطاقات العمل (قرارات، شحن، مخزون).",
        "أنشئ أو استلم بوالص من «بوليصات الشحن».",
        "افتح «مهامي اليوم» لما هو معلّق عليك الآن.",
      ],
      tip: "بوليصات الإرسال والإرجاع من مسؤولية مركز الصيانة — ليس الفرع.",
    },
    maintenance_supervisor: {
      steps: [
        "راجع التنبيهات والأجهزة التي تحتاج اعتمادًا أو استلامًا.",
        "تابع بوالص الشحن واعتماد تسليم المندوب.",
        "افتح «مهامي اليوم» للعمل المطلوب منك.",
      ],
    },
    system_admin: {
      steps: [
        "راجع ملخص التشغيل والتنبيهات العامة.",
        "أدِر المستخدمين والفروع والكتالوج من قوائم الإدارة.",
        "افتح التقارير أو «مهامي اليوم» عند الحاجة لمتابعة تشغيلية.",
      ],
    },
    pickup_courier: {
      steps: [
        "افتح «نماذج الاستلام» لمراجعة النماذج بانتظارك.",
        "اعتمد أو ارفض النموذج بعد التحقق من الأجهزة.",
        "راجع «مهامي اليوم» للنماذج المعلّقة.",
      ],
    },
  },

  service_request_new: {
    branch: {
      steps: [
        "أدخل جوال العميل واسمه (أو اختر عميلًا موجودًا).",
        "أضف الأجهزة: الموديل، اللون، الشكوى، الحالة، الملحقات.",
        "احفظ كل جهاز ثم اطبع ملصق QR قبل الإرسال لاحقًا.",
        "احفظ الطلب بالكامل عند الانتهاء.",
      ],
      tip: "بدون QR مطبوع لن يظهر الجهاز في شحن المندوب.",
    },
    maintenance_manager: {
      steps: [
        "اختر الفرع إن لزم، ثم عبّئ بيانات العميل.",
        "أضف الأجهزة واطبع ملصقات QR.",
        "احفظ الطلب وتابع المسار من شاشات الشحن/العمل.",
      ],
    },
    maintenance_supervisor: {
      steps: [
        "عبّئ بيانات العميل والأجهزة بدقة.",
        "اطبع ملصق QR لكل جهاز.",
        "احفظ الطلب ثم تابع من الشاشات التشغيلية.",
      ],
    },
    system_admin: {
      steps: [
        "اختر الفرع المناسب ثم سجّل العميل والأجهزة.",
        "اطبع ملصقات QR.",
        "احفظ الطلب وتحقق من ظهوره في قوائم التشغيل.",
      ],
    },
  },

  technician_work: {
    technician: {
      steps: [
        "من طابور الانتظار اضغط «استلام الجهاز» (أو امسح QR).",
        "سجّل الحالة وسبب العطل وقطع الغيار والملحقات المرجعة.",
        "أنهِ العمل بالنتيجة المناسبة (نجاح / تعذّر / …).",
      ],
      tip: "لا تبدأ جهازًا يدّعيه فني آخر — سيظهر تنبيه تعارض.",
    },
    mobile_technician: {
      steps: [
        "استلم جهازًا من طابور فرعك.",
        "نفّذ الصيانة وسجّل القطع والملحقات.",
        "عند التعذّر استخدم إرجاع الجهاز لموظف الفرع إن ظهر الخيار.",
      ],
    },
  },

  branch_shipping: {
    branch: {
      steps: [
        "اختر مندوب الاستلام وحدّد الأجهزة الجاهزة (بعد طباعة QR).",
        "أرسل «نموذج الاستلام للمندوب» — هذا مسار الفرع الافتراضي.",
        "تابع بوالص مدير الصيانة إن وُجدت تحت قسم البوالص (لا تنشئها أنت).",
      ],
      tip: "موظف الفرع لا ينشئ بوليصة شحن إلى الصيانة.",
    },
  },

  branch_receiving: {
    branch: {
      steps: [
        "تابع الأقسام: في الفرع → في الصيانة → في الطريق → بانتظار العميل.",
        "اطبع QR لأي جهاز ما زال بلا ملصق قبل الإرسال.",
        "عند عودة الجهاز أكّد الاستلام ثم سلّمه للعميل.",
      ],
    },
  },

  my_tasks: {
    branch: {
      steps: [
        "نفّذ المهام المعلّقة بالترتيب (المتأخر أولًا إن وُجد).",
        "كل بطاقة تفتح الشاشة المناسبة مباشرة.",
        "بعد الإنجاز اختفِ المهمة من القائمة تلقائيًا.",
      ],
    },
    technician: {
      steps: [
        "افتح المهام المتأخرة أو قيد العمل لديك.",
        "انتقل لعمل الفني لإكمال الجهاز.",
        "حدّث الحالة حتى تُغلق المهمة.",
      ],
    },
    mobile_technician: {
      steps: [
        "راجع الأجهزة/المهام المرتبطة بفرعك.",
        "أكمل العمل من شاشة عمل الفني.",
        "أعد الجهاز للفرع عند التعذّر إن لزم.",
      ],
    },
    maintenance_manager: {
      steps: [
        "عالج القرارات والبوالص والمهام المتأخرة أولًا.",
        "استخدم رابط كل مهمة للانتقال السريع.",
        "أعد فتح «مهامي اليوم» بعد التنفيذ للتأكد من التصفية.",
      ],
    },
    maintenance_supervisor: {
      steps: [
        "ابدأ بالمهام المتأخرة ثم الاعتمادات المعلّقة.",
        "افتح رابط المهمة ونفّذ الإجراء المطلوب.",
        "تحقق أن المهمة اختفت بعد الإنجاز.",
      ],
    },
    system_admin: {
      steps: [
        "راجع المهام التشغيلية الظاهرة لحسابك.",
        "افتح الرابط المناسب وأكمل الإجراء.",
        "استخدم التقارير إن احتجت نظرة أوسع.",
      ],
    },
    pickup_courier: {
      steps: [
        "افتح نماذج الاستلام المعلّقة من القائمة.",
        "راجع الأجهزة ثم اعتمد أو ارفض.",
        "تابع حتى يعتمد مركز الصيانة التسليم.",
      ],
    },
  },
};

/** Returns compact steps for the signed-in role on a screen, or null if none. */
export function getRoleScreenGuide(
  screen: RoleGuideScreen,
  role: AppRole | string | null | undefined,
): RoleGuideContent | null {
  if (!role) return null;
  const key = roleKey(role);
  if (!key) return null;
  return GUIDES[screen]?.[key] ?? null;
}
