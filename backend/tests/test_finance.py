import concurrent.futures
from datetime import date
import json
import sqlite3
import unittest
from uuid import uuid4
from urllib.request import Request, urlopen

import test_teacher_auth as auth_tests


class FinanceTest(unittest.TestCase):
    setUpClass = classmethod(auth_tests.TeacherAuthTest.setUpClass.__func__)
    tearDownClass = classmethod(auth_tests.TeacherAuthTest.tearDownClass.__func__)
    start_server = classmethod(auth_tests.TeacherAuthTest.start_server.__func__)
    call = classmethod(auth_tests.TeacherAuthTest.call.__func__)

    def test_payment_lifecycle_atomicity_and_automation(self):
        tokens = {}
        for email in ('accounting@abacademypa.com', 'firuz@abacademypa.com', 'support@abacademypa.com', 'admin@abacademypa.com'):
            code, result = self.call('/api/auth/login', dict(email=email, password=self.password))
            self.assertEqual(code, 200)
            code, result = self.call('/api/auth/change-password', dict(currentPassword=self.password, newPassword='New-local-test-password-123'), result['token'])
            self.assertEqual(code, 200)
            tokens[email.split('@')[0]] = result['token']
        finance = tokens['accounting']
        app = dict(name='Test Student', age=9, parentName='Test', parentSurname='Parent', phone='555-0100', address='Test address', program='Hifz', teacher='Firuz', klass='Existing class')
        code, application = self.call('/api/applications', app, tokens['support'])
        self.assertEqual(code, 201)
        self.assertEqual(self.call('/api/applications/' + application['id'] + '/status', {'status': 'accepted'}, tokens['support'], 'PATCH')[0], 200)
        data = self.call('/api/bootstrap', token=finance)[1]
        student = data['students'][0]
        sid = student['id']
        self.assertEqual(student['parentName'], 'Test Parent')
        self.assertEqual(data['attendanceRecords'], [])
        self.assertEqual(data['invoices'], [])
        self.assertFalse(student['billingConfigured'])
        self.assertEqual(next(g for g in data['classGroups'] if g['id']=='existing-group')['enrolled'], 1)
        self.call('/api/applications/' + application['id'] + '/status', {'status': 'accepted'}, tokens['support'], 'PATCH')
        self.assertEqual(len(self.call('/api/bootstrap', token=finance)[1]['students']), 1)

        month = date.today().strftime('%Y-%m')
        plan = dict(studentId=sid, amount='450.25', startMonth=month, endMonth=month, dueDay=1, active=True)
        self.assertEqual(self.call('/api/finance/billing-plan', plan, tokens['firuz'], 'PUT')[0], 403)
        self.assertEqual(self.call('/api/finance/billing-plan', plan, finance, 'PUT')[0], 200)
        data = self.call('/api/bootstrap', token=finance)[1]
        self.assertEqual(len(data['invoices']), 1)
        self.assertEqual(data['students'][0]['amountDue'], 450.25)
        invoice = data['invoices'][0]
        payload = dict(requestId=str(uuid4()), studentId=sid, invoiceId=invoice['id'], amount='100.10', method='cash', paidOn=date.today().isoformat(), reference='', note='Partial tuition')
        self.assertEqual(self.call('/api/finance/payments', payload, tokens['support'])[0], 403)
        for bad in ('0', '-1', '0.001', 'NaN'):
            self.assertEqual(self.call('/api/finance/payments', {**payload, 'amount': bad}, finance)[0], 422)
        # Simulate double submit and a lost-response retry. Exactly one receipt survives.
        with concurrent.futures.ThreadPoolExecutor(4) as pool:
            results = list(pool.map(lambda _: self.call('/api/finance/payments', payload, finance), range(4)))
        self.assertTrue(all(status == 201 for status, _ in results), results)
        self.assertEqual(len({r['id'] for _, r in results}), 1)
        payment_id = results[0][1]['id']
        self.assertEqual(self.call('/api/finance/payments', {**payload, 'amount': '100.11'}, finance)[0], 409)
        data = self.call('/api/bootstrap', token=finance)[1]
        self.assertEqual(data['students'][0]['amountDue'], 350.15)
        self.assertEqual(data['invoices'][0]['status'], 'partial')
        self.assertEqual(data['tuitionRecords'][0]['amount'], 100.1)
        self.assertEqual(data['payments'][0]['parentName'], 'Test Parent')
        self.assertEqual(len(data['payments']), 1)
        self.assertEqual(self.call('/api/students/' + sid, dict(amountDue=0), finance, 'PATCH')[0], 409)
        self.assertEqual(self.call('/api/tuition-records', dict(studentId=sid, month=month, amount=450, status='paid'), finance, 'PUT')[0], 409)
        self.assertEqual(self.call('/api/finance/payments', {**payload, 'requestId': str(uuid4()), 'amount': '351'}, finance)[0], 409)
        # Two different concurrent receipts cannot overpay the same invoice.
        def settle(_):
            return self.call('/api/finance/payments', {**payload, 'requestId': str(uuid4()), 'amount': '350.15'}, finance)
        with concurrent.futures.ThreadPoolExecutor(2) as pool:
            results = list(pool.map(settle, range(2)))
        self.assertEqual(sorted(code for code, _ in results), [201, 409])
        data = self.call('/api/bootstrap', token=tokens['firuz'])[1]
        self.assertEqual(data['students'][0]['amountDue'], 0)
        self.assertEqual(data['students'][0]['tuitionStatus'], 'paid')
        self.assertEqual(data['invoices'][0]['paid'], 450.25)
        # Financial audit failure rolls back the payment itself.
        self.call('/api/finance/payments/' + payment_id + '/void', dict(reason='Correction for test'), finance)
        with sqlite3.connect(self.env['DATABASE_PATH']) as conn:
            conn.execute("CREATE TRIGGER fail_audit BEFORE INSERT ON audit_log WHEN NEW.event='payment.received' BEGIN SELECT RAISE(ABORT, 'test rollback'); END")
        failed = {**payload, 'requestId': str(uuid4())}
        request = Request(f'http://127.0.0.1:{self.port}/api/finance/payments', data=json.dumps(failed).encode(), headers={'Content-Type': 'application/json', 'Authorization': 'Bearer ' + finance})
        from urllib.error import HTTPError
        with self.assertRaises(HTTPError) as err:
            urlopen(request)
        self.assertEqual(err.exception.code, 500)
        with sqlite3.connect(self.env['DATABASE_PATH']) as conn:
            self.assertEqual(conn.execute('SELECT COUNT(*) FROM payments').fetchone()[0], 2)
            conn.execute('DROP TRIGGER fail_audit')
        self.assertEqual(self.call('/api/finance/payments', failed, finance)[0], 201)
        # Receipts use actual amount/date rather than a fixed $450 and today's date.
        request = Request(f'http://127.0.0.1:{self.port}/api/finance/receipts', headers={'Authorization': 'Bearer ' + finance})
        with urlopen(request) as response:
            csv = response.read().decode('utf-8-sig')
        self.assertIn('100.1', csv)
        self.assertIn('Test Parent', csv)
        self.assertIn('void', csv)
        self.assertEqual(self.call('/api/finance/reconcile', {}, finance)[1]['totalDue'], 0)
        self.process.terminate(); self.process.wait(timeout=10); self.start_server()
        self.assertEqual(len(self.call('/api/bootstrap', token=finance)[1]['payments']), 3)
        # Same month in different years never overwrites records.
        manual = dict(requestId=str(uuid4()), studentId=sid, period='2027-01', amount='75.50', dueDate='2027-01-28')
        self.assertEqual(self.call('/api/finance/invoices', manual, finance)[0], 201)
        self.assertEqual(self.call('/api/finance/invoices', manual, finance)[0], 201)
        self.assertEqual(self.call('/api/finance/invoices', {**manual, 'requestId': str(uuid4())}, finance)[0], 409)
        self.assertEqual(self.call('/api/finance/invoices', {**manual, 'requestId': str(uuid4()), 'period': '2028-01'}, finance)[0], 201)
        # A terminated student cannot acquire new scheduled invoices.
        self.call('/api/students/' + sid, dict(enrollmentStatus='terminated'), finance, 'PATCH')
        plan['startMonth'] = '2025-01'; plan['endMonth'] = month
        self.assertEqual(self.call('/api/finance/billing-plan', plan, finance, 'PUT')[0], 200)
        data = self.call('/api/bootstrap', token=finance)[1]
        self.assertEqual(len(data['invoices']), 3)
        self.assertEqual(next(g for g in data['classGroups'] if g['id']=='existing-group')['enrolled'], 0)


