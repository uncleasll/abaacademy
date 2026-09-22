import { useState } from 'react';
import { CreditCard, FileDown, Search } from 'lucide-react';
import { useAcademy } from '../data/academyStore';
import { localToday, usd, type BillingPlan, type Payment } from '../data/financeTypes';
import { downloadCsv } from '../utils/exportCsv';
import { SectionTitle } from '../components/ui';

const input = 'mt-1 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink';
const button = 'rounded-lg bg-green-900 px-4 py-2.5 text-sm font-semibold text-cream disabled:opacity-40';

export function TuitionPage() {
  const { students, invoices, payments, billingPlans, recordPayment, createInvoice, saveBillingPlan, voidPayment, apiOnline, downloadReceipts } = useAcademy();
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const selected = students.find(s => s.id === selectedId);
  const visible = students.filter(s => `${s.name} ${s.parentName} ${s.parentPhone} ${s.klass}`.toLowerCase().includes(query.toLowerCase()));
  const run = async (action: () => Promise<void>, message: string) => {
    if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try { await action(); setNotice(message); }
    catch (e) { setError(`Could not confirm the update. ${e instanceof Error ? e.message : 'Connection error.'} Check payment history before retrying; retrying the same payment details is safe.`); }
    finally { setBusy(false); }
  };
  return <div className="space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <SectionTitle eyebrow="Finance" title="Tuition & payments" sub="Choose a student, record the received payment, and let balances and reports update together." />
      <button className={button} disabled={busy} onClick={() => void run(downloadReceipts, 'Receipt history downloaded.')}><FileDown size={16} className="mr-2 inline" /> Export receipts</button>
    </div>
    {!apiOnline && <p role="status" className="rounded-lg bg-amber-50 p-3 text-amber-900">Connection unavailable. Displayed data may be outdated. A payment is confirmed only after the server saves it.</p>}
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">{error}</p>}
    {notice && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-emerald-800">{notice}</p>}
    <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
      <section className="rounded-xl border border-line bg-white p-4">
        <label className="text-sm font-semibold"><Search size={15} className="mr-2 inline" /> Find a student or parent
          <input className={input} placeholder="Name, parent, phone or group" value={query} onChange={e => setQuery(e.target.value)} />
        </label>
        <div className="mt-3 max-h-[650px] space-y-2 overflow-y-auto">
          {visible.map(s => <button key={s.id} disabled={busy} onClick={() => { setSelectedId(s.id); setError(''); setNotice(''); }} className={`w-full rounded-lg border p-3 text-left ${selectedId === s.id ? 'border-green-800 bg-green-50' : 'border-line hover:bg-cream'}`}>
            <p className="font-semibold">{s.name}</p><p className="mt-1 text-xs text-ink/60">{s.parentName} · {s.parentPhone}</p>
            <p className="mt-2 text-sm">{s.billingConfigured ? `${usd.format(s.amountDue)} outstanding` : 'Billing not set up'} <span className="text-xs text-ink/50">· {s.klass}</span></p>
          </button>)}
          {!visible.length && <p className="py-8 text-sm text-ink/50">No students found. Accepted applications appear here automatically.</p>}
        </div>
      </section>
      {selected ? <div className="space-y-5">
        <section className="rounded-xl bg-green-900 p-5 text-cream">
          <p className="text-xs uppercase text-gold-300">Student & family</p><h2 className="mt-1 text-xl font-bold">{selected.name}</h2>
          <p className="mt-2">{selected.parentName} · {selected.parentPhone}</p><p className="mt-1 text-sm text-cream/70">{selected.klass} · {selected.teacher}</p>
          <p className="mt-4 text-2xl font-bold">{usd.format(selected.amountDue)} <span className="text-sm font-normal">outstanding</span></p>
        </section>
        <PaymentForm key={selected.id} studentId={selected.id} busy={busy} run={run} submit={recordPayment} />
        <BillingForm key={`billing-${selected.id}-${JSON.stringify(billingPlans.find(p => p.studentId === selected.id))}`} studentId={selected.id} plan={billingPlans.find(p => p.studentId === selected.id)} busy={busy} run={run} save={saveBillingPlan} />
        <details className="rounded-xl border border-line bg-white p-5"><summary className="cursor-pointer font-semibold">Add a single monthly invoice</summary>
          <form className="mt-4 grid gap-3 sm:grid-cols-3" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); void run(() => createInvoice({ studentId: selected.id, period: String(f.get('period')), amount: String(f.get('amount')), dueDate: String(f.get('dueDate')) }), 'Invoice saved. Family balance and reports updated.'); }}>
            <label className="text-sm">Billing month<input name="period" type="month" defaultValue={localToday().slice(0, 7)} required className={input} /></label>
            <label className="text-sm">Tuition charge (USD)<input name="amount" type="number" min="0.01" max="100000" step="0.01" required className={input} /></label>
            <label className="text-sm">Due date<input name="dueDate" type="date" defaultValue={localToday()} required className={input} /></label>
            <button className={button} disabled={busy}>Create invoice</button>
          </form>
        </details>
        <section className="rounded-xl border border-line bg-white p-5"><h2 className="font-bold">Monthly balances</h2>
          <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-line"><th className="py-2">Period / due</th><th>Billed</th><th>Received</th><th>Remaining</th></tr></thead><tbody>
            {invoices.filter(i => i.studentId === selected.id).map(i => <tr className="border-b border-line" key={i.id}><td className="py-3">{i.period}<p className="text-xs text-ink/50">{i.dueDate}{i.overdue ? ' · overdue' : ''}</p></td><td>{usd.format(i.amount)}</td><td>{usd.format(i.paid)}</td><td className={i.overdue ? 'font-semibold text-red-700' : ''}>{usd.format(i.balance)}</td></tr>)}
          </tbody></table></div>
        </section>
        <section className="rounded-xl border border-line bg-white p-5"><h2 className="font-bold">Payment history & receipts</h2>
          <p className="mt-1 text-xs text-ink/50">Receipts keep the student and parent details from the day payment was recorded. Voiding corrects a record; it does not refund money.</p>
          {payments.filter(p => p.studentId === selected.id).map(p => <Receipt key={p.id} payment={p} busy={busy} onVoid={reason => run(() => voidPayment(p.id, reason), 'Payment voided. All balances updated.')} />)}
          {!payments.some(p => p.studentId === selected.id) && <p className="py-5 text-sm text-ink/50">No recorded payments yet.</p>}
        </section>
      </div> : <div className="grid min-h-64 place-items-center rounded-xl border border-dashed border-line p-8 text-center text-ink/50">Select a student to see their parent, balance and payment history.</div>}
    </div>
  </div>;
}

