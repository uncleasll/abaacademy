from datetime import date
from http.server import BaseHTTPRequestHandler, HTTPServer
import json
import threading
import unittest

import test_teacher_auth as auth_tests


class FakeTelegram(BaseHTTPRequestHandler):
    calls = []
    fail_edit = False

    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
        method = self.path.rsplit('/', 1)[1]
        FakeTelegram.calls.append((method, body))
        if method == 'editMessageText' and FakeTelegram.fail_edit:
            reply = {'ok': False, 'description': 'Bad Request: message to edit not found'}
        else:
            reply = {'ok': True, 'result': {'message_id': 100 + len(FakeTelegram.calls)}}
        data = json.dumps(reply).encode()
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, *args):
        pass


class TelegramAttendanceTest(unittest.TestCase):
    start_server = classmethod(auth_tests.TeacherAuthTest.start_server.__func__)
    call = classmethod(auth_tests.TeacherAuthTest.call.__func__)

    @classmethod
    def setUpClass(cls):
        cls.fake = HTTPServer(('127.0.0.1', 0), FakeTelegram)
        threading.Thread(target=cls.fake.serve_forever, daemon=True).start()
        auth_tests.TeacherAuthTest.setUpClass.__func__(cls)
        cls.process.terminate(); cls.process.wait(timeout=10)
        cls.env.update(TELEGRAM_BOT_TOKEN='test-token', TELEGRAM_API_BASE=f'http://127.0.0.1:{cls.fake.server_port}')
        cls.start_server()

    @classmethod
    def tearDownClass(cls):
        auth_tests.TeacherAuthTest.tearDownClass.__func__(cls)
        cls.fake.shutdown()

    def test_saving_a_class_posts_and_then_edits_the_group_message(self):
        tokens = {}
        for who in ('support', 'firuz'):
            code, login = self.call('/api/auth/login', dict(email=who + '@abacademypa.com', password=self.password))
            code, changed = self.call('/api/auth/change-password', dict(currentPassword=self.password, newPassword='Updated-local-password-123'), login['token'])
            self.assertEqual(code, 200)
            tokens[who] = changed['token']
        support, firuz = tokens['support'], tokens['firuz']
        base = dict(age=8, parentName='Parent', parentSurname='One', address='Address', teacher='Firuz', klass='Existing class', program='Hifz', intakeMode='enroll')
        for name, phone in (('Zayd <b>', '1'), ('Amina', '2'), ('Yusuf', '3')):
            self.assertEqual(self.call('/api/applications', {**base, 'name': name, 'phone': phone}, support)[0], 201)
        students = {s['name']: s['id'] for s in self.call('/api/bootstrap', token=firuz)[1]['students']}
        today = date.today().isoformat()
        session = dict(date=today, entries=[
            dict(studentId=students['Zayd <b>'], attendance='absent', stars=0, hw='not_done', nextHw=''),
            dict(studentId=students['Amina'], attendance='late', stars=3, hw='partial', nextHw='Page 5 & 6'),
            dict(studentId=students['Yusuf'], attendance='present', stars=5, hw='done', nextHw=''),
        ])
        # Without a connected chat nothing is posted.
        self.assertEqual(self.call('/api/class-session', session, firuz)[1]['telegram'], [])
        self.assertEqual(FakeTelegram.calls, [])

        group = next(g for g in self.call('/api/bootstrap', token=support)[1]['classGroups'] if g['name'] == 'Existing class')
        edit = {k: group[k] for k in ('name', 'teacher', 'program', 'schedule', 'capacity')}
        path = '/api/groups/' + group['id']
        self.assertEqual(self.call(path, {**edit, 'telegramChatId': 'not-a-chat'}, support, 'PUT')[0], 422)
        self.assertEqual(self.call(path + '/telegram-test', {}, support)[0], 409)
        self.assertEqual(self.call(path, {**edit, 'telegramChatId': '-1003406651107'}, support, 'PUT')[0], 200)
        # Editing a group without sending the field keeps the saved chat.
        self.assertEqual(self.call(path, edit, support, 'PUT')[0], 200)
        seen = next(g for g in self.call('/api/bootstrap', token=support)[1]['classGroups'] if g['id'] == group['id'])
        self.assertEqual((seen['telegramChatId'], seen['telegramConnected']), ('-1003406651107', True))
        teacher_view = next(g for g in self.call('/api/bootstrap', token=firuz)[1]['classGroups'] if g['id'] == group['id'])
        self.assertTrue(teacher_view['telegramConnected'])
        self.assertNotIn('telegramChatId', teacher_view)
        self.assertEqual(self.call(path + '/telegram-test', {}, firuz)[0], 403)
        self.assertEqual(self.call(path + '/telegram-test', {}, support)[0], 200)
        FakeTelegram.calls.clear()

        code, saved = self.call('/api/class-session', session, firuz)
        self.assertEqual((code, saved['telegram']), (200, [{'group': 'Existing class', 'status': 'sent'}]))
        method, body = FakeTelegram.calls[-1]
        self.assertEqual((method, body['chat_id'], body['parse_mode']), ('sendMessage', '-1003406651107', 'HTML'))
        text = body['text']
        self.assertIn('| Attendance | ' + date.today().strftime('%d %b %Y'), text)
        # Present first, then late, then absent; absent students get the short line; names are escaped.
        self.assertLess(text.index('1. Yusuf'), text.index('2. Amina'))
        self.assertLess(text.index('2. Amina'), text.index('3. Zayd &lt;b&gt;'))
        self.assertIn('Present | ★★★★★ | Last HW: Done', text)
        self.assertIn('Late | ★★★☆☆ | Last HW: Partial', text)
        self.assertIn('Next HW: <b><i>Page 5 &amp; 6</i></b>', text)
        self.assertIn('❌ Absent', text)
        self.assertIn('Surah Taha 20:114', text)

        # Saving the same day again edits the same post instead of sending a second one.
        session['entries'][0]['attendance'] = 'present'
        self.assertEqual(self.call('/api/class-session', session, firuz)[1]['telegram'][0]['status'], 'updated')
        method, body = FakeTelegram.calls[-1]
        self.assertEqual(method, 'editMessageText')
        self.assertNotIn('❌ Absent', body['text'])
        sent_id = body['message_id']
        # If the post was deleted in Telegram, a fresh one is sent and remembered.
        FakeTelegram.fail_edit = True
        self.assertEqual(self.call('/api/class-session', session, firuz)[1]['telegram'][0]['status'], 'sent')
        self.assertEqual([m for m, _ in FakeTelegram.calls[-2:]], ['editMessageText', 'sendMessage'])
        FakeTelegram.fail_edit = False
        self.assertEqual(self.call('/api/class-session', session, firuz)[1]['telegram'][0]['status'], 'updated')
        self.assertNotEqual(FakeTelegram.calls[-1][1]['message_id'], sent_id)

        # A later correction from the Students page edits the same post too.
        self.assertEqual(self.call('/api/attendance', dict(studentId=students['Yusuf'], date=today, status='absent'), firuz, 'PUT')[1]['telegram'][0]['status'], 'updated')
        self.assertEqual(FakeTelegram.calls[-1][0], 'editMessageText')
        self.assertIn('❌ Absent', FakeTelegram.calls[-1][1]['text'])

        # A Telegram outage never loses the class: attendance is saved and the failure is reported.
        self.fake.shutdown()
        self.fake.server_close()
        code, saved = self.call('/api/class-session', session, firuz)
        self.assertEqual((code, saved['saved'], saved['telegram'][0]['status']), (200, 3, 'failed'))


if __name__ == '__main__':
    unittest.main()
