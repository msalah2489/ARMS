# Customer Service feature (خدمة العملاء) — isolatable slice

**English + Arabic.** This documents the first CS slice so it can be removed without touching shipping, delays, notifications, technician flows, etc.

## What this slice includes / ما تتضمنه هذه الشريحة

- Role: `customer_service` (خدمة العملاء)
- Demo login (demo mode / seed users): username `cs` / email `cs@arms.local`, password `demo`
- Login page shortcut: button **خدمة العملاء** on `/login` fills `cs` / `demo` (see `src/app/login/page.tsx`)
- Home: `/customer-service`
- Diagnostic wizard: `/customer-service/diagnostic` — complaint «الجهاز لا يعمل» with probability %
- Data-driven tree under `src/lib/cs-diagnostic/`
- Optional flag: `NEXT_PUBLIC_CS_DIAGNOSTIC` (default **on**; set `0` / `false` / `off` to hide wizard)

## Files that belong to CS / الملفات الخاصة بالخدمة

**Own folders (delete entirely):**

- `src/lib/cs-diagnostic/`
- `src/components/customer-service/`
- `src/app/(app)/customer-service/`
- `docs/CUSTOMER_SERVICE_FEATURE.md` (this file)

**Shared files with small `// CS-FEATURE` edits (revert those hunks only):**

- `src/types/domain.ts` — role in `AppRole` + `AssignableUserRole`
- `src/lib/auth.ts` — label, demo user, `homePathForRole`
- `src/lib/permissions.ts` — default permissions for the role
- `src/lib/users-store.ts` — assignable label + seed user
- `src/lib/nav.ts` — CS nav lane
- `src/lib/i18n/messages.ts` — `nav.csDiagnostic` (ar + en)
- `src/app/login/page.tsx` — خدمة العملاء login shortcut button
- `.env.example` — `NEXT_PUBLIC_CS_DIAGNOSTIC` line (optional)

## How to remove completely / كيفية الإزالة بالكامل (5–10 steps)

1. Delete folder `src/lib/cs-diagnostic/`
2. Delete folder `src/components/customer-service/`
3. Delete folder `src/app/(app)/customer-service/`
4. In shared files, search for `CS-FEATURE` and remove those marked lines/blocks (role union entries, demo user, nav lane, i18n keys, seed user, permissions entry, login shortcut).
5. Remove `customer_service` from `AppRole` and `AssignableUserRole` in `src/types/domain.ts`.
6. Remove CS demo/seed user (`cs` / `cs@arms.local`) from `src/lib/auth.ts` and `src/lib/users-store.ts`.
7. Remove `CUSTOMER_SERVICE_NAV` / `customer_service` branch from `src/lib/nav.ts` and `navForRole`.
8. Remove `nav.csDiagnostic` from `src/lib/i18n/messages.ts` (Arabic + English objects).
9. Optional: remove `NEXT_PUBLIC_CS_DIAGNOSTIC` from `.env.example` / CI env.
10. Delete this doc. Run TypeScript/build to confirm nothing still imports CS paths.

If a managed user with role `customer_service` already exists in Supabase, archive or reassign that user in Admin → Users after removing the role from the app.

## Not included yet / غير مضمّن بعد

- Full ticket / service-request integration
- Images or video guides
- WhatsApp / telephony integration
- CRM history or call logging
- Production secrets (demo password only: `demo`)
