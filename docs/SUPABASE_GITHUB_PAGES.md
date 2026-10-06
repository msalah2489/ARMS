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

Dashboard CRM lists prefer ops data after hydrate. If empty, they fall back to classic CRM tables.

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

1. Open https://msalah2489.github.io/ARMS/
2. Sign in (e.g. `admin` / `demo` or `branch@arms.local` / `demo`)
3. Change shared data: create a user, shipping batch, technician work, or spare receive
4. In Supabase → **Table Editor** → `arms_client_store` → confirm keys like `managed_users`, `shipping_batches`, `technician_work`, `spare_inventory` updated
5. Open the site in another browser / device → same ops data after load
6. Change language or theme → stays on that device only (not in Supabase)