class OpeningBalanceTest(unittest.TestCase):
    def test_migration_preserves_debt_once_without_fake_receipts(self):
        from app.database import DatabaseConnection, SCHEMA
        from app.finance import init_finance, snapshot
        raw = sqlite3.connect(':memory:')
        raw.row_factory = sqlite3.Row
        raw.executescript(SCHEMA)
        raw.execute("INSERT INTO students(id,name,age,parent_name,parent_phone,address,klass,teacher,amount_due,tuition_status) VALUES ('old','Existing',9,'Parent','000','test','test','Firuz',900,'overdue')")
        raw.execute("INSERT INTO tuition_records VALUES ('old','September','partial',100,'existing manual record')")
        conn = DatabaseConnection(raw, False)
        init_finance(conn)
        init_finance(conn)
        ledger, balances = snapshot(conn, ['old'])
        self.assertEqual(len(ledger['invoices']), 1)
        self.assertEqual(ledger['invoices'][0]['period'], 'Opening balance')
        self.assertEqual(balances['old']['amountDue'], 900)
        self.assertEqual(balances['old']['tuitionStatus'], 'overdue')
        self.assertEqual(ledger['payments'], [])
        self.assertEqual(raw.execute('SELECT amount FROM tuition_records').fetchone()[0], 100)
        raw.close()
