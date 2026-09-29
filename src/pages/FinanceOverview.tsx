import { useMemo, useState } from "react";
import { Download, MessageCircle, Search, Send, WalletCards } from "lucide-react";
import { useAcademy } from "../data/academyStore";
import { usd } from "../data/financeTypes";
import { SectionTitle } from "../components/ui";

export function FinanceOverview() {
  const { students, invoices, payments, downloadFinanceExport, createTelegramLink, sendTelegramReminder } = useAcademy();
  const [query, setQuery] = useState("");
  const [month, setMonth] = useState("all");
  const [busyId, setBusyId] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const months = useMemo(() => [...new Set(invoices.map((invoice) => invoice.period))].sort().reverse(), [invoices]);
  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return invoices.filter((invoice) => {
      const student = students.find((item) => item.id === invoice.studentId);
      return student && (month === "all" || invoice.period === month) &&
        (!needle || `${student.name} ${student.parentName} ${student.parentPhone} ${student.teacher} ${student.klass}`.toLowerCase().includes(needle));
    });
  }, [invoices, students, month, query]);

  const received = rows.reduce((sum, invoice) => sum + invoice.paid, 0);
  const due = rows.reduce((sum, invoice) => sum + invoice.balance, 0);
  const overdue = rows.filter((invoice) => invoice.overdue);
  const run = async (id: string, action: () => Promise<void>, success: string) => {
    setBusyId(id); setNotice(""); setError("");
    try { await action(); setNotice(success); } catch (reason) { setError(reason instanceof Error ? reason.message : "Action failed"); }
    finally { setBusyId(""); }
  };
  const connect = (studentId: string) => run(`link:${studentId}`, async () => {
    const url = await createTelegramLink(studentId);
    await navigator.clipboard.writeText(url);
  }, "Telegram connection link copied. Send it to the parent; the link is valid for 7 days.");

  return <div className="space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <SectionTitle eyebrow="Finance" title="Accounting" sub="Invoices, collections, family balances and Telegram reminders in one place." />
      <button className="inline-flex items-center gap-2 rounded-lg bg-green-900 px-4 py-2.5 text-sm font-semibold text-white" onClick={() => void run("export", downloadFinanceExport, "Invoice report downloaded.")} disabled={Boolean(busyId)}><Download size={16} /> Export report</button>
    </div>
    {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
    {notice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p>}

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[["Outstanding", usd.format(due)], ["Collected", usd.format(received)], ["Overdue", String(overdue.length)], ["Telegram ready", String(students.filter((s) => s.telegramConnected).length)]].map(([label, value], index) =>
        <div className="rounded-xl border border-line bg-white p-5 shadow-sm" key={label}><div className="flex items-center justify-between"><p className="text-sm text-ink/55">{label}</p>{index === 3 ? <MessageCircle size={18} className="text-sky-600" /> : <WalletCards size={18} className="text-ink/25" />}</div><p className="mt-3 text-2xl font-bold tracking-tight">{value}</p></div>)}
    </div>

    <div className="flex flex-col gap-3 rounded-xl border border-line bg-white p-3 sm:flex-row">
      <label className="relative flex-1"><Search className="absolute left-3 top-3 text-ink/35" size={17} /><span className="sr-only">Search accounting records</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search student, parent, phone, group…" className="w-full rounded-lg border border-line bg-cream py-2.5 pl-10 pr-3 text-sm" /></label>
      <select aria-label="Billing period" value={month} onChange={(event) => setMonth(event.target.value)} className="rounded-lg border border-line bg-white px-3 text-sm"><option value="all">All billing periods</option>{months.map((item) => <option key={item}>{item}</option>)}</select>
    </div>

    <section className="overflow-hidden rounded-xl border border-line bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1050px] text-left text-sm">
          <thead className="border-b border-line bg-slate-50 text-xs uppercase tracking-wide text-ink/50"><tr>{["Student / parent", "Class", "Period", "Billed", "Paid", "Balance", "Telegram"].map((heading) => <th className="px-4 py-3 font-semibold" key={heading}>{heading}</th>)}</tr></thead>
          <tbody>{rows.map((invoice) => { const student = students.find((item) => item.id === invoice.studentId)!; return <tr className="border-b border-line last:border-0 hover:bg-slate-50/70" key={invoice.id}>
            <td className="whitespace-nowrap px-4 py-3"><span className="font-semibold">{student.name}</span><span className="ml-2 text-xs text-ink/45">{student.parentName} · {student.parentPhone}</span></td>
            <td className="whitespace-nowrap px-4 py-3">{student.klass}<span className="ml-1 text-xs text-ink/45">· {student.teacher}</span></td>
            <td className="whitespace-nowrap px-4 py-3">{invoice.period}<span className="ml-1 text-xs text-ink/45">· due {invoice.dueDate}</span></td>
            <td className="px-4 py-3 tabular-nums">{usd.format(invoice.amount)}</td><td className="px-4 py-3 tabular-nums text-emerald-700">{usd.format(invoice.paid)}</td>
            <td className={`px-4 py-3 font-semibold tabular-nums ${invoice.overdue ? "text-red-700" : ""}`}>{usd.format(invoice.balance)}<span className="ml-2 rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium text-ink/55">{invoice.overdue ? "Overdue" : invoice.status}</span></td>
            <td className="whitespace-nowrap px-4 py-3">{student.telegramConnected ? <button disabled={Boolean(busyId) || invoice.balance <= 0} onClick={() => void run(`send:${invoice.id}`, () => sendTelegramReminder(student.id, invoice.id), `Reminder sent to ${student.parentName}.`)} className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"><Send size={14} />{busyId === `send:${invoice.id}` ? "Sending…" : "Send reminder"}</button> : <button disabled={Boolean(busyId)} onClick={() => void connect(student.id)} className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-800 disabled:opacity-40"><MessageCircle size={14} />{busyId === `link:${student.id}` ? "Creating…" : "Connect parent"}</button>}</td>
          </tr>; })}</tbody>
        </table>
      </div>
      {!rows.length && <div className="grid min-h-40 place-items-center p-8 text-center text-sm text-ink/50">No accounting records match this filter.</div>}
    </section>

    <section className="rounded-xl border border-line bg-white p-5"><h2 className="font-semibold">Recent receipts</h2><div className="mt-2 divide-y divide-line">{payments.slice(0, 8).map((payment) => <div key={payment.id} className="flex items-center justify-between gap-4 py-3 text-sm"><p className="min-w-0 truncate"><span className="font-medium">{payment.studentName}</span><span className="text-ink/45"> · {payment.period} · {payment.paidOn}</span></p><p className={payment.voidedAt ? "text-red-700 line-through" : "font-semibold text-emerald-700"}>{usd.format(payment.amount)}</p></div>)}</div>{!payments.length && <p className="py-5 text-sm text-ink/50">No payments recorded yet.</p>}</section>
  </div>;
}
