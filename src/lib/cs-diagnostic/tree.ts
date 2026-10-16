/**
 * CS-FEATURE — Aroma device «الجهاز لا يعمل» decision tree (data-driven).
 * Expand later by adding nodes; UI stays generic.
 */

import type { CsDiagnosticTree } from "./types";

export const CS_DEVICE_NOT_WORKING_TREE: CsDiagnosticTree = {
  id: "device_not_working",
  titleAr: "الجهاز لا يعمل",
  startId: "q_light",
  nodes: {
    q_light: {
      id: "q_light",
      kind: "question",
      promptAr: "هل تضيء إضاءة الجهاز؟",
      hintAr: "انظر إلى مؤشر الإضاءة على الجهاز أثناء محاولة التشغيل.",
      answers: [
        { id: "light_no", labelAr: "لا — لا تضيء", nextId: "q_outlet" },
        { id: "light_yes", labelAr: "نعم — تضيء", nextId: "q_sound" },
      ],
    },

    // —— مسار انعدام الإضاءة ——
    q_outlet: {
      id: "q_outlet",
      kind: "question",
      promptAr: "هل المنفذ الكهربائي الحالي يعمل؟ (جرّب جهازًا آخر على نفس المنفذ إن أمكن)",
      hintAr: "تأكد أن القابس داخل المنفذ بالكامل وأن المفتاح (إن وُجد) مفتوح.",
      causes: [
        { id: "bad_outlet", labelAr: "منفذ معطل أو غير موصل", percent: 55 },
        { id: "loose_plug", labelAr: "قابس غير مثبت جيدًا", percent: 25 },
        { id: "power_board", labelAr: "عطل في القابس / لوحة الطاقة بالجهاز", percent: 20 },
      ],
      answers: [
        { id: "outlet_dead", labelAr: "المنفذ لا يعمل / مشكوك فيه", nextId: "q_other_outlet" },
        { id: "outlet_ok", labelAr: "المنفذ يعمل والجهاز ما زال مظلمًا", nextId: "q_other_outlet" },
      ],
    },

    q_other_outlet: {
      id: "q_other_outlet",
      kind: "question",
      promptAr: "انقل الجهاز إلى منفذ آخر مختلف. هل أضاءت الإضاءة؟",
      answers: [
        { id: "other_lit", labelAr: "نعم — أضاء من المنفذ الآخر", nextId: "r_outlet_home" },
        { id: "other_dark", labelAr: "لا — ما زال مظلمًا", nextId: "r_plug_board_branch" },
      ],
    },

    r_outlet_home: {
      id: "r_outlet_home",
      kind: "result",
      titleAr: "غالبًا مشكلة في المنفذ الأول",
      summaryAr:
        "الجهاز يعمل من منفذ آخر. استخدم منفذًا سليمًا أو أصلِح المنفذ المعطل في المنزل. لا حاجة لزيارة الفرع إذا استمر الجهاز بالإضاءة والتشغيل.",
      action: "home_fix",
      actionLabelAr: "حل منزلي — غيّر المنفذ",
      causes: [
        { id: "bad_outlet", labelAr: "منفذ كهرباء معطل", percent: 80 },
        { id: "extension_cord", labelAr: "سلك توصيل / مشترك معطل", percent: 15 },
        { id: "other", labelAr: "سبب آخر نادر", percent: 5 },
      ],
    },

    r_plug_board_branch: {
      id: "r_plug_board_branch",
      kind: "result",
      titleAr: "يُرجّح عطل القابس أو لوحة الطاقة",
      summaryAr:
        "الإضاءة لا تظهر حتى من منفذ آخر سليم. السبب الأكثر احتمالًا عطل في قابس الجهاز أو لوحة الطاقة الداخلية. وجّه العميل لزيارة الفرع للصيانة.",
      action: "go_to_branch",
      actionLabelAr: "توجيه للفرع",
      causes: [
        { id: "plug", labelAr: "عطل في القابس / سلك الطاقة", percent: 45 },
        { id: "power_board", labelAr: "عطل لوحة الطاقة", percent: 40 },
        { id: "internal_wiring", labelAr: "تلف داخلي نادر", percent: 15 },
      ],
    },

    // —— مسار وجود إضاءة ——
    q_sound: {
      id: "q_sound",
      kind: "question",
      promptAr: "هل يصدر الجهاز صوت التشغيل (مضخة / بخار)؟",
      answers: [
        { id: "sound_no", labelAr: "لا — بدون صوت", nextId: "q_light_color" },
        { id: "sound_yes", labelAr: "نعم — يوجد صوت", nextId: "q_oil" },
      ],
    },

    q_light_color: {
      id: "q_light_color",
      kind: "question",
      promptAr: "ما لون الإضاءة الآن؟",
      hintAr:
        "الأصفر عادةً يعني إيقافًا مجدولًا أو وضع توقف. الأزرق عادةً يعني وضع العمل. راجع أيضًا جدول التشغيل من التطبيق إن وُجد.",
      causes: [
        { id: "schedule_stop", labelAr: "إيقاف مجدول / وضع توقف", percent: 50 },
        { id: "app_mode", labelAr: "إعدادات التطبيق", percent: 25 },
        { id: "pump_fail", labelAr: "عطل مضخة مع إضاءة زرقاء", percent: 25 },
      ],
      answers: [
        { id: "yellow", labelAr: "أصفر (توقف / جدول)", nextId: "r_schedule_home" },
        { id: "blue", labelAr: "أزرق (وضع العمل)", nextId: "q_restart" },
        { id: "other_color", labelAr: "لون آخر / غير واضح", nextId: "q_restart" },
      ],
    },

    r_schedule_home: {
      id: "r_schedule_home",
      kind: "result",
      titleAr: "غالبًا إيقاف مجدول أو وضع توقف",
      summaryAr:
        "اللون الأصفر يشير إلى أن الجهاز في وضع توقف أو جدول إيقاف. اطلب من العميل مراجعة جدول التشغيل في التطبيق وتفعيل وضع العمل، ثم إعادة المحاولة.",
      action: "home_fix",
      actionLabelAr: "حل منزلي — راجع الجدول / التطبيق",
      causes: [
        { id: "schedule_stop", labelAr: "جدول إيقاف نشط", percent: 70 },
        { id: "app_off", labelAr: "الجهاز موقف من التطبيق", percent: 20 },
        { id: "other", labelAr: "سبب آخر", percent: 10 },
      ],
    },

    q_restart: {
      id: "q_restart",
      kind: "question",
      promptAr:
        "الإضاءة زرقاء (أو غير صفراء) بدون صوت. افصل الجهاز عن الكهرباء 10 ثوانٍ ثم أعد تشغيله. هل ظهر الصوت؟",
      answers: [
        { id: "restart_ok", labelAr: "نعم — عاد الصوت", nextId: "r_restart_home" },
        { id: "restart_fail", labelAr: "لا — ما زال بدون صوت", nextId: "r_blue_no_sound_branch" },
      ],
    },

    r_restart_home: {
      id: "r_restart_home",
      kind: "result",
      titleAr: "عادت بعد إعادة التشغيل",
      summaryAr:
        "المشكلة انحلت بإعادة التشغيل. إذا تكررت لاحقًا، سجّل ملاحظة ووجّه للفرع عند اللزوم.",
      action: "home_fix",
      actionLabelAr: "حل منزلي — إعادة التشغيل كافية",
      causes: [
        { id: "temp_glitch", labelAr: "خلل مؤقت في التشغيل", percent: 75 },
        { id: "app_sync", labelAr: "تأخر مزامنة التطبيق", percent: 15 },
        { id: "other", labelAr: "سبب آخر", percent: 10 },
      ],
    },

    r_blue_no_sound_branch: {
      id: "r_blue_no_sound_branch",
      kind: "result",
      titleAr: "إضاءة عمل بدون صوت بعد إعادة التشغيل",
      summaryAr:
        "الجهاز يظهر وضع العمل (أزرق) لكن لا يصدر صوتًا بعد إعادة التشغيل. يُرجّح عطل داخلي (مضخة أو لوحة). وجّه العميل لزيارة الفرع.",
      action: "go_to_branch",
      actionLabelAr: "توجيه للفرع",
      causes: [
        { id: "pump", labelAr: "عطل المضخة", percent: 55 },
        { id: "control_board", labelAr: "عطل لوحة التحكم", percent: 30 },
        { id: "sensor", labelAr: "حساس / دائرة داخلية", percent: 15 },
      ],
    },

    // —— مسار وجود صوت ——
    q_oil: {
      id: "q_oil",
      kind: "question",
      promptAr: "هل يوجد زيت عطري كافٍ في الزجاجة / الخزان؟",
      answers: [
        { id: "oil_no", labelAr: "لا / الزيت منتهٍ", nextId: "r_oil_home" },
        { id: "oil_yes", labelAr: "نعم — يوجد زيت", nextId: "q_sound_level" },
      ],
    },

    r_oil_home: {
      id: "r_oil_home",
      kind: "result",
      titleAr: "نقص الزيت",
      summaryAr: "اطلب من العميل تعبئة أو استبدال زيت مناسب للجهاز ثم إعادة التشغيل.",
      action: "home_fix",
      actionLabelAr: "حل منزلي — أضف زيتًا",
      causes: [
        { id: "no_oil", labelAr: "نفاد الزيت", percent: 90 },
        { id: "wrong_fill", labelAr: "تعبئة غير صحيحة", percent: 10 },
      ],
    },

    q_sound_level: {
      id: "q_sound_level",
      kind: "question",
      promptAr: "كيف تصف صوت الجهاز؟",
      causes: [
        { id: "pump_tube", labelAr: "مضخة / أنبوب عند الصوت العالي", percent: 40 },
        { id: "normal_flow", labelAr: "تشغيل طبيعي", percent: 35 },
        { id: "bottle_filter", labelAr: "زجاجة أو فلتر", percent: 25 },
      ],
      answers: [
        { id: "loud", labelAr: "صوت عالٍ / غير طبيعي", nextId: "r_loud_pump_tube" },
        { id: "normal", labelAr: "صوت طبيعي", nextId: "q_bottle_seated" },
      ],
    },

    r_loud_pump_tube: {
      id: "r_loud_pump_tube",
      kind: "result",
      titleAr: "صوت عالٍ — مضخة أو أنبوب",
      summaryAr:
        "الصوت العالي مع وجود زيت يشير غالبًا إلى مشكلة في المضخة أو الأنبوب (انسداد / تسرب هواء / اهتزاز). يمكن تجربة تنظيف بسيط في المنزل؛ إن استمر الصوت وجّه للفرع.",
      action: "try_then_branch",
      actionLabelAr: "جرّب تنظيف الأنبوب ثم الفرع إن استمر",
      causes: [
        { id: "tube", labelAr: "أنبوب مسدود أو مفكوك", percent: 45 },
        { id: "pump", labelAr: "عطل / إجهاد المضخة", percent: 40 },
        { id: "air_leak", labelAr: "تسرب هواء", percent: 15 },
      ],
    },

    q_bottle_seated: {
      id: "q_bottle_seated",
      kind: "question",
      promptAr: "هل الزجاجة مثبتة بإحكام وفي وضعها الصحيح؟",
      answers: [
        { id: "bottle_loose", labelAr: "لا — مائلة أو غير مثبتة", nextId: "r_reseat_bottle" },
        { id: "bottle_ok", labelAr: "نعم — مثبتة جيدًا", nextId: "q_bottle_vs_filter" },
      ],
    },

    r_reseat_bottle: {
      id: "r_reseat_bottle",
      kind: "result",
      titleAr: "تثبيت الزجاجة",
      summaryAr: "أعد تثبيت الزجاجة بشكل مستقيم ومحكم ثم شغّل الجهاز مجددًا.",
      action: "home_fix",
      actionLabelAr: "حل منزلي — ثبّت الزجاجة",
      causes: [
        { id: "bottle_seat", labelAr: "زجاجة غير مثبتة", percent: 85 },
        { id: "seal", labelAr: "ختم غير محكم", percent: 15 },
      ],
    },

    q_bottle_vs_filter: {
      id: "q_bottle_vs_filter",
      kind: "question",
      promptAr: "هل الزجاجة من النوع الصحيح المعتمد للجهاز؟",
      hintAr:
        "الزجاجة الخاطئة قد تسبب تسرب هواء وضعف الرذاذ. إن كانت الزجاجة صحيحة، غالبًا يحتاج الفلتر تنظيفًا.",
      answers: [
        { id: "wrong_bottle", labelAr: "زجاجة غير مطابقة / بديلة", nextId: "r_wrong_bottle" },
        { id: "right_bottle", labelAr: "زجاجة صحيحة ومعتمدة", nextId: "r_filter_clean" },
      ],
    },

    r_wrong_bottle: {
      id: "r_wrong_bottle",
      kind: "result",
      titleAr: "زجاجة غير مطابقة — تسرب هواء محتمل",
      summaryAr:
        "استخدم زجاجة أصلية/معتمدة للجهاز. الزجاجة الخاطئة غالبًا تسبب تسرب هواء وضعف الأداء. إن استمرت المشكلة بعد الاستبدال، وجّه للفرع.",
      action: "try_then_branch",
      actionLabelAr: "استبدل الزجاجة — ثم الفرع إن لزم",
      causes: [
        { id: "air_leak", labelAr: "تسرب هواء بسبب زجاجة خاطئة", percent: 70 },
        { id: "seal_mismatch", labelAr: "عدم تطابق الختم", percent: 20 },
        { id: "other", labelAr: "سبب آخر", percent: 10 },
      ],
    },

    r_filter_clean: {
      id: "r_filter_clean",
      kind: "result",
      titleAr: "فلتر يحتاج تنظيفًا",
      summaryAr:
        "مع زجاجة صحيحة وصوت طبيعي، السبب الأكثر احتمالًا فلتر غير منظّف. اطلب تنظيف الفلتر حسب تعليمات الجهاز ثم إعادة التشغيل. إن لم تتحسن الحالة بعد التنظيف، وجّه للفرع.",
      action: "try_then_branch",
      actionLabelAr: "نظّف الفلتر — ثم الفرع إن لزم",
      causes: [
        { id: "dirty_filter", labelAr: "فلتر متسخ / غير منظّف", percent: 75 },
        { id: "partial_clog", labelAr: "انسداد جزئي في المسار", percent: 15 },
        { id: "other", labelAr: "سبب آخر", percent: 10 },
      ],
    },
  },
};

export const CS_DIAGNOSTIC_TREES: CsDiagnosticTree[] = [CS_DEVICE_NOT_WORKING_TREE];
