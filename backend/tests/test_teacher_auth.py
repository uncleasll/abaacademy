import json
import os
from pathlib import Path
import socket
import sqlite3
import subprocess
import sys
import tempfile
import time
import unittest
from urllib.request import Request, urlopen
from urllib.error import HTTPError

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))
from app.security import hash_password, create_token
from app.provision_teachers import TEACHERS, STAFF_ACCOUNTS


class TeacherAuthTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        cls.password = 'Initial-teacher-password-123'
        accounts = []
        for email in STAFF_ACCOUNTS:
            digest, salt = hash_password(cls.password)
            accounts.append(dict(email=email, passwordHash=digest, passwordSalt=salt))
        with socket.socket() as sock:
            sock.bind(('127.0.0.1', 0))
            cls.port = sock.getsockname()[1]
        cls.env = {**os.environ, 'DATABASE_URL': '', 'DATABASE_PATH': cls.temp.name + '/test.db',
                   'APP_ENV': 'development', 'SEED_DEMO_DATA': 'false',
                   'TEACHER_ACCOUNTS_JSON': json.dumps(accounts)}
        subprocess.run([sys.executable, '-c', "from app.database import init_db; init_db()"], cwd=BACKEND, env=cls.env, check=True)
        with sqlite3.connect(cls.env['DATABASE_PATH']) as conn:
            digest, salt = hash_password('Legacy-password-123')
            conn.execute("INSERT INTO staff_users VALUES ('legacy', 'Legacy Admin', 'IT Admin', 'legacy@example.com', 'active', 'Never')")
            conn.execute("INSERT INTO auth_accounts (id, staff_user_id, email, password_hash, password_salt, role, status) VALUES ('auth-legacy', 'legacy', 'legacy@example.com', ?, ?, 'IT Admin', 'active')", (digest, salt))
            conn.execute("INSERT INTO class_groups VALUES ('existing-group', 'Existing class', 'Firuz', 'Hifz', 'Monday', 12, 0)")
        cls.legacy_token = create_token({'sub': 'legacy', 'email': 'legacy@example.com', 'version': 0})
        cls.start_server()

    @classmethod
    def start_server(cls):
        log_path = Path(cls.temp.name) / 'server.log'
        with log_path.open('w') as log:
            cls.process = subprocess.Popen([sys.executable, '-m', 'uvicorn', 'app.main:app', '--port', str(cls.port)],
                                           cwd=BACKEND, env=cls.env, stdout=log, stderr=log)
        for _ in range(100):
            if cls.process.poll() is not None:
                raise RuntimeError(log_path.read_text())
            try:
                if cls.call('/health')[0] == 200:
                    return
            except OSError:
                time.sleep(.1)
        cls.process.terminate()
        cls.process.wait(timeout=10)
        raise RuntimeError('Test server did not start: ' + log_path.read_text())

    @classmethod
    def tearDownClass(cls):
        cls.process.terminate()
        cls.process.wait(timeout=10)
        cls.temp.cleanup()

    @classmethod
    def call(cls, path, data=None, token=None, method=None):
        request = Request(f'http://127.0.0.1:{cls.port}{path}', method=method,
                          data=json.dumps(data).encode() if data is not None else None,
                          headers={'Content-Type': 'application/json', **({'Authorization': 'Bearer ' + token} if token else {})})
        try:
            with urlopen(request, timeout=10) as response:
                return response.status, json.load(response)
        except HTTPError as error:
            return error.code, json.load(error)

    def test_teacher_lifecycle_and_restart(self):
        self.assertEqual(self.call('/api/auth/login', dict(email='legacy@example.com', password='Legacy-password-123'))[0], 401)
        self.assertEqual(self.call('/api/auth/me', token=self.legacy_token)[0], 401)
        with sqlite3.connect(self.env['DATABASE_PATH']) as conn:
            self.assertEqual(conn.execute("SELECT status FROM auth_accounts WHERE id = 'auth-legacy'").fetchone()[0], 'inactive')
            self.assertEqual(conn.execute("SELECT COUNT(*) FROM class_groups WHERE id = 'existing-group'").fetchone()[0], 1)
        tokens = {}
        for email in STAFF_ACCOUNTS:
            with self.subTest(email=email):
                status, result = self.call('/api/auth/login', dict(email=email.upper(), password=self.password))
                self.assertEqual(status, 200)
                self.assertEqual(result['user']['role'], STAFF_ACCOUNTS[email][1])
                self.assertEqual(result['user']['mustChangePassword'], email not in TEACHERS)
                token = result['token']
                self.assertEqual(self.call('/api/bootstrap', token=token)[0], 200 if email in TEACHERS else 403)
                self.assertEqual(self.call('/api/auth/change-password', dict(currentPassword='wrong', newPassword='Updated-teacher-password-123'), token)[0], 400)
                self.assertEqual(self.call('/api/auth/change-password', dict(currentPassword=self.password, newPassword='short'), token)[0], 422)
                self.assertEqual(self.call('/api/auth/change-password', dict(currentPassword=self.password, newPassword=self.password), token)[0], 400)
                status, changed = self.call('/api/auth/change-password', dict(currentPassword=self.password, newPassword='Updated-teacher-password-123'), token)
                self.assertEqual(status, 200)
                self.assertFalse(changed['user']['mustChangePassword'])
                tokens[email] = changed['token']
                self.assertEqual(self.call('/api/auth/me', token=token)[0], 401)
                status, bootstrap = self.call('/api/bootstrap', token=changed['token'])
                self.assertEqual(status, 200)
                self.assertEqual(set(staff['email'] for staff in bootstrap['staffUsers']) - set(STAFF_ACCOUNTS), set())
                if email in TEACHERS:
                    self.assertEqual([staff['email'] for staff in bootstrap['staffUsers']], [email])
                if STAFF_ACCOUNTS[email][1] != 'IT Admin':
                    self.assertEqual(self.call('/api/users', dict(name='Other', email='other@example.com', role='IT Admin'), changed['token'])[0], 403)
                self.assertEqual(self.call('/api/auth/login', dict(email=email, password=self.password))[0], 401)
        self.process.terminate()
        self.process.wait(timeout=10)
        self.start_server()
        for email in STAFF_ACCOUNTS:
            status, result = self.call('/api/auth/login', dict(email=email, password='Updated-teacher-password-123'))
            self.assertEqual(status, 200)
            self.assertFalse(result['user']['mustChangePassword'])
        self.assertEqual(self.call('/api/auth/change-password', dict(currentPassword='wrong', newPassword='anything-long-enough'))[0], 401)
        status, admin = self.call('/api/auth/login', dict(email='admin@abacademypa.com', password='Updated-teacher-password-123'))
        self.assertEqual(status, 200)
        token = admin['token']
        self.assertEqual(self.call('/api/users', dict(name='New teacher', email='new@example.com', role='Teacher'), token)[0], 403)
        self.assertEqual(self.call('/api/users/legacy/status', dict(status='active'), token, 'PATCH')[0], 403)
        self.assertEqual(self.call('/api/users/' + admin['user']['id'] + '/status', dict(status='inactive'), token, 'PATCH')[0], 400)
        status, teacher = self.call('/api/auth/login', dict(email='firuz@abacademypa.com', password='Updated-teacher-password-123'))
        teacher_id = teacher['user']['id']
        self.assertEqual(self.call('/api/users/' + teacher_id, token=token, method='DELETE')[0], 403)
        self.assertEqual(self.call('/api/users/' + teacher_id + '/status', dict(status='inactive'), token, 'PATCH')[0], 200)
        self.assertEqual(self.call('/api/auth/me', token=teacher['token'])[0], 401)
        self.assertEqual(self.call('/api/users/' + teacher_id + '/status', dict(status='active'), token, 'PATCH')[0], 200)
        self.assertEqual(self.call('/api/auth/me', token=teacher['token'])[0], 401)
        for email, account_token in tokens.items():
            if email == 'firuz@abacademypa.com':
                continue
            status, _ = self.call('/api/finance/reconcile', {}, account_token)
            self.assertEqual(status, 200 if STAFF_ACCOUNTS[email][1] in {'IT Admin', 'Finance'} else 403)
        with sqlite3.connect(self.env['DATABASE_PATH']) as conn:
            self.assertEqual(conn.execute("SELECT COUNT(*) FROM auth_accounts WHERE status = 'active'").fetchone()[0], 8)



class BootstrapConfigurationTest(unittest.TestCase):
    def test_missing_staff_configuration_does_not_create_demo_accounts(self):
        with tempfile.TemporaryDirectory() as directory:
            env = {**os.environ, 'DATABASE_URL': '', 'DATABASE_PATH': directory + '/empty.db',
                   'APP_ENV': 'development', 'STAFF_ACCOUNTS_JSON': '', 'TEACHER_ACCOUNTS_JSON': ''}
            result = subprocess.run([sys.executable, '-c', 'from app.main import startup; startup()'],
                                    cwd=BACKEND, env=env, text=True, capture_output=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn('Missing staff accounts', result.stderr)
            with sqlite3.connect(env['DATABASE_PATH']) as conn:
                self.assertEqual(conn.execute('SELECT COUNT(*) FROM auth_accounts').fetchone()[0], 0)


if __name__ == '__main__':
    unittest.main()
