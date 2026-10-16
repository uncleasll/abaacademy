@echo off
REM Starts the ABA Academy API. Used by the Windows service (NSSM) and for manual testing.
cd /d C:\abaacademy\backend
.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
