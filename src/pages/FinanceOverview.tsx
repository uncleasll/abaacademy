import { useState } from 'react';
import { useAcademy } from '../data/academyStore';
import { usd } from '../data/financeTypes';
import { SectionTitle } from '../components/ui';

export function FinanceOverview() {
  const { students, invoices, payments, tuitionRecords, downloadFinanceExport } = useAcademy();
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [month, setMonth] = useState('all');
  const months = [...new Set(invoices.map(i => i.period))].sort().reverse();
  const people = students.filter(s => `${s.name} ${s.parentName} ${s.parentPhone} ${s.teacher} ${s.klass}`.toLowerCase().includes(query.toLowerCase()));
  const ids = new Set(people.map(s => s.id));
  const rows = invoices.filter(i => ids.has(i.studentId) && (month === 'all' || i.period === month));
  const received = rows.reduce((sum, i) => sum + i.paid, 0);
  const due = rows.reduce((sum, i) => sum + i.balance, 0);
  const overdue = rows.filter(i => i.overdue);
  return <div className="space-y-5">
    <SectionTitle eyebrow="Finance" title="Collections overview" sub="Balances, parent details and monthly totals update automatically from recorded payments. Use Tuition & Payments to record a payment." />
    {error && <p role="alert" className="text-red-700">{error}</p>}
    <div className="flex flex-wrap gap-3"><input aria-label="Search finance records" placeholder="Student, parent, phone, teacher or group" className="min-w-64 flex-1 rounded-lg border border-line bg-white p-3" value={query} onChange={e => setQuery(e.target.value)} /><select aria-label="Billing month" className="rounded-lg border border-line bg-white p-3" value={month} onChange={e => setMonth(e.target.value)}><option value="all">All billing periods</option>{months.map(m => <option key={m}>{m}</option>)}</select><button className="rounded-lg bg-green-900 px-4 py-3 text-cream" onClick={() => void downloadFinanceExport().catch(e => setError(String(e)))}>Export all invoices</button></div>
    <div className="grid gap-3 sm:grid-cols-4">{[['Outstanding', usd.format(due)], ['Received', usd.format(received)], ['Overdue invoices', String(overdue.length)], ['Billing not set up', String(people.filter(s => !s.billingConfigured).length)]].map(([label, value]) => <div className="rounded-xl border border-line bg-white p-5" key={label}><p className="text-sm text-ink/50">{label}</p><p className="mt-2 text-2xl font-bold">{value}</p></div>)}</div>
    <section className="overflow-x-auto rounded-xl border border-line bg-white"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-green-900 text-cream"><tr>{['Student & parent', 'Group', 'Month / due', 'Billed', 'Received', 'Remaining'].map(h => <th className="p-4" key={h}>{h}</th>)}</tr></thead><tbody>{rows.map(i => { const s = students.find(s => s.id === i.studentId)!; return <tr className="border-b border-line" key={i.id}><td className="p-4"><p className="font-semibold">{s.name}</p><p className="mt-1 text-xs text-ink/60">{s.parentName} · {s.parentPhone}</p></td><td className="p-4">{s.klass}<p className="text-xs text-ink/50">{s.teacher}</p></td><td className="p-4">{i.period}<p className="text-xs text-ink/50">{i.dueDate}</p></td><td className="p-4">{usd.format(i.amount)}</td><td className="p-4">{usd.format(i.paid)}</td><td className={`p-4 font-semibold ${i.overdue ? 'text-red-700' : ''}`}>{usd.format(i.balance)}<p className="text-xs font-normal">{i.overdue ? 'Overdue' : i.status}</p></td></tr>; })}</tbody></table>{!rows.length && <p className="p-8 text-center text-sm text-ink/50">No invoices match. Set up a student's billing schedule in Tuition & Payments.</p>}</section>
    <section className="rounded-xl border border-line bg-white p-5"><h2 className="font-semibold">Recent receipts</h2>{payments.filter(p => ids.has(p.studentId) && (month === 'all' || p.period === month)).slice(0, 10).map(p => <div key={p.id} className="flex flex-wrap justify-between gap-2 border-b border-line py-3 text-sm"><div><p>{p.studentName} · {p.parentName}</p><p className="text-xs text-ink/50">{p.paidOn} · {p.period}</p></div><p className={p.voidedAt ? 'text-red-700 line-through' : 'font-semibold'}>{usd.format(p.amount)}{p.voidedAt ? ' · void' : ''}</p></div>)}</section>
    {tuitionRecords.some(r => r.legacy) && <details className="rounded-xl border border-line bg-white p-5"><summary className="cursor-pointer font-semibold">Historical manual records</summary><p className="mt-2 text-sm text-ink/60">Preserved for reference. These status cells are not receipts and are excluded from collected totals. Previous outstanding student balances were brought forward once as opening balances.</p><div className="mt-3 space-y-2">{tuitionRecords.filter(r => r.legacy && ids.has(r.studentId)).map(r => <p className="text-sm" key={`${r.studentId}:${r.month}`}>{students.find(s => s.id === r.studentId)?.name} · {r.month} · {r.status} · {usd.format(r.amount)}</p>)}</div></details>}
  </div>;
}
