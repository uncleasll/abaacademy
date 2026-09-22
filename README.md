# ABA Academy USA Operations

React/TypeScript frontend on Vercel; FastAPI backend on Render; existing Supabase PostgreSQL for production.

## Approved staff access

Only these eight portal accounts are permitted:

| Email | Role |
| --- | --- |
| firuz@abacademypa.com | Teacher |
| adhamjon@abacademypa.com | Teacher |
| behzodjon@abacademypa.com | Teacher |
| abdulquddus@abacademypa.com | Teacher |
| abdulwahid@abacademypa.com | Teacher |
| admin@abacademypa.com | IT Admin |
| accounting@abacademypa.com | Finance |
| support@abacademypa.com | Registration |

Other accounts and their sessions are denied. Startup deactivates legacy accounts
without deleting students, classes, finance records, or other business data.
The portal cannot create extra accounts or delete the eight approved accounts.
The administrator can activate/deactivate approved staff, but cannot deactivate itself.

Each account receives a unique temporary password and must replace it before accessing
academy data. The topbar's **Change password** action remains available afterward.
New passwords require 12–128 characters and the current password. Password changes
and access-status changes revoke older sessions. Changes persist in the database;
restarting the server never restores a bootstrap password.

## Local setup

```sh
npm ci
python3 -m venv backend/.venv
backend/.venv/bin/python -m pip install -r backend/requirements.txt
cd backend
.venv/bin/python -m app.provision_teachers
.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

In a second terminal, run `npm run dev`. Set `VITE_API_BASE_URL=http://127.0.0.1:8000`
in a local `.env` file if necessary. No demo accounts are shown or seeded on startup.

Provisioning creates/preserves these owner-only, Git-ignored files:

- `backend/private/teacher-credentials.txt`: initial private password handoff for all eight staff.
- `backend/private/teachers-bootstrap.json`: password hashes for initializing production.

Share each credential privately. These are portal passwords, not email mailbox passwords.
Existing passwords are preserved; a credential file does not reset an existing account.

## Production deployment

The existing frontend is `https://abaacademy.vercel.app` and its backend is
`https://abaacademy.onrender.com`. Publishing frontend changes alone does not update
Render or provision its database. Verify both deployments before handing out logins.

Configure the existing Render service with:

- Repository `https://github.com/uncleasll/abaacademy`, branch `main`, root `backend`.
- Build command `pip install -r requirements.txt`.
- Start command `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
- `APP_ENV=production`.
- `DATABASE_URL`: the persistent production PostgreSQL connection URL.
- `JWT_SECRET`: a random secret of at least 32 characters.
- `FRONTEND_URLS=https://abaacademy.vercel.app` (plus any approved custom frontend origins).
- `STAFF_ACCOUNTS_JSON`: the full contents of `backend/private/teachers-bootstrap.json`.

`render.yaml` describes the backend using the existing Supabase database through
`DATABASE_URL`; it does not create an additional paid database. Applying a Blueprint
to an existing service requires checking its current settings first. Back up and
preserve existing business data before any database migration. Production must not rely
on an ephemeral SQLite file. Academy tables use row-level security to block direct
Supabase public-API access; the backend connects as the database table owner. Remove `STAFF_ACCOUNTS_JSON` after successful provisioning
if desired; all eight accounts must remain in the persistent database.

The backend fails startup with a specific error if any of the eight accounts is missing;
it never falls back to demo/admin credentials. `TEACHER_ACCOUNTS_JSON` is accepted as a
legacy name for the bootstrap setting. `ADMIN_EMAIL`/`ADMIN_PASSWORD` are not used.

Set Vercel's `VITE_API_BASE_URL=https://abaacademy.onrender.com`. After deployment,
verify `/health` reports `database: connected` and the expected `revision`, verify the
OpenAPI schema includes `/api/auth/change-password`, and test all eight roles and
password changes. Keep the password handoff private and update it if a temporary
password is changed during authorized live verification.

