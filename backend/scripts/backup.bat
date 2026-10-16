@echo off
REM Nightly PostgreSQL backup for ABA Academy. Keeps 30 days. Password comes from %APPDATA%\postgresql\pgpass.conf.
set PGBIN=C:\Program Files\PostgreSQL\16\bin
set BACKUP_DIR=C:\abaacademy\backups
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"
for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd"') do set STAMP=%%i
"%PGBIN%\pg_dump.exe" -h localhost -U aba -d abaacademy -Fc -f "%BACKUP_DIR%\abaacademy-%STAMP%.dump"
if errorlevel 1 (
  echo Backup FAILED %DATE% %TIME% >> "%BACKUP_DIR%\backup.log"
  exit /b 1
)
echo Backup OK %DATE% %TIME% abaacademy-%STAMP%.dump >> "%BACKUP_DIR%\backup.log"
forfiles /p "%BACKUP_DIR%" /m *.dump /d -30 /c "cmd /c del @path" 2>nul
