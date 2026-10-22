from datetime import date, timedelta
import unittest
from uuid import uuid4

import test_teacher_auth as auth_tests


class OperationsTest(unittest.TestCase):
    setUpClass = classmethod(auth_tests.TeacherAuthTest.setUpClass.__func__)
    tearDownClass = classmethod(auth_tests.TeacherAuthTest.tearDownClass.__func__)
    start_server = classmethod(auth_tests.TeacherAuthTest.start_server.__func__)
    call = classmethod(auth_tests.TeacherAuthTest.call.__func__)

    def test_class_session_invoice_corrections_schedule_and_login_limit(self):
        tokens = {}
        for who in ('admin', 'support', 'firuz', 'adhamjon', 'accounting'):
            code, login = self.call('/api/auth/login', dict(email=who + '@abacademypa.com', password=self.password))
            self.assertEqual(code, 200)
            code, changed = self.call('/api/auth/change-password', dict(currentPassword=self.password, newPassword='Updated-local-password-123'), login['token'])
            self.assertEqual(code, 200)
            tokens[who] = changed['token']
        support, firuz, finance = tokens['support'], tokens['firuz'], tokens['accounting']
        base = dict(age=8, parentName='Parent', parentSurname='One', address='Address', teacher='Firuz', klass='Existing class', program='Hifz', intakeMode='enroll')
        for name, phone in (('Child One', '5550101'), ('Child Two', '5550102')):
            self.assertEqual(self.call('/api/applications', {**base, 'name': name, 'phone': phone}, support)[0], 201)
        students = self.call('/api/bootstrap', token=firuz)[1]['students']
        one, two = (next(s for s in students if s['name'] == name) for name in ('Child One', 'Child Two'))
        # Permanent, unique, sequential student numbers survive restarts.
        self.assertEqual(sorted(s['studentNumber'] for s in students), [1, 2])
        self.process.terminate(); self.process.wait(timeout=10); self.start_server()
        self.assertEqual({s['id']: s['studentNumber'] for s in self.call('/api/bootstrap', token=firuz)[1]['students']}, {one['id']: one['studentNumber'], two['id']: two['studentNumber']})
        today = date.today().isoformat()

        # One atomic request saves the whole class, and "late" survives the attendance summary.
        session = dict(date=today, entries=[
            dict(studentId=one['id'], attendance='late', stars=4, hw='partial', nextHw='Surah 1'),
            dict(studentId=two['id'], attendance='absent', stars=0, hw='not_done', nextHw=''),
        ])
        self.assertEqual(self.call('/api/class-session', session, tokens['adhamjon'])[0], 403)
        self.assertEqual(self.call('/api/class-session', session, support)[0], 403)
        self.assertEqual(self.call('/api/class-session', {**session, 'date': (date.today() + timedelta(days=5)).isoformat()}, firuz)[0], 422)
        self.assertEqual(self.call('/api/class-session', {**session, 'entries': session['entries'][:1] * 2}, firuz)[0], 422)
        missing = {**session, 'entries': session['entries'] + [dict(studentId='nobody', attendance='present', stars=1, hw='done')]}
        self.assertEqual(self.call('/api/class-session', missing, firuz)[0], 404)
        self.assertEqual(self.call('/api/bootstrap', token=firuz)[1]['attendanceRecords'], [])
        self.assertEqual(self.call('/api/class-session', session, firuz), (200, {'ok': True, 'saved': 2, 'telegram': []}))
        data = self.call('/api/bootstrap', token=firuz)[1]
        saved = {s['id']: s for s in data['students']}
        self.assertEqual((saved[one['id']]['attendance'], saved[one['id']]['stars'], saved[one['id']]['hw'], saved[one['id']]['nextHw'], saved[one['id']]['attendancePct']), ('late', 4, 'partial', 'Surah 1', 100))
        self.assertEqual((saved[two['id']]['attendance'], saved[two['id']]['attendancePct']), ('absent', 0))
        records = {r['studentId']: r for r in data['attendanceRecords']}
        self.assertEqual((records[one['id']]['status'], records[one['id']]['present']), ('late', True))
        self.assertEqual((records[two['id']]['status'], records[two['id']]['present']), ('absent', False))
        # Saving the same day again replaces it instead of duplicating records.
        session['entries'][1]['attendance'] = 'present'
        self.assertEqual(self.call('/api/class-session', session, firuz)[0], 200)
        data = self.call('/api/bootstrap', token=firuz)[1]
        self.assertEqual(len(data['attendanceRecords']), 2)
        self.assertEqual(data['today'], today)
        self.assertEqual(self.call('/api/attendance', dict(studentId=one['id'], date=today, status='absent'), tokens['admin'], 'PUT')[0], 200)
        self.assertEqual(self.call('/api/attendance', dict(studentId=one['id'], date='not-a-date', present=True), tokens['admin'], 'PUT')[0], 422)
        self.assertEqual(self.call('/api/students/' + one['id'], dict(attendance='sleeping'), firuz, 'PATCH')[0], 422)

        # Invoices can be corrected without deleting history.
        sid = one['id']
        invoice = dict(requestId=str(uuid4()), studentId=sid, period='2027-01', amount='80.00', dueDate='2027-01-28')
        code, created = self.call('/api/finance/invoices', invoice, finance)
        self.assertEqual(code, 201)
        path = '/api/finance/invoices/' + created['id']
        self.assertEqual(self.call(path, dict(amount='60.00', reason='Sibling discount'), firuz, 'PATCH')[0], 403)
        self.assertEqual(self.call(path, dict(amount='60.00', reason='Sibling discount'), finance, 'PATCH')[0], 200)
        payment = dict(requestId=str(uuid4()), studentId=sid, invoiceId=created['id'], amount='20.00', method='zeffy', paidOn=today, reference='Z-1', note='')
        code, receipt = self.call('/api/finance/payments', payment, finance)
        self.assertEqual(code, 201)
        self.assertEqual(self.call(path, dict(amount='10.00', reason='Too low now'), finance, 'PATCH')[0], 409)
        self.assertEqual(self.call(path + '/void', dict(reason='Created by mistake'), finance)[0], 409)
        self.assertEqual(self.call('/api/finance/payments/' + receipt['id'] + '/void', dict(reason='Wrong student'), finance)[0], 200)
        self.assertEqual(self.call(path + '/void', dict(reason='Created by mistake'), finance)[0], 200)
        data = self.call('/api/bootstrap', token=finance)[1]
        student = next(s for s in data['students'] if s['id'] == sid)
        self.assertEqual((student['amountDue'], student['tuitionStatus']), (0, 'paid'))
        voided = next(i for i in data['invoices'] if i['id'] == created['id'])
        self.assertEqual((voided['status'], voided['balance'], voided['voided']), ('void', 0, True))
        self.assertEqual(self.call('/api/finance/payments', {**payment, 'requestId': str(uuid4())}, finance)[0], 409)
        self.assertEqual(self.call(path, dict(amount='60.00', reason='Still void'), finance, 'PATCH')[0], 409)
        # Re-issuing the month restores the same invoice.
        code, restored = self.call('/api/finance/invoices', {**invoice, 'requestId': str(uuid4()), 'amount': '75.00'}, finance)
        self.assertEqual((code, restored['id']), (201, created['id']))
        student = next(s for s in self.call('/api/bootstrap', token=finance)[1]['students'] if s['id'] == sid)
        self.assertEqual(student['amountDue'], 75)

        # Enrollment status is validated; reactivation respects group capacity.
        self.assertEqual(self.call('/api/students/' + sid, dict(enrollmentStatus='gone'), finance, 'PATCH')[0], 422)
        self.assertEqual(self.call('/api/students/' + sid, dict(enrollmentStatus='terminated', terminationNote='Moved away'), finance, 'PATCH')[0], 200)
        group = next(g for g in self.call('/api/bootstrap', token=support)[1]['classGroups'] if g['name'] == 'Existing class')
        edit = {k: group[k] for k in ('name', 'teacher', 'program', 'schedule')}
        self.assertEqual(self.call('/api/groups/' + group['id'], {**edit, 'capacity': 1}, support, 'PUT')[0], 200)
        self.assertEqual(self.call('/api/students/' + sid, dict(enrollmentStatus='active'), finance, 'PATCH')[0], 409)
        self.assertEqual(self.call('/api/groups/' + group['id'], {**edit, 'capacity': 5}, support, 'PUT')[0], 200)
        self.assertEqual(self.call('/api/students/' + sid, dict(enrollmentStatus='active'), finance, 'PATCH')[0], 200)

        # The weekly schedule is shared from the server and rejects teacher conflicts.
        blocks = [dict(id='b1', group='Existing class', teacher='Firuz', day='Monday', start='17:00', end='19:00', color=''),
                  dict(id='b2', group='Other', teacher='Adhamjon', day='Monday', start='18:00', end='20:00', color='')]
        self.assertEqual(self.call('/api/schedule', dict(blocks=blocks), firuz, 'PUT')[0], 403)
        self.assertEqual(self.call('/api/schedule', dict(blocks=blocks), support, 'PUT')[0], 200)
        clash = blocks + [dict(id='b3', group='Clash', teacher='Firuz', day='Monday', start='18:30', end='19:30', color='')]
        self.assertEqual(self.call('/api/schedule', dict(blocks=clash), support, 'PUT')[0], 409)
        self.assertEqual(self.call('/api/schedule', dict(blocks=[{**blocks[0], 'end': '16:00'}]), support, 'PUT')[0], 422)
        self.assertEqual(len(self.call('/api/bootstrap', token=tokens['admin'])[1]['weeklySchedule']), 2)
        self.assertEqual([b['id'] for b in self.call('/api/bootstrap', token=firuz)[1]['weeklySchedule']], ['b1'])

        # Finance staff only receive their own staff profile.
        self.assertEqual([u['email'] for u in self.call('/api/bootstrap', token=finance)[1]['staffUsers']], ['accounting@abacademypa.com'])
        self.assertEqual(self.call('/api/telegram/webhook/anything', {}, None)[0], 404)

        # Repeated wrong passwords lock that sign-in, even for the right password, without affecting others.
        target = dict(email='behzodjon@abacademypa.com', password='wrong-password')
        self.assertEqual([self.call('/api/auth/login', target)[0] for _ in range(8)], [401] * 8)
        self.assertEqual(self.call('/api/auth/login', target)[0], 429)
        self.assertEqual(self.call('/api/auth/login', {**target, 'password': self.password})[0], 429)
        self.assertEqual(self.call('/api/auth/login', dict(email='abdulwahid@abacademypa.com', password=self.password))[0], 200)


