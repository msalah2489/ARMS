# Supabase + GitHub Pages (ARMS)

## What goes to Supabase vs localStorage

### Synced via Supabase (`arms_client_store`)
- Ops branches (admin branches CRUD)
- Maintenance / service requests + devices (branch receiving workflow)
- Device catalog (types / brands / models)
- Managed users + passwords (`managed_users`) — same plaintext model as before (not hashed)
- Shipping batches (`shipping_batches`) + ops audit events (`audit_events`)
- Technician work records (`technician_work`)
- Spare inventory balances / receipts / movements (`spare_inventory`)
- Legacy waybills UI state (`waybills`)

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

## Where maintenance / service requests live

Do **not** look at the classic CRM table `service_requests` (often empty).

Open Supabase → **Table Editor** → **`arms_client_store`** → row `store_key` = **`maintenance_requests`**. The JSON `payload` array holds the `SR-…` requests.

## Verify

1. Open https://msalah2489.github.io/ARMS/
2. Sign in (e.g. `admin` / `demo` or `branch@arms.local` / `demo`)
3. If a yellow sync banner appears, fix the anon JWT secret and redeploy — local-only rows are not in the database yet
4. Change shared data: create a maintenance request, user, shipping batch, technician work, or spare receive
5. In Supabase → **Table Editor** → `arms_client_store` → confirm `maintenance_requests` (and related keys) updated
6. Open the site in another browser / device → same ops data after load
7. Change language or theme → stays on that device only (not in Supabase)
