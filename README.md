# ABA Academy USA Operations

Production-style academy operations system for IT Admin, Finance, Teacher, and Registration workflows.

## Stack

- Frontend: React, TypeScript, Vite, Tailwind CSS
- Backend: FastAPI
- Database: PostgreSQL in production, SQLite fallback for local development
- API docs: `http://127.0.0.1:8000/docs`

## Run Locally

Install frontend dependencies:

```bash
npm install
```

Create and install backend environment:

```bash
python3 -m venv backend/.venv
backend/.venv/bin/pip install -r backend/requirements.txt
```

Start the API:

```bash
cd backend
.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Start the frontend:

```bash
npm run dev
```

Open:

```text
http://127.0.0.1:5173
```

## Login

Seeded local accounts:

```text
IT Admin: shavkat@abaacademy.us / Admin123!
Finance: malika@abaacademy.us / Finance123!
Teacher: behzodjon@abaacademy.us / Teacher123!
Registration: kamola@abaacademy.us / Register123!
```

## Environment

Frontend uses:

```text
VITE_API_BASE_URL=http://127.0.0.1:8000
```

Backend uses:

```text
DATABASE_URL=postgresql://user:password@host:5432/abaacademy
JWT_SECRET=replace-with-a-long-random-secret
JWT_TTL_SECONDS=43200
FRONTEND_URLS=https://abaacademy.vercel.app,http://localhost:5173
SEED_DEMO_DATA=false
ADMIN_NAME=ABA Academy Admin
ADMIN_EMAIL=admin@abaacademy.us
ADMIN_PASSWORD=replace-with-a-strong-password
```

The dashboard requires login. If the backend is offline, the topbar shows `Connection unavailable`. Initial data is empty; demo records are never used as a frontend fallback.

## Current Real Workflows

- IT Admin dashboard reads live DB state.
- Users can be invited and activated/deactivated.
- Students can be filtered and reviewed.
- Finance reminders and exports write audit events.
- Tuition payments can be marked as paid.
- Teacher roster saves attendance, rating, homework, and next assignment.
- Registration creates applications and moves/rejects applicants.
- Schedule creates and deletes applicant meetings.

## Production Notes

The root `render.yaml` provisions the API and PostgreSQL database together. Before the first deploy, Render asks for `ADMIN_NAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD`; these create the initial IT Admin account. Production startup rejects weak/default JWT secrets and does not load demo data.

Set `VITE_API_BASE_URL` in Vercel to the deployed Render API URL, for example `https://abaacademy-api.onrender.com`.

## Teacher accounts and passwords

The requested teacher logins are `firuz@abacademypa.com`, `adhamjon@abacademypa.com`,
`behzodjon@abacademypa.com`, `abdulquddus@abacademypa.com`, and `abdulwahid@abacademypa.com`.
These are portal accounts; provisioning does not change email mailbox passwords.

From `backend`, run `.venv/bin/python -m app.provision_teachers` once. It creates
unique random temporary passwords, provisions the configured database, and saves:

- `backend/private/teacher-credentials.txt`: private initial login handoff.
- `backend/private/teachers-bootstrap.json`: password hashes for production bootstrap.

Both files are excluded from Git and created with owner-only permissions. Share each
teacher's credentials privately. Never put the credential file in public assets.
To provision the same logins on Render, set `STAFF_ACCOUNTS_JSON` to the complete
JSON file contents and redeploy. Existing accounts and changed passwords are preserved
on repeat startup; an existing login is never reset by provisioning. Remove that
variable once all accounts exist. Keep the credential file only until handoff.

Teachers must change their temporary password before accessing data. The topbar's
**Change password** action remains available afterward. New passwords require 12–128
characters and the current password; changing it invalidates all older sessions.
New accounts created by Admin/Registration also receive unique temporary passwords,
shown once in the creation notice for private handoff.

Teacher records currently match students/classes by the first word of the staff name;
assign students/classes using Firuz, Adhamjon, Behzodjon, Abdulquddus, or Abdulwahid.
This change does not invent classroom assignments or migrate old-domain accounts.

Validation: `npm run build`, `npm run lint`, and
`backend/.venv/bin/python -m unittest discover -s backend/tests -v`.
The integration test uses a disposable SQLite database and local HTTP server; it
covers all five logins, required password changes, old-session invalidation, access
restrictions, and preservation of changed passwords after restart. PostgreSQL and
live hosting still require deployment smoke testing.

Additional staff accounts: `admin@abacademypa.com` (IT Admin),
`accounting@abacademypa.com` (Finance), and `support@abacademypa.com` (Registration).
The same provisioning command now creates all eight accounts and preserves existing
passwords. `TEACHER_ACCOUNTS_JSON` remains supported for older deployments.