if __name__ == '__main__':
    unittest.main()


class LedgerEntryTest(unittest.TestCase):
    setUpClass = classmethod(auth_tests.TeacherAuthTest.setUpClass.__func__)
    tearDownClass = classmethod(auth_tests.TeacherAuthTest.tearDownClass.__func__)
    start_server = classmethod(auth_tests.TeacherAuthTest.start_server.__func__)
    call = classmethod(auth_tests.TeacherAuthTest.call.__func__)

    def test_ledger_entry_creates_the_month_invoice_when_missing(self):
        tokens = {}
        for who in ('support', 'accounting', 'firuz'):
            code, login = self.call('/api/auth/login', dict(email=who + '@abacademypa.com', password=self.password))
            code, changed = self.call('/api/auth/change-password', dict(currentPassword=self.password, newPassword='Updated-local-password-123'), login['token'])
            self.assertEqual(code, 200)
            tokens[who] = changed['token']
        support, finance = tokens['support'], tokens['accounting']
        app = dict(name='Ledger Child', age=8, parentName='Parent', parentSurname='One', phone='9', address='A', teacher='Firuz', klass='Existing class', program='Hifz', intakeMode='enroll')
        self.assertEqual(self.call('/api/applications', app, support)[0], 201)
        sid = self.call('/api/bootstrap', token=finance)[1]['students'][0]['id']
        today = date.today().isoformat()
        entry = dict(requestId=str(uuid4()), studentId=sid, period='2026-09', amount='600', method='zeffy', paidOn=today, reference='Z1', note='')
        self.assertEqual(self.call('/api/finance/ledger-entries', entry, tokens['firuz'])[0], 403)
        # No plan yet: the invoice takes the paid amount.
        code, first = self.call('/api/finance/ledger-entries', entry, finance)
        self.assertEqual((code, first['invoiceCreated']), (201, True))
        self.assertEqual(self.call('/api/finance/ledger-entries', entry, finance)[1]['id'], first['id'])
        data = self.call('/api/bootstrap', token=finance)[1]
        sept = next(i for i in data['invoices'] if i['period'] == '2026-09')
        self.assertEqual((sept['amount'], sept['paid'], sept['status']), (600, 600, 'paid'))
        # With a plan, a partial payment creates the full monthly invoice and leaves a balance.
        plan = dict(studentId=sid, amount='600', startMonth='2026-09', endMonth='2027-06', dueDay=5, active=True)
        self.assertEqual(self.call('/api/finance/billing-plan', plan, finance, 'PUT')[0], 200)
        partial = {**entry, 'requestId': str(uuid4()), 'period': '2027-03', 'amount': '250'}
        self.assertEqual(self.call('/api/finance/ledger-entries', partial, finance)[0], 201)
        data = self.call('/api/bootstrap', token=finance)[1]
        march = next(i for i in data['invoices'] if i['period'] == '2027-03')
        self.assertEqual((march['amount'], march['paid'], march['balance'], march['dueDate']), (600, 250, 350, '2027-03-05'))
        # The second row for the same month settles it; a third would overpay.
        self.assertEqual(self.call('/api/finance/ledger-entries', {**partial, 'requestId': str(uuid4()), 'amount': '350'}, finance)[0], 201)
        code, body = self.call('/api/finance/ledger-entries', {**partial, 'requestId': str(uuid4()), 'amount': '1'}, finance)
        self.assertEqual(code, 409)
        self.assertIn('2027-03', body['detail'])
        self.assertEqual(self.call('/api/finance/ledger-entries', {**entry, 'requestId': str(uuid4()), 'period': '2026-13'}, finance)[0], 422)
        self.assertEqual(self.call('/api/finance/ledger-entries', {**entry, 'requestId': str(uuid4()), 'period': '2026-11', 'method': 'zelle'}, finance)[0], 201)
        self.assertEqual(self.call('/api/finance/ledger-entries', {**entry, 'requestId': str(uuid4()), 'period': '2026-12', 'method': 'paypal'}, finance)[0], 422)
        self.assertEqual(self.call('/api/finance/ledger-entries', {**entry, 'requestId': str(uuid4()), 'period': '2026-10', 'paidOn': '2099-01-01'}, finance)[0], 422)
