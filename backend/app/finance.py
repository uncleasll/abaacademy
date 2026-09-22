"""A single ledger for billing, receipts and family balances. Money is integer cents."""
from calendar import monthrange
from datetime import date, datetime, timezone
import hashlib
import json
from uuid import uuid4

from fastapi import HTTPException

SCHEMA = """
CREATE TABLE IF NOT EXISTS billing_plans (
 student_id TEXT PRIMARY KEY REFERENCES students(id), amount_cents INTEGER NOT NULL CHECK(amount_cents > 0),
 start_month TEXT NOT NULL, end_month TEXT NOT NULL, due_day INTEGER NOT NULL,
 active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS invoices (
 id TEXT PRIMARY KEY, student_id TEXT NOT NULL REFERENCES students(id), period TEXT NOT NULL,
 amount_cents INTEGER NOT NULL CHECK(amount_cents > 0), due_date TEXT NOT NULL, created_at TEXT NOT NULL,
 UNIQUE(student_id, period)
);
CREATE TABLE IF NOT EXISTS payments (
 id TEXT PRIMARY KEY, invoice_id TEXT NOT NULL REFERENCES invoices(id),
 amount_cents INTEGER NOT NULL CHECK(amount_cents > 0), method TEXT NOT NULL, paid_on TEXT NOT NULL,
 reference TEXT NOT NULL, note TEXT NOT NULL, actor_id TEXT NOT NULL REFERENCES staff_users(id),
 student_name TEXT NOT NULL, parent_name TEXT NOT NULL, parent_phone TEXT NOT NULL,
 created_at TEXT NOT NULL, voided_at TEXT, void_reason TEXT, void_actor_id TEXT
);
CREATE TABLE IF NOT EXISTS finance_requests (
 request_id TEXT PRIMARY KEY, fingerprint TEXT NOT NULL, response TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS finance_migrations (name TEXT PRIMARY KEY);
CREATE INDEX IF NOT EXISTS payments_invoice_idx ON payments(invoice_id);
"""


def now():
    return datetime.now(timezone.utc).isoformat()


def transaction_lock(conn, student_id):
    # One student's plan, invoices and payments serialize together, including retries.
    if not conn.postgres:
        conn.execute('BEGIN IMMEDIATE')
    student = conn.execute('SELECT * FROM students WHERE id = ?' + (' FOR UPDATE' if conn.postgres else ''), (student_id,)).fetchone()
    if not student:
        raise HTTPException(404, 'Student not found')
    return student


def init_finance(conn):
    for statement in SCHEMA.split(';'):
        if statement.strip():
            conn.execute(statement)
    if conn.postgres:
        for table in ('billing_plans', 'invoices', 'payments', 'finance_requests', 'finance_migrations'):
            conn.execute(f'ALTER TABLE {table} ENABLE ROW LEVEL SECURITY')
    # Preserve the previously displayed debt once, without pretending historical status cells are receipts.
    marker = conn.execute("INSERT INTO finance_migrations VALUES ('opening-balances-v1') ON CONFLICT DO NOTHING RETURNING name").fetchone()
    if marker:
        for student in conn.execute('SELECT * FROM students WHERE amount_due > 0').fetchall():
            due = '1970-01-01' if student['tuition_status'] == 'overdue' else date.today().isoformat()
            conn.execute('INSERT INTO invoices VALUES (?, ?, ?, ?, ?, ?)',
                         (str(uuid4()), student['id'], 'Opening balance', int(student['amount_due']) * 100, due, now()))


