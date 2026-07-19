# ABA Academy USA Operations

Production-style academy operations system for IT Admin, Finance, Teacher, and Registration workflows.

## Stack

- Frontend: React, TypeScript, Vite, Tailwind CSS
- Backend: FastAPI
- Database: SQLite by default for local persistence
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
DATABASE_PATH=backend/academy.db
JWT_SECRET=replace-with-a-long-random-secret
JWT_TTL_SECONDS=43200
```

The dashboard requires login. If the backend is offline after login, the current screen keeps seeded fallback data and shows `Offline fallback` in the topbar.

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

For deployment, replace SQLite with Postgres, set a strong `JWT_SECRET`, configure HTTPS-only hosting, and move invite/password reset delivery to a transactional email provider.