type Run = (action: () => Promise<void>, message: string) => Promise<void>;
function PaymentForm({ studentId, busy, run, submit }: { studentId: string; busy: boolean; run: Run; submit: ReturnType<typeof useAcademy>['recordPayment'] }) {
  const { invoices } = useAcademy();
  const open = invoices.filter(i => i.studentId === studentId && i.balance > 0);
  const [chosen, setChosen] = useState('');
  const [amount, setAmount] = useState('');
  const invoice = open.find(i => i.id === chosen) ?? open[0];
  const value = amount || invoice?.balance.toFixed(2) || '';
  return <section className="rounded-xl border border-line bg-white p-5"><h2 className="flex items-center gap-2 font-bold"><CreditCard size={18} /> Record received payment</h2>
    <p className="mt-1 text-sm text-ink/50">Record money already received. This form does not charge a card.</p>
    {invoice ? <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); void run(async () => { await submit({ studentId, invoiceId: invoice.id, amount: value, method: String(f.get('method')), paidOn: String(f.get('paidOn')), reference: String(f.get('reference')), note: String(f.get('note')) }); setAmount(''); }, 'Payment received. Parent record, balance, monthly totals and receipt updated.'); }}>
      <label className="text-sm">Invoice<select aria-label="Invoice" className={input} value={invoice.id} disabled={busy} onChange={e => { setChosen(e.target.value); setAmount(''); }}>{open.map(i => <option key={i.id} value={i.id}>{i.period} — {usd.format(i.balance)} remaining</option>)}</select></label>
      <label className="text-sm">Received amount (USD)<input className={input} type="number" required min="0.01" max={invoice.balance} step="0.01" value={value} disabled={busy} onChange={e => setAmount(e.target.value)} /></label>
      <label className="text-sm">Payment method<select name="method" className={input} disabled={busy}><option value="cash">Cash</option><option value="bank_transfer">Bank transfer</option><option value="check">Check</option><option value="card_external">Card paid outside this site</option></select></label>
      <label className="text-sm">Payment date<input name="paidOn" className={input} type="date" required defaultValue={localToday()} max={localToday()} disabled={busy} /></label>
      <label className="text-sm">Bank / check reference<input name="reference" className={input} maxLength={200} disabled={busy} /></label>
      <label className="text-sm">Note<input name="note" className={input} maxLength={1000} disabled={busy} /></label>
      <button className={`${button} sm:col-span-2`} disabled={busy}>{busy ? 'Saving…' : `Record ${value ? usd.format(Number(value)) : 'payment'}`}</button>
    </form> : <p className="mt-4 rounded-lg bg-cream p-3 text-sm">No outstanding invoices. Set up monthly billing below or add an invoice first.</p>}
  </section>;
}

