"""Provision academy staff once; never reset an existing account's password."""
from __future__ import annotations

import json
import os
import secrets
from pathlib import Path

from .database import connect, init_db
from .security import hash_password

TEACHERS = {name.lower() + '@abacademypa.com': name for name in (
    'Firuz', 'Adhamjon', 'Behzodjon', 'Abdulquddus', 'Abdulwahid',
)}


STAFF_ACCOUNTS = {
    **{email: (name, 'Teacher') for email, name in TEACHERS.items()},
    'admin@abacademypa.com': ('ABA Academy Admin', 'IT Admin'),
    'accounting@abacademypa.com': ('ABA Academy Accounting', 'Finance'),
    'support@abacademypa.com': ('ABA Academy Support', 'Registration'),
}


def provision(accounts: list[dict]) -> list[str]:
    created = []
    with connect() as conn:
        for account in accounts:
            email = account['email'].strip().lower()
            if email not in STAFF_ACCOUNTS or not account['passwordHash'] or not account['passwordSalt']:
                raise ValueError('Invalid staff provisioning entry')
            name, role = STAFF_ACCOUNTS[email]
            if conn.execute('SELECT id FROM auth_accounts WHERE lower(email) = ?', (email,)).fetchone():
                continue
            staff = conn.execute('SELECT id, role FROM staff_users WHERE lower(email) = ?', (email,)).fetchone()
            if staff and staff['role'] != role:
                raise ValueError('Existing account has a different role')
            user_id = staff['id'] if staff else 'teacher-' + email.split('@')[0]
            if not staff:
                conn.execute('INSERT INTO staff_users VALUES (?, ?, ?, ?, ?, ?)',
                             (user_id, name, role, email, 'active', 'Never'))
            conn.execute('''INSERT INTO auth_accounts
                (id, staff_user_id, email, password_hash, password_salt, role, status, must_change_password)
                VALUES (?, ?, ?, ?, ?, ?, 'active', 1)''',
                ('auth-' + user_id, user_id, email, account['passwordHash'], account['passwordSalt'], role))
            created.append(email)
    return created


def enforce_staff_access() -> None:
    """Keep only the eight authorized staff accounts, without deleting business data."""
    with connect() as conn:
        existing = {row['email'].lower() for row in conn.execute('SELECT email FROM auth_accounts').fetchall()}
        missing = set(STAFF_ACCOUNTS) - existing
        if missing:
            raise RuntimeError('Missing staff accounts. Configure STAFF_ACCOUNTS_JSON before deployment: ' + ', '.join(sorted(missing)))
        placeholders = ', '.join('?' for _ in STAFF_ACCOUNTS)
        emails = tuple(STAFF_ACCOUNTS)
        conn.execute(
            f"UPDATE auth_accounts SET status = 'inactive', token_version = token_version + 1 WHERE lower(email) NOT IN ({placeholders}) AND status != 'inactive'", emails,
        )
        conn.execute(f"UPDATE staff_users SET status = 'inactive' WHERE lower(email) NOT IN ({placeholders})", emails)
        for email, (_, role) in STAFF_ACCOUNTS.items():
            conn.execute('UPDATE auth_accounts SET role = ?, token_version = token_version + 1 WHERE lower(email) = ? AND role != ?', (role, email, role))
            conn.execute('UPDATE staff_users SET role = ? WHERE lower(email) = ?', (role, email))


def provision_from_env() -> None:
    raw = (os.getenv('STAFF_ACCOUNTS_JSON') or os.getenv('TEACHER_ACCOUNTS_JSON', '')).strip()
    if raw:
        provision(json.loads(raw))


def main() -> None:
    folder = Path(__file__).resolve().parent.parent / 'private'
    folder.mkdir(mode=0o700, exist_ok=True)
    manifest_path = folder / 'teachers-bootstrap.json'
    credentials_path = folder / 'teacher-credentials.txt'
    accounts = json.loads(manifest_path.read_text()) if manifest_path.exists() else []
    lines = credentials_path.read_text().splitlines() if credentials_path.exists() else [
        'ABA Academy staff logins', 'Change the temporary password at first login.', '',
    ]
    known = {account['email'] for account in accounts}
    changed = False
    for email in STAFF_ACCOUNTS:
        if email in known:
            continue
        password = secrets.token_urlsafe(18)
        password_hash, salt = hash_password(password)
        accounts.append({'email': email, 'passwordHash': password_hash, 'passwordSalt': salt})
        lines.append(f'{email}\t{password}')
        changed = True
    if changed:
        for path, content in [(credentials_path, '\n'.join(lines) + '\n'), (manifest_path, json.dumps(accounts))]:
            fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
            with os.fdopen(fd, 'w') as output:
                output.write(content)
    init_db()
    created = provision(accounts)
    enforce_staff_access()
    print(f'Created {len(created)} staff accounts. Existing passwords were preserved.')
    print(f'Credentials: {credentials_path}')
    print(f'Production STAFF_ACCOUNTS_JSON: {manifest_path}')


if __name__ == '__main__':
    main()
