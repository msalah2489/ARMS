# ARMS — Aromatic Maintenance Service

Maintenance lifecycle for aroma and scent-diffusion devices: customers, branches, devices, service requests, technicians, spare parts, service centers, movements, receipts, and history.

## Stack

- Next.js (App Router) + TypeScript + Tailwind
- Supabase (Postgres, Auth, Storage, RLS) — schema in `supabase/migrations/001_init.sql`
- Demo mode so the UI can be used before a Supabase project is connected

## Run locally

Node.js 20+ is required. It is not currently installed on this machine. After installing the LTS build from [nodejs.org](https://nodejs.org/) or with `winget install OpenJS.NodeJS.LTS`:

```powershell
cd C:\Users\user\ARMS
copy .env.example .env.local
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Demo logins (password `demo`)

| Role | Email |
| --- | --- |
| Manager | manager@arms.local |
| Supervisor | supervisor@arms.local |
| Technician | tech@arms.local |
| Branch employee | branch@arms.local |
| Service center | center@arms.local |

The sidebar changes with the role.

## Connect Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Put the project URL and anon key in `.env.local`.
3. Run `supabase/migrations/001_init.sql` in the SQL editor.
4. Set `NEXT_PUBLIC_USE_DEMO=false`.
5. Create Auth users whose `user_metadata.role` is one of: `manager`, `supervisor`, `technician`, `branch_employee`, `service_center_employee`.

## First slice vs later work

Shipped in this starter:

- Role workspaces and navigation
- Dashboard, service requests, devices, customers, branches
- Device scan by serial / QR payload
- Movements and customer receipt numbers
- Spare parts and a reports shell
- Postgres schema for the full domain (including history, dispatches, attachments, notifications, inventory)

Next implementation steps: live Supabase CRUD, RLS-tuned writes per role, technician inspection forms, spare-part usage posting, receipt documents in Storage, Excel export, and real camera scan.
