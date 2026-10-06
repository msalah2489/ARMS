# Supabase + GitHub Pages (ARMS)

## What goes to Supabase vs localStorage

### Synced via Supabase (`arms_client_store` + mirrored `app_*` tables)
The live app still **reads/writes** shared ops data as JSON rows in **`arms_client_store`** (one row per store key). After each successful push/hydrate, the client also calls SQL RPCs to **mirror** that JSON into normalized **`app_*`** tables so Table Editor shows normal columns/rows.

| Store key | Relational tables / views |
| --- | --- |
| `managed_users` | `app_users` + view `v_app_users` (no password) |
| `ops_branches` | `app_ops_branches` |
| `maintenance_requests` | `app_maintenance_requests`, `app_request_devices` + views `v_app_maintenance_overview`, `v_app_request_devices` |
| `device_catalog` | `app_catalog_device_types`, `app_catalog_brands`, `app_catalog_models` |
| `shipping_batches` | `app_shipping_batches`, `app_shipping_items` |
| `technician_work` | `app_technician_work` |
| `spare_inventory` | `app_spare_balances` |
| `audit_events` | `app_audit_events` |
| `waybills` | `app_waybills` |

Service Requests (`طلبات الصيانة`) always read the ops cache of `arms_client_store` → key **`maintenance_requests`** after hydrate. They do **not** use the classic CRM table `service_requests` (that table is often empty / unused on Pages).

### Stays localStorage-only
- Theme (`arms_theme`) and language/locale (`arms_locale`)
- Current browser session (`arms_session`)

### Auth / RLS note
- Managed users (including passwords) are stored as JSON in `arms_client_store` and readable/writable with the **anon** key under the starter Pages policies.
- That is **weak** for production: anyone with the anon key can read user payloads. Acceptable only for this static-export prototype; tighten with real Auth + RLS before production.
- Password handling matches the existing app (plaintext comparison today) — not made worse, not upgraded to hashing in this pass.

## One-time setup in Supabase

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project.
2. **SQL Editor**:
   - **New project / never ran sync:** paste and run **`supabase/migrations/000_apply_all_for_pages.sql`** once.
   - **Already ran `000` or `007` earlier:** run **`supabase/migrations/008_extend_client_store_keys.sql`** once (adds the new store keys only). Safe to re-run.
   - **Cleanup old CRM / demo / unused relational workflow** (optional, after sync works): run **`supabase/migrations/009_cleanup_old_database.sql`** once. Empties classic CRM seed and drops obsolete waybill/shipping/maintenance **tables** from older migrations. Does **not** wipe live `arms_client_store` payloads. Safe to re-run.
   - **جداول مرتّبة (موصى به الآن):** شغّل مرة **`supabase/migrations/013_normalized_app_tables.sql`**. ينشئ جداول `app_*` وينسخ بيانات JSON الحالية إليها. Safe to re-run.
   - **حذف الجداول غير المستخدمة (موصى به لتنظيف Table Editor):** شغّل مرة **`supabase/migrations/015_drop_unused_tables.sql`**. يحذف CRM الكلاسيكي + `ops_branches` العلائقي + `profiles` إن وُجدت. **لا يمس** `arms_client_store` ولا `app_*`. Safe to re-run.
3. **Project Settings → API**:
   - copy **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - copy the long JWT **anon public** / **anon** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - The key **must** start with `eyJ` and be ~200+ characters (three JWT segments).
   - Do **not** use short `sb_publishable_…` placeholders — the API returns **401 Invalid API key** and the UI will keep browser-only data until a real JWT is set.

> Optional later: run `002`…`006` only if you need the **relational** shipping/workflow RPCs (not used by the GitHub Pages client-store path). Prefer `009_cleanup_old_database.sql` instead if you already migrated to `arms_client_store`.
> The one-shot file adds starter RLS policies allowing `anon` read/write on the sync table and core CRM tables so the static GitHub Pages build can work without server-side Auth. Tighten policies later for production security.

## Local `.env.local`

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
NEXT_PUBLIC_USE_DEMO=false
```

## GitHub Actions (Pages build)

Repo → **Settings → Secrets and variables → Actions**:

| Name | Type | Required | Purpose |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Secret **or** Variable | Yes (when demo is off) | Classic anon JWT (`eyJ…`, length ≥ 100). Build **fails** if missing/invalid — no short-key fallback. |
| `NEXT_PUBLIC_SUPABASE_URL` | Secret **or** Variable | Optional | Defaults to the project URL already used by this repo |
| `NEXT_PUBLIC_USE_DEMO` | Variable | Optional | Set to `true` only for sample-data builds; default `false` |

After setting secrets, re-run **Deploy GitHub Pages** (push to `main` or **Actions → workflow_dispatch**). Wait 1–3 minutes for Pages to update.

## جداول مرتّبة (Table Editor) — بعد تشغيل 013

### لماذا كانت البيانات JSON؟

منصة GitHub Pages تحتاج مزامنة بسيطة بدون سيرفر: جدول واحد `arms_client_store` يحفظ كل نوع بيانات كـ JSON. التطبيق ما زال يعتمد عليه كمصدر حي — والجداول الجديدة **مرآة** للتصفح والتفاصيل الواضحة.

### أين تنظر الآن (موصى به)

1. Supabase → **Table Editor**
2. افتح أحد الجداول:
   - **`v_app_users`** أو **`app_users`** — المستخدمون (الـ VIEW بدون كلمة مرور)
   - **`app_ops_branches`** — الفروع
   - **`v_app_maintenance_overview`** أو **`app_maintenance_requests`** — طلبات الصيانة
   - **`v_app_request_devices`** أو **`app_request_devices`** — أجهزة الطلبات
   - **`app_catalog_brands` / `app_catalog_models`** — الكتالوج
   - **`app_shipping_batches` / `app_shipping_items`** — الشحن
   - **`app_technician_work`** — عمل الفني
   - **`app_spare_balances`** — مخزون القطع

### ملف SQL واحد مطلوب

شغّل مرة: **`supabase/migrations/013_normalized_app_tables.sql`**

بعدها أي تعديل من المنصة يحدّث JSON **و** الجداول العلائقية تلقائياً (dual-write).

Do **not** look at classic CRM `service_requests` / `profiles` — after **`015_drop_unused_tables.sql`** those tables should be gone from Table Editor.

## Verify

1. Run **`013_normalized_app_tables.sql`** once in SQL Editor
2. Open https://msalah2489.github.io/ARMS/
3. Sign in (e.g. `admin` / `demo` or `branch@arms.local` / `demo`)
4. If a yellow sync banner appears, fix the anon JWT secret and redeploy
5. Change shared data: create a maintenance request, user, shipping batch, etc.
6. In Supabase → **Table Editor** → open **`app_maintenance_requests`** / **`v_app_users`** — rows/columns (not giant JSON)
7. Open the site in another browser / device → same ops data after load
8. Change language or theme → stays on that device only (not in Supabase)