Teacher assignments currently use the first-name labels Firuz, Adhamjon, Behzodjon,
Abdulquddus, and Abdulwahid. Existing student/class assignments are preserved.

## Verification

```sh
npm run build
npm run lint
backend/.venv/bin/python -m unittest discover -s backend/tests -v
```

The integration test uses a disposable SQLite database and local HTTP server. It checks
all eight accounts, forced password changes, role permissions, rejected legacy accounts
and sessions, preservation of business data, no additional/deleted accounts, and
password/session behavior across restarts and activation changes. PostgreSQL and live
hosting require a separate deployment smoke test.

## Automatic tuition and family records

IT Admin and Finance can open **Tuition & Payments**, select a student, and record money already received. Parent name/phone come from enrollment automatically. Payments are stored in integer USD cents; partial payments, outstanding balances, overdue status, monthly reports and downloadable receipts all derive from the same ledger. The form does not process cards or send messages to parents. Staff access remains limited to the eight approved accounts.

Set a student's monthly amount, first/last billing month and due day once to enable a schedule. When staff open/refresh the app, missing invoices through the current month are created exactly once, within the chosen period. The app refreshes every 30 seconds while visible and when refocused. July/August or other holidays are not assumed: configure the actual billing period. There is no background card charging. A past start month explicitly creates missing historical invoices; when restarting a paused schedule, choose the intended new start month. Paused/terminated students receive no new scheduled invoices. Existing invoices are never silently repriced by a schedule change. One-off monthly invoices are also supported.

A payment and its audit event commit together. Repeated submissions reuse a request ID; concurrent payments lock the student's ledger and cannot overpay an invoice. A mistaken payment can be voided with a reason, preserving its receipt and restoring the balance. Voiding is a bookkeeping correction, not a bank/card refund. Receipt exports contain the actual amount, date, method, reference and parent snapshot.

Migration preserves the previously displayed outstanding student debt once as an **Opening balance** invoice. Historical manually edited monthly status cells remain read-only and are excluded from new receipt/collection totals; they are not reliable transaction evidence. No guessed tuition rate or fake payment is inserted. New enrollment starts without bills until Finance configures tuition, and no longer fabricates historical attendance. Applications accepted repeatedly do not create duplicate enrollment; active group counts derive from enrolled students.

Verification: `backend/.venv/bin/python -m unittest discover -s backend/tests -v`, `npm run build`, `npm run lint`. Finance integration tests use only a temporary local database and cover payment retries/concurrency, partial and full settlement, permissions, rollback on audit failure, voids, exports, yearly period separation, automatic billing, enrollment and persistence after restart.

## Registration, teacher placement and staff administration

The five approved teachers receive editable starter groups (`Teacher — General`, capacity 30, schedule not set). These are configuration defaults, not student/demo records. Existing teacher groups are preserved. Admin and Support can create/edit groups and move individual students in **Groups & Placement**. Changing a group's teacher updates its students and applications together. Transfers preserve student IDs and all finance/attendance history. Full groups and inactive or mismatched teachers are rejected by the API.

**Registration** defaults to **Register & enroll student**: the student appears immediately in the selected teacher's roster and Accounting. Optional **Send to teacher for review first** keeps the application pending until that teacher accepts it. Intake selects actual active staff/groups and never uses mock group defaults; parent email is optional. Duplicate submissions for the same name/phone are rejected with a link-free instruction to use the existing record.

**Admin → Users & access** edits staff display names, activates/deactivates accounts and assigns temporary passwords. Email/role remain the eight approved account identities. Teacher scoping uses the immutable account alias rather than the editable name. Password resets revoke old sessions and require the staff member to change the temporary password before opening academy data. Startup preserves edited names and existing passwords. Admin can also access Registration and Groups & Placement.

Teacher accounts now open the workspace immediately with their assigned password. Password changes remain available from Change password, but are optional for teachers, including after an administrator reset. Existing teacher password hashes are preserved when the first-login requirement is cleared. Other staff roles retain the first-login requirement.