function BillingForm({ studentId, plan, busy, run, save }: { studentId: string; plan?: BillingPlan; busy: boolean; run: Run; save: (plan: BillingPlan) => Promise<void> }) {
  return <details className="rounded-xl border border-line bg-white p-5" open={!plan}><summary className="cursor-pointer font-semibold">Automatic monthly billing {plan ? `· ${usd.format(plan.amount)} · ${plan.active ? 'on' : 'paused'}` : '· set up once'}</summary>
    <p className="mt-3 text-sm text-ink/55">One invoice per month from the first through the last month, including both. Due invoices appear automatically when staff open the app. Existing invoices stay unchanged. Use separate periods for school breaks.</p>
    <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); void run(() => save({ studentId, amount: Number(f.get('amount')), startMonth: String(f.get('startMonth')), endMonth: String(f.get('endMonth')), dueDay: Number(f.get('dueDay')), active: f.get('active') === 'on' }), 'Monthly billing saved. Due invoices and balances updated.'); }}>
      <label className="text-sm">Monthly tuition (USD)<input name="amount" className={input} type="number" min="0.01" max="100000" step="0.01" defaultValue={plan?.amount} required disabled={busy} /></label>
      <label className="text-sm">Due day of month (1–28)<input name="dueDay" className={input} type="number" min="1" max="28" defaultValue={plan?.dueDay ?? 1} required disabled={busy} /></label>
      <label className="text-sm">First billing month<input name="startMonth" className={input} type="month" defaultValue={plan?.startMonth ?? localToday().slice(0, 7)} required disabled={busy} /></label>
      <label className="text-sm">Last billing month<input name="endMonth" className={input} type="month" defaultValue={plan?.endMonth} required disabled={busy} /></label>
      <label className="text-sm"><input name="active" type="checkbox" defaultChecked={plan?.active ?? true} disabled={busy} /> Enable monthly billing</label>
      <p className="text-xs text-ink/50">If the first month is in the past, missing invoices through the current month will be created. Paused or terminated students receive no new invoices.</p>
      <button className={`${button} sm:col-span-2`} disabled={busy}>Save billing schedule</button>
    </form>
  </details>;
}

function Receipt({ payment: p, busy, onVoid }: { payment: Payment; busy: boolean; onVoid: (reason: string) => Promise<void> }) {
  const [reason, setReason] = useState('');
  return <div className="mt-4 rounded-lg border border-line p-4">
    <div className="flex flex-wrap justify-between gap-2"><p className="font-semibold">{usd.format(p.amount)} · {p.period} {p.voidedAt && <span className="text-red-700">· VOID</span>}</p><span className="text-xs text-ink/50">{p.paidOn} · {p.method.replaceAll('_', ' ')}</span></div>
    <p className="mt-1 text-sm">{p.studentName} · {p.parentName} · {p.parentPhone}</p><p className="mt-1 break-all text-xs text-ink/50">Receipt {p.id}</p>
    {p.reference && <p className="mt-1 text-xs">Reference: {p.reference}</p>}{p.note && <p className="mt-1 text-xs">{p.note}</p>}
    {p.voidedAt && <p className="mt-2 text-sm text-red-700">Correction: {p.voidReason}</p>}
    <button className="mt-3 text-sm font-semibold text-green-800 underline" onClick={() => downloadCsv(`receipt-${p.id}.csv`, [['Receipt', 'Student', 'Parent', 'Phone', 'Period', 'Amount USD', 'Date', 'Method', 'Reference', 'Status'], [p.id, p.studentName, p.parentName, p.parentPhone, p.period, p.amount, p.paidOn, p.method, p.reference, p.voidedAt ? 'VOID' : 'Received']])}>Download receipt</button>
    {!p.voidedAt && <details className="mt-3 text-sm"><summary className="cursor-pointer text-ink/50">Correct a mistaken payment</summary><form className="mt-2 flex flex-wrap gap-2" onSubmit={e => { e.preventDefault(); void onVoid(reason); }}><input aria-label="Reason for voiding payment" required minLength={5} maxLength={1000} className="min-w-48 flex-1 rounded border border-line p-2" placeholder="Reason for correction" value={reason} onChange={e => setReason(e.target.value)} disabled={busy} /><button className="rounded bg-red-700 px-3 py-2 text-white disabled:opacity-40" disabled={busy || reason.trim().length < 5}>Void payment record</button></form></details>}
  </div>;
}