def sync_plan(conn, student, today=None):
    today = today or date.today()
    plan = conn.execute('SELECT * FROM billing_plans WHERE student_id = ?', (student['id'],)).fetchone()
    if not plan or not plan['active'] or student['enrollment_status'] != 'active':
        return
    month = plan['start_month']
    last = min(plan['end_month'], today.strftime('%Y-%m'))
    while month <= last:
        year, number = map(int, month.split('-'))
        due = date(year, number, min(plan['due_day'], monthrange(year, number)[1])).isoformat()
        conn.execute('INSERT INTO invoices VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(student_id, period) DO NOTHING',
                     (str(uuid4()), student['id'], month, plan['amount_cents'], due, now()))
        month = f'{year + (number == 12):04d}-{number % 12 + 1:02d}'


def snapshot(conn, student_ids):
    ids = set(student_ids)
    invoices = []
    payments = []
    totals = {sid: {'amountDue': 0, 'tuitionStatus': 'paid', 'billingConfigured': False} for sid in ids}
    rows = conn.execute('''SELECT i.*, COALESCE(SUM(CASE WHEN p.voided_at IS NULL THEN p.amount_cents ELSE 0 END), 0) AS paid
                          FROM invoices i LEFT JOIN payments p ON p.invoice_id = i.id GROUP BY i.id
                          ORDER BY i.due_date, i.id''').fetchall()
    for row in rows:
        sid = row['student_id']
        if sid not in ids:
            continue
        balance = row['amount_cents'] - row['paid']
        overdue = balance > 0 and row['due_date'] < date.today().isoformat()
        status = 'paid' if balance == 0 else 'partial' if row['paid'] else 'unpaid'
        invoices.append(dict(id=row['id'], studentId=sid, period=row['period'], amount=row['amount_cents']/100,
                             paid=row['paid']/100, balance=balance/100, dueDate=row['due_date'], status=status, overdue=overdue))
        totals[sid]['amountDue'] += balance  # cents until serialization
        totals[sid]['billingConfigured'] = True
        if balance and totals[sid]['tuitionStatus'] != 'overdue':
            totals[sid]['tuitionStatus'] = 'overdue' if overdue else 'unpaid'
    for row in conn.execute('SELECT p.*, i.student_id, i.period FROM payments p JOIN invoices i ON i.id = p.invoice_id ORDER BY p.created_at DESC, p.id').fetchall():
        if row['student_id'] in ids:
            payments.append(dict(id=row['id'], invoiceId=row['invoice_id'], studentId=row['student_id'], period=row['period'],
                                 amount=row['amount_cents']/100, method=row['method'], paidOn=row['paid_on'], reference=row['reference'],
                                 note=row['note'], studentName=row['student_name'], parentName=row['parent_name'], parentPhone=row['parent_phone'],
                                 createdAt=row['created_at'], voidedAt=row['voided_at'], voidReason=row['void_reason']))
    plans = [dict(studentId=r['student_id'], amount=r['amount_cents']/100, startMonth=r['start_month'], endMonth=r['end_month'],
                  dueDay=r['due_day'], active=bool(r['active'])) for r in conn.execute('SELECT * FROM billing_plans').fetchall() if r['student_id'] in ids]
    for plan in plans:
        totals[plan['studentId']]['billingConfigured'] = True
    for total in totals.values():
        total['amountDue'] /= 100
    return dict(invoices=invoices, payments=payments, billingPlans=plans), totals


def audit_in_transaction(conn, event, payload):
    conn.execute('INSERT INTO audit_log(event, payload) VALUES (?, ?)', (event, json.dumps(payload)))


def request_fingerprint(payload):
    return hashlib.sha256(payload.model_dump_json().encode()).hexdigest()


def replay(conn, payload):
    row = conn.execute('SELECT * FROM finance_requests WHERE request_id = ?', (str(payload.requestId),)).fetchone()
    if row:
        if row['fingerprint'] != request_fingerprint(payload):
            raise HTTPException(409, 'This request was already used with different details. Refresh and try again.')
        return json.loads(row['response'])


def remember(conn, payload, response):
    conn.execute('INSERT INTO finance_requests VALUES (?, ?, ?)',
                 (str(payload.requestId), request_fingerprint(payload), json.dumps(response)))
