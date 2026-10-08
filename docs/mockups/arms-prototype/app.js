/* ARMS interactive prototype — client-side only, fake data */
(function () {
  "use strict";

  const STORAGE_KEY = "arms-prototype-v1";

  const ROLES = [
    { id: "branch", label: "موظف فرع" },
    { id: "pickup_courier", label: "مندوب استلام" },
    { id: "technician", label: "فني" },
    { id: "supervisor", label: "مشرف صيانة" },
    { id: "maintenance_manager", label: "مدير صيانة" },
  ];

  /** 9 lifecycle labels (service-center path) */
  const STATUS = {
    received_at_branch: { label: "تم الاستلام", chip: "s1" },
    in_transit_to_service: { label: "جاري الإرسال", chip: "s2" },
    awaiting_maintenance: { label: "بانتظار الصيانة", chip: "s3" },
    in_maintenance: { label: "جاري الصيانة", chip: "s4" },
    ready_to_return: { label: "جاهز للإرجاع", chip: "s5" },
    awaiting_manager_decision: { label: "معلق لدى المشرف", chip: "s6" },
    in_return_transit: { label: "جاري الإرجاع", chip: "s7" },
    awaiting_customer: { label: "بانتظار التسليم للعميل", chip: "s8" },
    delivered_to_customer: { label: "منتهي", chip: "s9" },
  };

  const ICONS = {
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-5v-5H10v5H5a1 1 0 0 1-1-1z"/></svg>',
    list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/></svg>',
    phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="6" y="3" width="12" height="18" rx="2"/><path d="M10 17h4"/></svg>',
    scan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="4" width="6" height="6"/><rect x="14" y="4" width="6" height="6"/><rect x="4" y="14" width="6" height="6"/><path d="M14 14h2v2h-2zm4 0h2v2h-2zm-4 4h2v2h-2zm4 0h2v2h-2z"/></svg>',
    user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="3.5"/><path d="M5 19a7 7 0 0 1 14 0"/></svg>',
    down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3v12m0 0l-4-4m4 4l4-4"/><path d="M5 19h14"/></svg>',
    truck: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 7h11v8H3z"/><path d="M14 10h4l3 3v2h-7"/><circle cx="7" cy="17" r="1.5"/><circle cx="17" cy="17" r="1.5"/></svg>',
    swap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M8 12h8m0 0l-3-3m3 3l-3 3"/><rect x="3" y="5" width="7" height="14" rx="1.5"/><rect x="14" y="5" width="7" height="14" rx="1.5"/></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 5l7 7-7 7"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>',
  };

  function uid(prefix) {
    return prefix + "-" + Math.random().toString(36).slice(2, 8);
  }

  function defaultState() {
    return {
      role: "branch",
      branchTab: "today",
      screen: "home",
      selectedDeviceIds: [],
      sendMethod: "courier",
      form: { customerName: "", customerPhone: "", deviceName: "", fault: "", notes: "" },
      nextReq: 1048,
      nextDev: 220,
      requests: [
        {
          id: "req-1042",
          number: "SR-1042",
          customerName: "أحمد العتيبي",
          customerPhone: "0501112233",
          notes: "يفضّل التواصل مساءً",
          createdAt: "2026-10-07",
          deviceIds: ["dev-201", "dev-202"],
        },
        {
          id: "req-1045",
          number: "SR-1045",
          customerName: "نورة السبيعي",
          customerPhone: "0559988776",
          notes: "",
          createdAt: "2026-10-08",
          deviceIds: ["dev-205"],
        },
        {
          id: "req-1046",
          number: "SR-1046",
          customerName: "خالد الدوسري",
          customerPhone: "0533344556",
          notes: "جهاز تحت الضمان",
          createdAt: "2026-10-08",
          deviceIds: ["dev-206", "dev-207"],
        },
      ],
      devices: [
        { id: "dev-201", code: "D-201", name: "iPhone 14", fault: "شاشة مكسورة", color: "أسود", status: "received_at_branch", requestId: "req-1042", location: "فرع الصحافة" },
        { id: "dev-202", code: "D-202", name: "Galaxy S23", fault: "لا يشحن", color: "كريمي", status: "in_transit_to_service", requestId: "req-1042", location: "في الطريق" },
        { id: "dev-203", code: "D-203", name: "iPad Air", fault: "لمس لا يعمل", color: "رمادي", status: "awaiting_maintenance", requestId: "req-1038", location: "مركز الصيانة" },
        { id: "dev-204", code: "D-204", name: "MacBook Air", fault: "لوحة مفاتيح", color: "فضي", status: "in_maintenance", requestId: "req-1035", location: "مركز الصيانة", claimedBy: "فني-٢" },
        { id: "dev-205", code: "D-205", name: "iPhone 13", fault: "بطارية ضعيفة", color: "أزرق", status: "received_at_branch", requestId: "req-1045", location: "فرع الصحافة" },
        { id: "dev-206", code: "D-206", name: "Watch Ultra", fault: "شاشة خادشة", color: "تيتانيوم", status: "received_at_branch", requestId: "req-1046", location: "فرع الصحافة" },
        { id: "dev-207", code: "D-207", name: "AirPods Pro", fault: "أيمن لا يعمل", color: "أبيض", status: "received_at_branch", requestId: "req-1046", location: "فرع الصحافة" },
        { id: "dev-208", code: "D-208", name: "Galaxy Tab", fault: "لا يقلع", color: "أسود", status: "ready_to_return", requestId: "req-1020", location: "مركز الصيانة" },
        { id: "dev-209", code: "D-209", name: "iPhone 12", fault: "كاميرا", color: "أخضر", status: "awaiting_manager_decision", requestId: "req-1018", location: "مركز الصيانة", holdReason: "تكلفة صيانة مرتفعة" },
        { id: "dev-210", code: "D-210", name: "Pixel 8", fault: "سماعة", color: "أسود", status: "in_return_transit", requestId: "req-1015", location: "في الطريق للفرع" },
        { id: "dev-211", code: "D-211", name: "iPhone 15", fault: "خلفية مكسورة", color: "وردي", status: "in_return_transit", requestId: "req-1012", location: "في الطريق للفرع" },
        { id: "dev-212", code: "D-212", name: "Galaxy A54", fault: "شاشة", color: "بنفسجي", status: "awaiting_customer", requestId: "req-1008", location: "فرع الصحافة" },
        { id: "dev-213", code: "D-213", name: "iPad Mini", fault: "شحن", color: "فضي", status: "awaiting_customer", requestId: "req-1005", location: "فرع الصحافة" },
        { id: "dev-214", code: "D-214", name: "iPhone SE", fault: "زر هوم", color: "أحمر", status: "delivered_to_customer", requestId: "req-0990", location: "العميل" },
      ],
      receipts: [
        {
          id: "rcpt-1",
          type: "to_service",
          branch: "فرع الصحافة",
          method: "courier",
          status: "pending",
          deviceIds: ["dev-202"],
          createdAt: "2026-10-08 09:20",
        },
        {
          id: "rcpt-2",
          type: "return",
          branch: "فرع الصحافة",
          method: "courier",
          status: "pending",
          deviceIds: ["dev-210", "dev-211"],
          createdAt: "2026-10-08 11:05",
        },
      ],
      decisions: [
        { id: "dec-1", deviceId: "dev-209", reason: "تكلفة صيانة مرتفعة — موافقة العميل؟", status: "pending" },
      ],
      shipments: [
        { id: "ship-1", waybill: "WB-77821", direction: "to_service", deviceCount: 3, status: "in_transit", branch: "فرع النخيل" },
        { id: "ship-2", waybill: "WB-77840", direction: "return", deviceCount: 2, status: "ready", branch: "فرع الصحافة" },
      ],
    };
  }

  let state = loadState();

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      return { ...defaultState(), ...parsed, form: defaultState().form };
    } catch {
      return defaultState();
    }
  }

  function saveState() {
    try {
      const { form, selectedDeviceIds, ...persist } = state;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(persist));
    } catch (_) { /* ignore */ }
  }

  function toast(msg) {
    const el = document.getElementById("toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove("show"), 2200);
  }

  function deviceById(id) {
    return state.devices.find((d) => d.id === id);
  }

  function requestById(id) {
    return state.requests.find((r) => r.id === id);
  }

  function statusChip(status) {
    const s = STATUS[status] || { label: status, chip: "s1" };
    return `<span class="chip ${s.chip}">${s.label}</span>`;
  }

  function countByStatus(statuses) {
    return state.devices.filter((d) => statuses.includes(d.status)).length;
  }

  function setRole(role) {
    state.role = role;
    state.screen = "home";
    state.branchTab = "today";
    state.selectedDeviceIds = [];
    saveState();
    render();
  }

  function go(screen, extras) {
    state.screen = screen;
    if (extras) Object.assign(state, extras);
    render();
  }

  function setTab(tab) {
    state.branchTab = tab;
    state.screen = "home";
    state.selectedDeviceIds = [];
    render();
  }

  function resetDemo() {
    if (!confirm("إعادة تعيين البيانات التجريبية؟")) return;
    localStorage.removeItem(STORAGE_KEY);
    state = defaultState();
    render();
    toast("تمت إعادة التعيين");
  }

  /* ——— Actions ——— */
  function createReceiveRequest() {
    const f = state.form;
    if (!f.customerName.trim() || !f.customerPhone.trim() || !f.deviceName.trim()) {
      toast("أكمل الاسم والجوال واسم الجهاز");
      return;
    }
    const reqId = uid("req");
    const devId = uid("dev");
    const num = state.nextReq++;
    const code = "D-" + state.nextDev++;
    state.requests.unshift({
      id: reqId,
      number: "SR-" + num,
      customerName: f.customerName.trim(),
      customerPhone: f.customerPhone.trim(),
      notes: f.notes.trim(),
      createdAt: new Date().toISOString().slice(0, 10),
      deviceIds: [devId],
    });
    state.devices.unshift({
      id: devId,
      code,
      name: f.deviceName.trim(),
      fault: f.fault.trim() || "عطل غير محدد",
      color: "—",
      status: "received_at_branch",
      requestId: reqId,
      location: "فرع الصحافة",
    });
    state.form = { customerName: "", customerPhone: "", deviceName: "", fault: "", notes: "" };
    saveState();
    go("home");
    state.branchTab = "today";
    toast("تم حفظ الطلب — الجهاز: تم الاستلام");
    render();
  }

  function toggleDeviceSelect(id) {
    const set = new Set(state.selectedDeviceIds);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    state.selectedDeviceIds = [...set];
    render();
  }

  function submitSendToMaintenance() {
    const ids = state.selectedDeviceIds;
    if (!ids.length) {
      toast("اختر جهازاً واحداً على الأقل");
      return;
    }
    const method = state.sendMethod;
    ids.forEach((id) => {
      const d = deviceById(id);
      if (d && d.status === "received_at_branch") {
        d.status = "in_transit_to_service";
        d.location = method === "courier" ? "مع المندوب" : "بوليصة شحن";
      }
    });
    state.receipts.unshift({
      id: uid("rcpt"),
      type: "to_service",
      branch: "فرع الصحافة",
      method,
      status: "pending",
      deviceIds: [...ids],
      createdAt: new Date().toISOString().replace("T", " ").slice(0, 16),
    });
    state.selectedDeviceIds = [];
    saveState();
    go("home");
    toast(method === "courier" ? "أُرسل للمندوب — جاري الإرسال" : "أُنشئت بوليصة — جاري الإرسال");
    render();
  }

  function confirmReturnFromService(deviceId) {
    const d = deviceById(deviceId);
    if (!d || d.status !== "in_return_transit") return;
    d.status = "awaiting_customer";
    d.location = "فرع الصحافة";
    saveState();
    toast("تم استلام الجهاز من الصيانة");
    render();
  }

  function deliverToCustomer(deviceId) {
    const d = deviceById(deviceId);
    if (!d || d.status !== "awaiting_customer") return;
    d.status = "delivered_to_customer";
    d.location = "العميل";
    saveState();
    toast("تم التسليم للعميل — منتهي");
    render();
  }

  function courierDecide(receiptId, approve) {
    const r = state.receipts.find((x) => x.id === receiptId);
    if (!r || r.status !== "pending") return;
    r.status = approve ? "approved" : "rejected";
    if (approve) {
      r.deviceIds.forEach((id) => {
        const d = deviceById(id);
        if (!d) return;
        if (r.type === "to_service") {
          d.status = "awaiting_maintenance";
          d.location = "مركز الصيانة";
        } else if (r.type === "return") {
          d.status = "awaiting_customer";
          d.location = r.branch;
        }
      });
    } else if (r.type === "to_service") {
      r.deviceIds.forEach((id) => {
        const d = deviceById(id);
        if (d) {
          d.status = "received_at_branch";
          d.location = r.branch;
        }
      });
    }
    saveState();
    toast(approve ? "تمت الموافقة" : "تم الرفض");
    render();
  }

  function techClaim(deviceId) {
    const d = deviceById(deviceId);
    if (!d || d.status !== "awaiting_maintenance") return;
    d.status = "in_maintenance";
    d.claimedBy = "أنت (فني تجريبي)";
    saveState();
    toast("تم سحب الجهاز لقائمة عملك");
    render();
  }

  function techComplete(deviceId, ok) {
    const d = deviceById(deviceId);
    if (!d || d.status !== "in_maintenance") return;
    if (ok) {
      d.status = "ready_to_return";
      toast("الجهاز جاهز للإرجاع");
    } else {
      d.status = "awaiting_manager_decision";
      d.holdReason = "تعذّرت الصيانة";
      state.decisions.unshift({
        id: uid("dec"),
        deviceId: d.id,
        reason: "تعذّرت الصيانة — قرار المشرف",
        status: "pending",
      });
      toast("أُحيل للمشرف");
    }
    saveState();
    render();
  }

  function supervisorDecide(decId, approve) {
    const dec = state.decisions.find((d) => d.id === decId);
    if (!dec || dec.status !== "pending") return;
    const device = deviceById(dec.deviceId);
    dec.status = approve ? "approved" : "rejected";
    if (device) {
      if (approve) {
        device.status = "ready_to_return";
        device.holdReason = undefined;
      } else {
        device.status = "awaiting_customer";
        device.location = "فرع الصحافة";
      }
    }
    saveState();
    toast(approve ? "موافق — جاهز للإرجاع" : "رفض الصيانة — بانتظار التسليم");
    render();
  }

  function managerAdvanceShipment(shipId) {
    const s = state.shipments.find((x) => x.id === shipId);
    if (!s) return;
    if (s.status === "ready") s.status = "in_transit";
    else if (s.status === "in_transit") s.status = "delivered";
    saveState();
    toast("تم تحديث حالة الشحنة");
    render();
  }

  function simulateScan() {
    const ready = state.devices.find((d) => d.status === "received_at_branch");
    if (!ready) {
      toast("لا يوجد جهاز جاهز للمسح في الفرع");
      return;
    }
    toast("مسح تجريبي: " + ready.code + " — " + ready.name);
  }

  /* ——— Render helpers ——— */
  function renderRoleSelect() {
    const sel = document.getElementById("roleSelect");
    sel.innerHTML = ROLES.map(
      (r) => `<option value="${r.id}" ${state.role === r.id ? "selected" : ""}>${r.label}</option>`
    ).join("");
  }

  function branchNavItems() {
    return [
      { id: "today", label: "عمل اليوم", icon: "home" },
      { id: "requests", label: "طلباتي", icon: "list" },
      { id: "devices", label: "أجهزتي", icon: "phone" },
      { id: "scan", label: "مسح", icon: "scan" },
      { id: "account", label: "حسابي", icon: "user" },
    ];
  }

  function navActive(itemId) {
    if (state.role === "branch") return state.branchTab === itemId;
    if (itemId === "home") return state.screen === "home";
    return state.screen === itemId;
  }

  function renderNav() {
    const items = state.role === "branch" ? branchNavItems() : roleNavItems();
    const side = document.getElementById("sideNav");
    const bottom = document.getElementById("bottomNav");

    side.innerHTML =
      `<div class="side-brand">ARMS</div>` +
      items
        .map((it) => {
          const activeClass = navActive(it.id) ? "active" : "";
          return `<button type="button" class="side-item ${activeClass}" data-nav="${it.id}">${ICONS[it.icon]}${it.label}</button>`;
        })
        .join("");

    bottom.innerHTML = items
      .map((it) => {
        const activeClass = navActive(it.id) ? "active" : "";
        return `<button type="button" class="nav-item ${activeClass}" data-nav="${it.id}"><div class="dot">${ICONS[it.icon]}</div>${it.label}</button>`;
      })
      .join("");

    document.querySelectorAll("[data-nav]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-nav");
        if (state.role === "branch") setTab(id);
        else go(id);
      });
    });
  }

  function roleNavItems() {
    if (state.role === "pickup_courier") {
      return [
        { id: "home", label: "نماذج الاستلام", icon: "list" },
        { id: "account", label: "حسابي", icon: "user" },
      ];
    }
    if (state.role === "technician") {
      return [
        { id: "home", label: "طابور العمل", icon: "list" },
        { id: "mine", label: "عملي", icon: "phone" },
        { id: "account", label: "حسابي", icon: "user" },
      ];
    }
    if (state.role === "supervisor" || state.role === "maintenance_manager") {
      return [
        { id: "home", label: "لوحة القرار", icon: "home" },
        { id: "shipping", label: "الشحن", icon: "truck" },
        { id: "account", label: "حسابي", icon: "user" },
      ];
    }
    return [{ id: "home", label: "الرئيسية", icon: "home" }];
  }

  function header(title, sub, opts) {
    opts = opts || {};
    const back = opts.back
      ? `<button type="button" class="back-btn" id="btnBack" aria-label="رجوع">${ICONS.back}</button>`
      : "";
    const crumb = opts.crumb
      ? `<div class="crumb">${opts.crumb}</div>`
      : "";
    return `
      ${crumb}
      <div class="screen-header">
        ${back}
        <div class="titles">
          <h1>${title}</h1>
          ${sub ? `<div class="sub">${sub}</div>` : ""}
        </div>
        ${opts.extra || ""}
      </div>`;
  }

  /* ——— Branch screens ——— */
  function renderBranch() {
    if (state.screen === "receive") return renderReceiveForm();
    if (state.screen === "send") return renderSendForm();
    if (state.screen === "fromService") return renderFromService();
    if (state.branchTab === "requests") return renderRequests();
    if (state.branchTab === "devices") return renderDevices();
    if (state.branchTab === "scan") return renderScan();
    if (state.branchTab === "account") return renderAccount("موظف فرع · فرع الصحافة");
    return renderToday();
  }

  function renderToday() {
    const sendCount = countByStatus(["received_at_branch"]);
    const returnCount = countByStatus(["in_return_transit"]);
    const deliverCount = countByStatus(["awaiting_customer"]);
    const branchNow = state.devices.filter((d) =>
      ["received_at_branch", "awaiting_customer", "in_transit_to_service", "in_return_transit"].includes(d.status)
    );

    return `
      ${header("عمل اليوم", "فرع الصحافة")}
      <div class="screen-body">
        <div class="actions grid-3">
          <button type="button" class="action-card" data-go="receive">
            <div class="icon">${ICONS.down}</div>
            <div>
              <div class="text">استلام من العميل</div>
              <div class="hint">إنشاء طلب + أجهزة</div>
            </div>
          </button>
          <button type="button" class="action-card" data-go="send">
            <span class="badge ${sendCount ? "" : "zero"}">${sendCount}</span>
            <div class="icon">${ICONS.truck}</div>
            <div>
              <div class="text">إرسال للصيانة</div>
              <div class="hint">مندوب أو بوليصة</div>
            </div>
          </button>
          <button type="button" class="action-card" data-go="fromService">
            <span class="badge ${returnCount + deliverCount ? "" : "zero"}">${returnCount + deliverCount}</span>
            <div class="icon">${ICONS.swap}</div>
            <div>
              <div class="text">استلام من الصيانة</div>
              <div class="hint">ثم تسليم للعميل · ${returnCount} وارد / ${deliverCount} تسليم</div>
            </div>
          </button>
        </div>
        <section class="section">
          <h2>أجهزة فرعي الآن</h2>
          <div class="list">
            ${
              branchNow.length
                ? branchNow
                    .map(
                      (d) => `
              <div class="list-row">
                <div>
                  <div class="name">${d.name}</div>
                  <div class="meta">${d.code} · ${d.fault}</div>
                </div>
                ${statusChip(d.status)}
              </div>`
                    )
                    .join("")
                : `<div class="empty">لا توجد أجهزة نشطة في الفرع</div>`
            }
          </div>
        </section>
        <section class="section">
          <h2>دورة الحياة (٩ حالات)</h2>
          <div style="display:flex;flex-wrap:wrap;gap:6px">
            ${Object.entries(STATUS)
              .map(([, v]) => `<span class="chip ${v.chip}">${v.label}</span>`)
              .join("")}
          </div>
        </section>
      </div>`;
  }

  function renderReceiveForm() {
    const f = state.form;
    return `
      ${header("استلام للصيانة", "استلام من العميل · فرع الصحافة", {
        back: true,
        crumb: 'عمل اليوم <span class="sep">‹</span> <span class="current">استلام من العميل</span>',
      })}
      <div class="screen-body">
        <div class="panel">
          <div class="panel-head"><h3>بيانات العميل</h3><span class="tag">مطلوب</span></div>
          <div class="row-2">
            <div class="field"><label>الاسم</label><input id="fName" value="${escapeAttr(f.customerName)}" placeholder="اسم العميل" /></div>
            <div class="field"><label>الجوال</label><input id="fPhone" dir="ltr" value="${escapeAttr(f.customerPhone)}" placeholder="05xxxxxxxx" /></div>
          </div>
        </div>
        <div class="panel">
          <div class="panel-head"><h3>الجهاز</h3><span class="tag">مطلوب</span></div>
          <div class="field"><label>اسم الجهاز</label><input id="fDevice" value="${escapeAttr(f.deviceName)}" placeholder="مثال: iPhone 14" /></div>
          <div class="field"><label>وصف العطل</label><input id="fFault" value="${escapeAttr(f.fault)}" placeholder="شاشة مكسورة" /></div>
        </div>
        <div class="panel">
          <div class="panel-head"><h3>ملاحظات</h3><span class="tag opt">اختياري</span></div>
          <div class="field"><label>ملاحظات عامة</label><textarea id="fNotes">${escapeHtml(f.notes)}</textarea></div>
        </div>
        <button type="button" class="cta" id="btnSaveReceive">حفظ الطلب</button>
      </div>`;
  }

  function renderSendForm() {
    const ready = state.devices.filter((d) => d.status === "received_at_branch");
    return `
      ${header("إرسال للصيانة", "اختر الأجهزة وطريقة الإرسال", {
        back: true,
        crumb: 'عمل اليوم <span class="sep">‹</span> <span class="current">إرسال للصيانة</span>',
      })}
      <div class="screen-body">
        <div class="panel">
          <div class="panel-head"><h3>طريقة الإرسال</h3></div>
          <div class="choice-row">
            <button type="button" class="choice ${state.sendMethod === "courier" ? "active" : ""}" data-method="courier">
              مندوب استلام
              <span class="small">نموذج استلام للمندوب</span>
            </button>
            <button type="button" class="choice ${state.sendMethod === "waybill" ? "active" : ""}" data-method="waybill">
              بوليصة شحن
              <span class="small">شحن عبر شركة توصيل</span>
            </button>
          </div>
        </div>
        <div class="panel">
          <div class="panel-head"><h3>أجهزة جاهزة للإرسال (${ready.length})</h3><span class="tag">مطلوب اختيار</span></div>
          ${
            ready.length
              ? ready
                  .map((d) => {
                    const selected = state.selectedDeviceIds.includes(d.id);
                    return `
                <label class="device-pick ${selected ? "selected" : ""}">
                  <input type="checkbox" data-pick="${d.id}" ${selected ? "checked" : ""} />
                  <div class="body">
                    <div class="name">${d.name}</div>
                    <div class="meta">${d.code} · ${d.fault} · طلب ${requestById(d.requestId)?.number || "—"}</div>
                  </div>
                  ${statusChip(d.status)}
                </label>`;
                  })
                  .join("")
              : `<div class="empty">لا توجد أجهزة بحالة «تم الاستلام»</div>`
          }
        </div>
        <button type="button" class="cta" id="btnSend" ${ready.length ? "" : "disabled"}>
          تأكيد الإرسال (${state.selectedDeviceIds.length})
        </button>
      </div>`;
  }

  function renderFromService() {
    const incoming = state.devices.filter((d) => d.status === "in_return_transit");
    const deliver = state.devices.filter((d) => d.status === "awaiting_customer");
    return `
      ${header("استلام من الصيانة", "تأكيد الوارد ثم التسليم للعميل", {
        back: true,
        crumb: 'عمل اليوم <span class="sep">‹</span> <span class="current">استلام من الصيانة</span>',
      })}
      <div class="screen-body">
        <div class="stats">
          <div class="stat"><div class="n">${incoming.length}</div><div class="l">وارد من الصيانة</div></div>
          <div class="stat"><div class="n">${deliver.length}</div><div class="l">جاهز للتسليم</div></div>
          <div class="stat"><div class="n">${countByStatus(["delivered_to_customer"])}</div><div class="l">منتهي</div></div>
        </div>
        <section class="section" style="margin-top:0">
          <h2>١) تأكيد استلام من الصيانة</h2>
          ${
            incoming.length
              ? incoming
                  .map(
                    (d) => `
            <div class="card-item">
              <div class="top">
                <div>
                  <div class="title">${d.name}</div>
                  <div class="detail">${d.code} · ${d.location}</div>
                </div>
                ${statusChip(d.status)}
              </div>
              <button type="button" class="cta" data-confirm-return="${d.id}">تأكيد الاستلام بالفرع</button>
            </div>`
                  )
                  .join("")
              : `<div class="empty">لا أجهزة في «جاري الإرجاع»</div>`
          }
        </section>
        <section class="section">
          <h2>٢) تسليم للعميل</h2>
          ${
            deliver.length
              ? deliver
                  .map(
                    (d) => `
            <div class="card-item">
              <div class="top">
                <div>
                  <div class="title">${d.name}</div>
                  <div class="detail">${d.code} · ${requestById(d.requestId)?.customerName || "عميل"}</div>
                </div>
                ${statusChip(d.status)}
              </div>
              <button type="button" class="cta" data-deliver="${d.id}">تسليم للعميل</button>
            </div>`
                  )
                  .join("")
              : `<div class="empty">لا أجهزة بانتظار التسليم</div>`
          }
        </section>
      </div>`;
  }

  function renderRequests() {
    return `
      ${header("طلباتي", "فرع الصحافة")}
      <div class="screen-body">
        <div class="list">
          ${state.requests
            .map((r) => {
              const devs = r.deviceIds.map(deviceById).filter(Boolean);
              return `
              <div class="list-row" style="flex-direction:column;align-items:stretch;gap:8px">
                <div style="display:flex;justify-content:space-between;gap:8px">
                  <div>
                    <div class="name">${r.number} · ${r.customerName}</div>
                    <div class="meta">${r.customerPhone} · ${r.createdAt} · ${devs.length} جهاز</div>
                  </div>
                </div>
                <div style="display:flex;flex-wrap:wrap;gap:6px">
                  ${devs.map((d) => statusChip(d.status)).join("")}
                </div>
              </div>`;
            })
            .join("")}
        </div>
      </div>`;
  }

  function renderDevices() {
    const active = state.devices.filter((d) => d.status !== "delivered_to_customer");
    return `
      ${header("أجهزتي", `${active.length} جهاز نشط`)}
      <div class="screen-body">
        <div class="list">
          ${active
            .map(
              (d) => `
            <div class="list-row">
              <div>
                <div class="name">${d.name}</div>
                <div class="meta">${d.code} · ${d.location} · ${d.fault}</div>
              </div>
              ${statusChip(d.status)}
            </div>`
            )
            .join("")}
        </div>
      </div>`;
  }

  function renderScan() {
    return `
      ${header("مسح", "مسح QR تجريبي")}
      <div class="screen-body">
        <div class="scan-box">
          ${ICONS.scan}
          <strong>محاكاة الماسح</strong>
          <p>في النظام الحقيقي يُفتح الكاميرا. هنا زر يعرض جهازاً تجريبياً.</p>
          <button type="button" class="cta" id="btnScan" style="max-width:240px;margin:14px auto 0">مسح تجريبي</button>
        </div>
      </div>`;
  }

  function renderAccount(subtitle) {
    const roleLabel = ROLES.find((r) => r.id === state.role)?.label || "";
    return `
      ${header("حسابي", subtitle || roleLabel)}
      <div class="screen-body">
        <div class="panel">
          <div class="panel-head"><h3>الجلسة التجريبية</h3></div>
          <p class="detail" style="font-size:0.85rem;font-weight:600;color:var(--ink-soft);margin-bottom:12px">
            الدور الحالي: <strong style="color:var(--ink)">${roleLabel}</strong><br/>
            البيانات تُحفظ محلياً في المتصفح (localStorage).
          </p>
          <button type="button" class="cta secondary" id="btnReset">إعادة تعيين البيانات التجريبية</button>
        </div>
        <div class="panel">
          <div class="panel-head"><h3>تلميح</h3></div>
          <p style="font-size:0.82rem;font-weight:600;color:var(--ink-soft)">
            بدّل الدور من القائمة أعلى الصفحة لتجربة المندوب، الفني، المشرف، أو مدير الصيانة.
          </p>
        </div>
      </div>`;
  }

  /* ——— Other roles ——— */
  function renderCourier() {
    if (state.screen === "account") return renderAccount("مندوب استلام");
    const pending = state.receipts.filter((r) => r.status === "pending");
    return `
      ${header("نماذج الاستلام", `${pending.length} بانتظار الموافقة`)}
      <div class="screen-body">
        ${
          pending.length
            ? pending
                .map((r) => {
                  const names = r.deviceIds.map((id) => deviceById(id)?.name || id).join("، ");
                  return `
              <div class="card-item">
                <div class="top">
                  <div>
                    <div class="title">${r.type === "to_service" ? "إرسال للصيانة" : "إرجاع للفرع"}</div>
                    <div class="detail">${r.branch} · ${r.method === "courier" ? "مندوب" : "بوليصة"} · ${r.createdAt}</div>
                    <div class="detail" style="margin-top:4px">${names}</div>
                  </div>
                  <span class="chip s6">معلّق</span>
                </div>
                <div class="cta-row">
                  <button type="button" class="cta" data-courier-ok="${r.id}">موافقة</button>
                  <button type="button" class="cta danger" data-courier-no="${r.id}">رفض</button>
                </div>
              </div>`;
                })
                .join("")
            : `<div class="empty">لا نماذج معلّقة — جرّب إرسال أجهزة من دور موظف الفرع</div>`
        }
        <div class="section">
          <h2>سجل النماذج</h2>
          <div class="list">
            ${state.receipts
              .map(
                (r) => `
              <div class="list-row">
                <div>
                  <div class="name">${r.type === "to_service" ? "إرسال" : "إرجاع"} · ${r.branch}</div>
                  <div class="meta">${r.deviceIds.length} جهاز · ${r.createdAt}</div>
                </div>
                <span class="chip ${r.status === "pending" ? "s6" : r.status === "approved" ? "s5" : "s1"}">
                  ${r.status === "pending" ? "معلّق" : r.status === "approved" ? "موافق" : "مرفوض"}
                </span>
              </div>`
              )
              .join("")}
          </div>
        </div>
      </div>`;
  }

  function renderTechnician() {
    if (state.screen === "account") return renderAccount("فني صيانة");
    if (state.screen === "mine") {
      const mine = state.devices.filter((d) => d.status === "in_maintenance");
      return `
        ${header("عملي", `${mine.length} جهاز مسحوب`)}
        <div class="screen-body">
          ${
            mine.length
              ? mine
                  .map(
                    (d) => `
              <div class="card-item">
                <div class="top">
                  <div>
                    <div class="title">${d.name}</div>
                    <div class="detail">${d.code} · ${d.fault}</div>
                  </div>
                  ${statusChip(d.status)}
                </div>
                <div class="cta-row">
                  <button type="button" class="cta" data-tech-done="${d.id}">اكتملت الصيانة</button>
                  <button type="button" class="cta danger" data-tech-fail="${d.id}">تعذّرت</button>
                </div>
              </div>`
                  )
                  .join("")
              : `<div class="empty">لا أجهزة في عملك — اسحب من الطابور</div>`
          }
        </div>`;
    }
    const queue = state.devices.filter((d) => d.status === "awaiting_maintenance");
    return `
      ${header("طابور الصيانة", `${queue.length} بانتظار الفني`)}
      <div class="screen-body">
        ${
          queue.length
            ? queue
                .map(
                  (d) => `
            <div class="card-item">
              <div class="top">
                <div>
                  <div class="title">${d.name}</div>
                  <div class="detail">${d.code} · ${d.fault} · ${d.location}</div>
                </div>
                ${statusChip(d.status)}
              </div>
              <button type="button" class="cta" data-tech-claim="${d.id}">سحب للجهاز</button>
            </div>`
                )
                .join("")
            : `<div class="empty">الطابور فارغ — وافق على نموذج مندوب من دور المندوب بعد إرسال الفرع</div>`
        }
      </div>`;
  }

  function renderSupervisorLike(isManager) {
    if (state.screen === "account") {
      return renderAccount(isManager ? "مدير صيانة" : "مشرف صيانة");
    }
    if (state.screen === "shipping") {
      return `
        ${header("الشحن", "أقسام مبسّطة")}
        <div class="screen-body">
          ${state.shipments
            .map(
              (s) => `
            <div class="card-item">
              <div class="top">
                <div>
                  <div class="title">${s.waybill}</div>
                  <div class="detail">${s.branch} · ${s.direction === "to_service" ? "إلى الصيانة" : "إرجاع"} · ${s.deviceCount} جهاز</div>
                </div>
                <span class="chip ${s.status === "delivered" ? "s9" : s.status === "in_transit" ? "s2" : "s5"}">
                  ${s.status === "delivered" ? "مسلّمة" : s.status === "in_transit" ? "في الطريق" : "جاهزة"}
                </span>
              </div>
              ${
                s.status !== "delivered"
                  ? `<button type="button" class="cta secondary" data-ship="${s.id}">تحديث الحالة</button>`
                  : ""
              }
            </div>`
            )
            .join("")}
        </div>`;
    }

    const pending = state.decisions.filter((d) => d.status === "pending");
    const holds = state.devices.filter((d) => d.status === "awaiting_manager_decision");
    const readyReturn = countByStatus(["ready_to_return"]);

    return `
      ${header(isManager ? "لوحة مدير الصيانة" : "لوحة المشرف", "قرارات معلّقة وشحن")}
      <div class="screen-body">
        <div class="stats">
          <div class="stat"><div class="n">${pending.length}</div><div class="l">قرارات معلّقة</div></div>
          <div class="stat"><div class="n">${readyReturn}</div><div class="l">جاهز للإرجاع</div></div>
          <div class="stat"><div class="n">${state.shipments.filter((s) => s.status !== "delivered").length}</div><div class="l">شحنات نشطة</div></div>
        </div>
        <section class="section" style="margin-top:4px">
          <h2>قرارات معلّقة</h2>
          ${
            pending.length
              ? pending
                  .map((dec) => {
                    const d = deviceById(dec.deviceId);
                    return `
                <div class="card-item">
                  <div class="top">
                    <div>
                      <div class="title">${d ? d.name : dec.deviceId}</div>
                      <div class="detail">${dec.reason}</div>
                    </div>
                    ${d ? statusChip(d.status) : ""}
                  </div>
                  <div class="cta-row">
                    <button type="button" class="cta" data-dec-ok="${dec.id}">موافقة إرجاع</button>
                    <button type="button" class="cta danger" data-dec-no="${dec.id}">إغلاق / تسليم</button>
                  </div>
                </div>`;
                  })
                  .join("")
              : `<div class="empty">لا قرارات معلّقة — من دور الفني اختر «تعذّرت» لإنشاء قرار</div>`
          }
        </section>
        ${
          isManager
            ? `<section class="section">
            <h2>أجهزة معلّقة لدى المشرف</h2>
            <div class="list">
              ${
                holds.length
                  ? holds
                      .map(
                        (d) => `
                <div class="list-row">
                  <div>
                    <div class="name">${d.name}</div>
                    <div class="meta">${d.holdReason || "—"}</div>
                  </div>
                  ${statusChip(d.status)}
                </div>`
                      )
                      .join("")
                  : `<div class="empty">لا أجهزة معلّقة</div>`
              }
            </div>
          </section>`
            : ""
        }
      </div>`;
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
  function escapeAttr(s) {
    return escapeHtml(s).replace(/"/g, "&quot;");
  }

  function bindCommon() {
    const back = document.getElementById("btnBack");
    if (back) back.addEventListener("click", () => go("home"));

    document.querySelectorAll("[data-go]").forEach((el) => {
      el.addEventListener("click", () => go(el.getAttribute("data-go")));
    });

    document.querySelectorAll("[data-method]").forEach((el) => {
      el.addEventListener("click", () => {
        state.sendMethod = el.getAttribute("data-method");
        render();
      });
    });

    document.querySelectorAll("[data-pick]").forEach((el) => {
      el.addEventListener("change", () => toggleDeviceSelect(el.getAttribute("data-pick")));
    });

    const saveRecv = document.getElementById("btnSaveReceive");
    if (saveRecv) {
      saveRecv.addEventListener("click", () => {
        state.form = {
          customerName: document.getElementById("fName").value,
          customerPhone: document.getElementById("fPhone").value,
          deviceName: document.getElementById("fDevice").value,
          fault: document.getElementById("fFault").value,
          notes: document.getElementById("fNotes").value,
        };
        createReceiveRequest();
      });
    }

    const btnSend = document.getElementById("btnSend");
    if (btnSend) btnSend.addEventListener("click", submitSendToMaintenance);

    document.querySelectorAll("[data-confirm-return]").forEach((el) => {
      el.addEventListener("click", () => confirmReturnFromService(el.getAttribute("data-confirm-return")));
    });
    document.querySelectorAll("[data-deliver]").forEach((el) => {
      el.addEventListener("click", () => deliverToCustomer(el.getAttribute("data-deliver")));
    });

    const btnScan = document.getElementById("btnScan");
    if (btnScan) btnScan.addEventListener("click", simulateScan);

    const btnReset = document.getElementById("btnReset");
    if (btnReset) btnReset.addEventListener("click", resetDemo);

    document.querySelectorAll("[data-courier-ok]").forEach((el) => {
      el.addEventListener("click", () => courierDecide(el.getAttribute("data-courier-ok"), true));
    });
    document.querySelectorAll("[data-courier-no]").forEach((el) => {
      el.addEventListener("click", () => courierDecide(el.getAttribute("data-courier-no"), false));
    });

    document.querySelectorAll("[data-tech-claim]").forEach((el) => {
      el.addEventListener("click", () => techClaim(el.getAttribute("data-tech-claim")));
    });
    document.querySelectorAll("[data-tech-done]").forEach((el) => {
      el.addEventListener("click", () => techComplete(el.getAttribute("data-tech-done"), true));
    });
    document.querySelectorAll("[data-tech-fail]").forEach((el) => {
      el.addEventListener("click", () => techComplete(el.getAttribute("data-tech-fail"), false));
    });

    document.querySelectorAll("[data-dec-ok]").forEach((el) => {
      el.addEventListener("click", () => supervisorDecide(el.getAttribute("data-dec-ok"), true));
    });
    document.querySelectorAll("[data-dec-no]").forEach((el) => {
      el.addEventListener("click", () => supervisorDecide(el.getAttribute("data-dec-no"), false));
    });

    document.querySelectorAll("[data-ship]").forEach((el) => {
      el.addEventListener("click", () => managerAdvanceShipment(el.getAttribute("data-ship")));
    });
  }

  function renderMain() {
    const root = document.getElementById("mainPanel");
    let html = "";
    if (state.role === "branch") html = renderBranch();
    else if (state.role === "pickup_courier") html = renderCourier();
    else if (state.role === "technician") html = renderTechnician();
    else if (state.role === "supervisor") html = renderSupervisorLike(false);
    else if (state.role === "maintenance_manager") html = renderSupervisorLike(true);
    else html = `<div class="screen-body"><div class="empty">دور غير معروف</div></div>`;
    root.innerHTML = html;
    bindCommon();
  }

  function render() {
    const roleMeta = document.getElementById("roleMeta");
    const role = ROLES.find((r) => r.id === state.role);
    roleMeta.textContent = role ? role.label + (state.role === "branch" ? " · فرع الصحافة" : "") : "";
    renderRoleSelect();
    renderNav();
    renderMain();
  }

  // init
  document.getElementById("roleSelect").addEventListener("change", (e) => setRole(e.target.value));
  document.getElementById("btnResetTop").addEventListener("click", resetDemo);
  render();
})();
