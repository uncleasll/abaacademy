import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import time
import unittest
from urllib.request import Request, urlopen
from urllib.error import HTTPError

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))
from app.security import hash_password
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
                   'ADMIN_EMAIL': 'bootstrap-admin@example.com', 'ADMIN_PASSWORD': 'Admin-test-password-123',
                   'TEACHER_ACCOUNTS_JSON': json.dumps(accounts)}
        cls.start_server()

    @classmethod
    def start_server(cls):
        cls.process = subprocess.Popen([sys.executable, '-m', 'uvicorn', 'app.main:app', '--port', str(cls.port)],
                                       cwd=BACKEND, env=cls.env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        for _ in range(100):
            try:
                if cls.call('/health')[0] == 200:
                    return
            except OSError:
                time.sleep(.1)
        raise RuntimeError('Test server did not start')

    @classmethod
    def tearDownClass(cls):
        cls.process.terminate()
        cls.process.wait(timeout=10)
        cls.temp.cleanup()

    @classmethod
    def call(cls, path, data=None, token=None):
        request = Request(f'http://127.0.0.1:{cls.port}{path}',
                          data=json.dumps(data).encode() if data is not None else None,
                          headers={'Content-Type': 'application/json', **({'Authorization': 'Bearer ' + token} if token else {})})
        try:
            with urlopen(request, timeout=10) as response:
                return response.status, json.load(response)
        except HTTPError as error:
            return error.code, json.load(error)

    def test_teacher_lifecycle_and_restart(self):
        for email in STAFF_ACCOUNTS:
            with self.subTest(email=email):
                status, result = self.call('/api/auth/login', dict(email=email.upper(), password=self.password))
                self.assertEqual(status, 200)
                self.assertEqual(result['user']['role'], STAFF_ACCOUNTS[email][1])
                self.assertTrue(result['user']['mustChangePassword'])
                token = result['token']
                self.assertEqual(self.call('/api/bootstrap', token=token)[0], 403)
                self.assertEqual(self.call('/api/auth/change-password', dict(currentPassword='wrong', newPassword='Updated-teacher-password-123'), token)[0], 400)
                self.assertEqual(self.call('/api/auth/change-password', dict(currentPassword=self.password, newPassword='short'), token)[0], 422)
                self.assertEqual(self.call('/api/auth/change-password', dict(currentPassword=self.password, newPassword=self.password), token)[0], 400)
                status, changed = self.call('/api/auth/change-password', dict(currentPassword=self.password, newPassword='Updated-teacher-password-123'), token)
                self.assertEqual(status, 200)
                self.assertFalse(changed['user']['mustChangePassword'])
                self.assertEqual(self.call('/api/auth/me', token=token)[0], 401)
                status, bootstrap = self.call('/api/bootstrap', token=changed['token'])
                self.assertEqual(status, 200)
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
        status, admin = self.call('/api/auth/login', dict(email='bootstrap-admin@example.com', password='Admin-test-password-123'))
        self.assertEqual(status, 200)
        status, created = self.call('/api/users', dict(name='New teacher', email='new@example.com', role='Teacher'), admin['token'])
        self.assertEqual(status, 201)
        self.assertGreaterEqual(len(created['temporaryPassword']), 12)
        status, login = self.call('/api/auth/login', dict(email=created['email'], password=created['temporaryPassword']))
        self.assertEqual(status, 200)
        self.assertTrue(login['user']['mustChangePassword'])


if __name__ == '__main__':
    unittest.main()
