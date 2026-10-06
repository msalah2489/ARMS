# Supabase + GitHub Pages (ARMS)

## What goes to Supabase vs localStorage

### Synced via Supabase (`arms_client_store`)
- Ops branches (admin branches CRUD)
- Maintenance / service requests + devices (branch receiving workflow)
- Device catalog (types / brands / models)

Dashboard CRM lists (customers, branches, devices, service requests) prefer this ops data after hydrate. If empty, they fall back to classic CRM tables (`customers`, `branches`, `devices`, `service_requests`).

### Still localStorage-only (for now)
- Managed users / passwords (`users-store`)
- Shipping batches UI state (`shipping-store`) beyond what is mirrored through request device updates
- Technician work scratch records (`technician-store`) except device lifecycle patches (those persist with requests)
- Spare inventory balances (`spare-inventory-store`)
- Theme / locale preferences

### Auth
- Local managed users (`admin@arms.local` / `demo`, etc.) still work on Pages.
- When `NEXT_PUBLIC_USE_DEMO=false` and no local match, login tries Supabase Auth.

## One-time setup in Supabase

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project.
2. **SQL Editor** → paste and run **once**:
   - **`supabase/migrations/000_apply_all_for_pages.sql`**
   - This creates missing CRM tables + `ops_branches` + `arms_client_store` and anon RLS policies.
   - Safe to re-run. Ignore any earlier error from running `007` alone (`ops_branches` missing).
3. **Project Settings → API**:
   - copy **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - copy **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

> Optional later: run `002`…`006` if you need full shipping/workflow RPCs beyond Pages sync.
> The one-shot file adds starter RLS policies allowing `anon` read/write on the sync table and core CRM tables so the static GitHub Pages build can work without server-side Auth. Tighten policies later for production security.

## Local `.env.local`

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_USE_DEMO=false
```

## GitHub Actions (Pages build)

Repo → **Settings → Secrets and variables → Actions**:

| Name | Type | Required | Purpose |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Secret **or** Variable | Yes (when demo is off) | Anon/public API key baked into the static build |
| `NEXT_PUBLIC_SUPABASE_URL` | Secret **or** Variable | Optional | Defaults to the project URL already used by this repo |
| `NEXT_PUBLIC_USE_DEMO` | Variable | Optional | Set to `true` only for sample-data builds; default `false` |

After setting secrets, re-run **Deploy GitHub Pages** (push to `main` or **Actions → workflow_dispatch**). Wait 1–3 minutes for Pages to update.

## Verify

1. Open https://msalah2489.github.io/ARMS/dashboard/
2. Sign in (e.g. `branch@arms.local` / `demo`)
3. Create a maintenance request or admin branch
4. In Supabase → **Table Editor** → `arms_client_store` → confirm `payload` updated
5. Open the site in another browser / device → same data appears after load
