import { useMemo, useState } from "react";
import { FileDown, Plus, Search } from "lucide-react";
import { SectionTitle } from "../components/ui";
import { useAcademy } from "../data/academyStore";
import { localToday, usd, type Invoice, type Payment } from "../data/financeTypes";
import { downloadCsv } from "../utils/exportCsv";

// The academic year runs September through June, matching the finance team's spreadsheet.
const MONTH_OFFSETS = [8, 9, 10, 11, 0, 1, 2, 3, 4, 5]; // Sep..Dec of the first year, Jan..Jun of the next
const MONTH_LABELS = ["Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun"];
const DEFAULT_MONTHLY_TUITION = 600;

const input = "mt-1 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink";
const button = "rounded-lg bg-green-900 px-4 py-2.5 text-sm font-semibold text-cream disabled:opacity-40";

function academicYearOf(isoDate: string) {
  const [year, month] = isoDate.split("-").map(Number);
  return month >= 9 ? year : year - 1;
}

function periodsFor(startYear: number) {
  return MONTH_OFFSETS.map((offset) => {
    const year = offset >= 8 ? startYear : startYear + 1;
    return `${year}-${String(offset + 1).padStart(2, "0")}`;
  });
}

type Cell = { invoice?: Invoice; paid: number };

export function PaymentsMatrixPage() {
  const { students, invoices, payments, billingPlans, today, recordLedgerEntry, voidPayment, apiOnline } = useAcademy();
  const [startYear, setStartYear] = useState(() => academicYearOf(today || localToday()));
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [draft, setDraft] = useState({ studentId: "", period: "", amount: "" });

  const periods = useMemo(() => periodsFor(startYear), [startYear]);
  const years = useMemo(() => {
    const seen = new Set<number>([startYear, academicYearOf(today || localToday())]);
    invoices.forEach((invoice) => /^\d{4}-\d{2}$/.test(invoice.period) && seen.add(academicYearOf(`${invoice.period}-01`)));
    return [...seen].sort((a, b) => b - a);
  }, [invoices, startYear, today]);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return students
      .filter((student) => showArchived || student.enrollmentStatus !== "terminated")
      .filter((student) => !needle || `${student.name} ${student.parentName} ${student.parentPhone} ${student.klass}`.toLowerCase().includes(needle))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((student) => {
        const cells: Cell[] = periods.map((period) => {
          const invoice = invoices.find((item) => item.studentId === student.id && item.period === period && !item.voided);
          return { invoice, paid: invoice?.paid ?? 0 };
        });
        const paidTotal = cells.reduce((sum, cell) => sum + cell.paid, 0);
        const plan = billingPlans.find((item) => item.studentId === student.id);
        const monthly = plan?.amount ?? DEFAULT_MONTHLY_TUITION;
        const billed = cells.reduce((sum, cell) => sum + (cell.invoice?.amount ?? 0), 0);
        // Expected for the year: the plan's monthly amount across the ten months, never less than what was actually billed.
        const expected = Math.max(monthly * periods.length, billed);
        return { student, cells, paidTotal, expected, hasPlan: Boolean(plan) };
      });
  }, [students, invoices, billingPlans, periods, query, showArchived]);

  const columnTotals = periods.map((_, index) => rows.reduce((sum, row) => sum + row.cells[index].paid, 0));
  const grandPaid = rows.reduce((sum, row) => sum + row.paidTotal, 0);
  const grandExpected = rows.reduce((sum, row) => sum + row.expected, 0);

  const ledger = useMemo(
    () => payments
      .filter((payment) => periods.includes(payment.period))
      .sort((a, b) => b.paidOn.localeCompare(a.paidOn) || b.createdAt.localeCompare(a.createdAt)),
    [payments, periods]
  );

  const run = async (action: () => Promise<void>, message: string) => {
    if (busy) return;
    setBusy(true); setError(""); setNotice("");
    try { await action(); setNotice(message); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not save. Check the ledger before retrying."); }
    finally { setBusy(false); }
  };

  const pickCell = (studentId: string, period: string, cell: Cell) => {
    const remaining = cell.invoice ? cell.invoice.balance : billingPlans.find((item) => item.studentId === studentId)?.amount ?? DEFAULT_MONTHLY_TUITION;
    setDraft({ studentId, period, amount: remaining > 0 ? remaining.toFixed(2) : "" });
    setNotice(""); setError("");
    document.getElementById("ledger-entry-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const exportMatrix = () => {
    downloadCsv(`tuition-matrix-${startYear}-${startYear + 1}.csv`, [
      ["Student", "Parent", "Phone", "Group", ...MONTH_LABELS, "Paid to date", "Expected", "Progress"],
      ...rows.map((row) => [
        row.student.name, row.student.parentName, row.student.parentPhone, row.student.klass,
        ...row.cells.map((cell) => cell.paid), row.paidTotal, row.expected, `${Math.round((row.paidTotal / row.expected) * 100)}%`,
      ]),
      ["Total", "", "", "", ...columnTotals, grandPaid, grandExpected, grandExpected ? `${Math.round((grandPaid / grandExpected) * 100)}%` : ""],
    ]);
  };

  const exportLedger = () => {
    downloadCsv(`tuition-ledger-${startYear}-${startYear + 1}.csv`, [
      ["Transaction Date", "Student Name", "Parent Name", "Payment For Month", "Amount Paid", "Method", "Reference", "Status", "Receipt"],
      ...ledger.map((payment) => [payment.paidOn, payment.studentName, payment.parentName, monthLabel(payment.period), payment.amount,
        payment.method.replaceAll("_", " "), payment.reference, payment.voidedAt ? "VOID" : "Received", payment.id]),
    ]);
  };

  const cellTone = (cell: Cell) => {
    if (!cell.invoice) return "bg-white text-ink/35";
    if (cell.invoice.balance <= 0) return "bg-emerald-50 text-emerald-900";
    if (cell.paid > 0) return "bg-amber-50 text-amber-900";
    return cell.invoice.overdue ? "bg-red-50 text-red-800" : "bg-white text-ink/70";
  };

  return <div className="space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <SectionTitle eyebrow="Finance" title="Payments matrix" sub="Who paid what for each month of the school year. Enter received money below; every cell updates from the ledger." />
      <div className="flex flex-wrap gap-2">
        <select aria-label="School year" value={startYear} onChange={(event) => setStartYear(Number(event.target.value))} className="rounded-lg border border-line bg-white px-3 py-2.5 text-sm font-semibold">
          {years.map((year) => <option key={year} value={year}>{year}–{year + 1}</option>)}
        </select>
        <button className={button} disabled={!rows.length} onClick={exportMatrix}><FileDown size={16} className="mr-2 inline" />Export matrix</button>
      </div>
    </div>
    {!apiOnline && <p role="status" className="rounded-lg bg-amber-50 p-3 text-amber-900">Connection unavailable. Displayed data may be outdated. A payment is confirmed only after the server saves it.</p>}
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">{error}</p>}
    {notice && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-emerald-800">{notice}</p>}

    <div className="grid gap-3 sm:grid-cols-3">
      {[["Collected this year", usd.format(grandPaid)], ["Expected for the year", usd.format(grandExpected)], ["Progress", grandExpected ? `${Math.round((grandPaid / grandExpected) * 100)}%` : "—"]].map(([label, value]) =>
        <div key={label} className="rounded-xl border border-line bg-white p-5 shadow-sm"><p className="text-sm text-ink/55">{label}</p><p className="mt-3 text-2xl font-bold tracking-tight">{value}</p></div>)}
    </div>

    <section id="ledger-entry-form" className="rounded-xl border border-line bg-white p-5">
      <h2 className="flex items-center gap-2 font-bold"><Plus size={18} /> Record a payment</h2>
      <p className="mt-1 text-sm text-ink/50">Date received, student, the month it pays for, and the amount — like a row in the ledger. The month's invoice is created automatically if it does not exist yet.</p>
      <form className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const payload = {
          studentId: draft.studentId, period: draft.period, amount: draft.amount,
          method: String(form.get("method")), paidOn: String(form.get("paidOn")), reference: String(form.get("reference")), note: String(form.get("note")),
        };
        const student = students.find((item) => item.id === payload.studentId);
        void run(async () => { await recordLedgerEntry(payload); setDraft({ studentId: payload.studentId, period: "", amount: "" }); },
          `${usd.format(Number(payload.amount))} recorded for ${student?.name ?? "student"} · ${monthLabel(payload.period)}. Matrix and balances updated.`);
      }}>
        <label className="text-sm">Transaction date<input name="paidOn" type="date" required defaultValue={localToday()} max={localToday()} className={input} disabled={busy} /></label>
        <label className="text-sm">Student<select required value={draft.studentId} onChange={(event) => setDraft({ ...draft, studentId: event.target.value })} className={input} disabled={busy}>
          <option value="">Select a student</option>
          {students.filter((student) => student.enrollmentStatus !== "terminated").sort((a, b) => a.name.localeCompare(b.name)).map((student) => <option key={student.id} value={student.id}>{student.name} · {student.parentName}</option>)}
        </select></label>
        <label className="text-sm">Payment for month<select required value={draft.period} onChange={(event) => setDraft({ ...draft, period: event.target.value })} className={input} disabled={busy}>
          <option value="">Select a month</option>
          {periods.map((period) => <option key={period} value={period}>{monthLabel(period)}</option>)}
        </select></label>
        <label className="text-sm">Amount paid (USD)<input type="number" required min="0.01" max="100000" step="0.01" value={draft.amount} onChange={(event) => setDraft({ ...draft, amount: event.target.value })} className={input} disabled={busy} /></label>
        <label className="text-sm">Method<select name="method" className={input} disabled={busy}><option value="zeffy">Zeffy</option><option value="cash">Cash</option><option value="bank_transfer">Bank transfer</option><option value="check">Check</option><option value="card_external">Other card payment</option></select></label>
        <label className="text-sm">Reference<input name="reference" maxLength={200} placeholder="Zeffy, bank or check reference" className={input} disabled={busy} /></label>
        <label className="text-sm lg:col-span-2">Note<input name="note" maxLength={1000} className={input} disabled={busy} /></label>
        <button className={`${button} sm:col-span-2 lg:col-span-4`} disabled={busy || !draft.studentId || !draft.period || !draft.amount}>{busy ? "Saving…" : "Record payment"}</button>
      </form>
    </section>

    <section className="rounded-xl border border-line bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center">
        <label className="relative flex-1"><Search className="absolute left-3 top-3 text-ink/35" size={17} /><span className="sr-only">Search students</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search student, parent, phone, group…" className="w-full rounded-lg border border-line bg-cream py-2.5 pl-10 pr-3 text-sm" /></label>
        <label className="flex items-center gap-2 text-sm text-ink/70"><input type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} /> Show archived students</label>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead className="border-b border-line bg-slate-50 text-xs uppercase tracking-wide text-ink/50">
            <tr>
              <th className="px-4 py-3 font-semibold">#</th>
              <th className="px-4 py-3 font-semibold">Student / parent</th>
              <th className="px-4 py-3 font-semibold">Paid to date</th>
              {MONTH_LABELS.map((label) => <th key={label} className="px-2 py-3 text-center font-semibold">{label}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const percent = Math.min(100, Math.round((row.paidTotal / row.expected) * 100));
              return <tr key={row.student.id} className="border-b border-line last:border-0">
                <td className="px-4 py-3 text-ink/45">{index + 1}</td>
                <td className="whitespace-nowrap px-4 py-3">
                  <span className="font-semibold">{row.student.name}</span>
                  {row.student.enrollmentStatus === "terminated" && <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-ink/55">archived</span>}
                  <span className="block text-xs text-ink/45">{row.student.parentName} · {row.student.parentPhone}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="h-2.5 w-36 overflow-hidden rounded-full bg-slate-100" title={`${usd.format(row.paidTotal)} of ${usd.format(row.expected)}`}>
                    <div className={`h-full rounded-full ${percent >= 100 ? "bg-emerald-500" : percent > 0 ? "bg-emerald-400" : "bg-slate-200"}`} style={{ width: `${percent}%` }} />
                  </div>
                  <span className="mt-1 block text-xs tabular-nums text-ink/60">{usd.format(row.paidTotal)} · {percent}%{row.hasPlan ? "" : " · no plan"}</span>
                </td>
                {row.cells.map((cell, cellIndex) => (
                  <td key={periods[cellIndex]} className="px-1 py-1">
                    <button type="button" disabled={busy} onClick={() => pickCell(row.student.id, periods[cellIndex], cell)}
                      title={cell.invoice ? `Billed ${usd.format(cell.invoice.amount)} · paid ${usd.format(cell.paid)} · due ${cell.invoice.dueDate}` : "No invoice yet — click to record a payment"}
                      className={`w-full rounded-md px-2 py-2 text-center text-sm tabular-nums transition hover:ring-2 hover:ring-green-800/40 ${cellTone(cell)}`}>
                      {cell.paid ? usd.format(cell.paid) : cell.invoice ? "—" : ""}
                    </button>
                  </td>
                ))}
              </tr>;
            })}
          </tbody>
          {rows.length > 0 && <tfoot className="border-t-2 border-line bg-slate-50 text-sm font-semibold">
            <tr>
              <td className="px-4 py-3" colSpan={2}>Total</td>
              <td className="px-4 py-3 tabular-nums">{usd.format(grandPaid)}</td>
              {columnTotals.map((total, index) => <td key={periods[index]} className="px-2 py-3 text-center tabular-nums">{total ? usd.format(total) : ""}</td>)}
            </tr>
          </tfoot>}
        </table>
      </div>
      {!rows.length && <p className="p-8 text-center text-sm text-ink/50">No students match this view.</p>}
      <p className="border-t border-line px-4 py-3 text-xs text-ink/50">Green: month fully paid. Amber: partly paid. Red: unpaid and past due. "—": billed, nothing received yet. Click any cell to record a payment for that student and month.</p>
    </section>

    <section className="rounded-xl border border-line bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="font-bold">Transactions ledger</h2><p className="mt-1 text-xs text-ink/50">Every payment received this school year, newest first. Void a mistaken row instead of deleting it.</p></div>
        <button className={button} disabled={!ledger.length} onClick={exportLedger}><FileDown size={16} className="mr-2 inline" />Export ledger</button>
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className="border-b border-line text-xs uppercase tracking-wide text-ink/50"><tr>{["Date", "Student", "Parent", "For month", "Amount", "Method", "Reference", ""].map((heading, index) => <th key={index} className="px-3 py-2 font-semibold">{heading}</th>)}</tr></thead>
          <tbody>
            {ledger.slice(0, 200).map((payment) => <LedgerRow key={payment.id} payment={payment} busy={busy} onVoid={(reason) => run(() => voidPayment(payment.id, reason), "Payment voided. Matrix and balances updated.")} />)}
          </tbody>
        </table>
      </div>
      {!ledger.length && <p className="py-5 text-sm text-ink/50">No payments recorded for this school year yet.</p>}
      {ledger.length > 200 && <p className="pt-3 text-xs text-ink/50">Showing the latest 200 rows. Export the ledger for the full list.</p>}
    </section>
  </div>;
}

function monthLabel(period: string) {
  if (!/^\d{4}-\d{2}$/.test(period)) return period;
  const [year, month] = period.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleString("en-US", { month: "long", year: "numeric" });
}

function LedgerRow({ payment, busy, onVoid }: { payment: Payment; busy: boolean; onVoid: (reason: string) => Promise<void> }) {
  const [reason, setReason] = useState("");
  const [open, setOpen] = useState(false);
  return <tr className={`border-b border-line last:border-0 ${payment.voidedAt ? "text-ink/40" : ""}`}>
    <td className="whitespace-nowrap px-3 py-2">{payment.paidOn}</td>
    <td className="px-3 py-2 font-semibold">{payment.studentName}</td>
    <td className="px-3 py-2">{payment.parentName}</td>
    <td className="whitespace-nowrap px-3 py-2">{monthLabel(payment.period)}</td>
    <td className={`px-3 py-2 tabular-nums ${payment.voidedAt ? "line-through" : "font-semibold text-emerald-700"}`}>{usd.format(payment.amount)}</td>
    <td className="px-3 py-2">{payment.method.replaceAll("_", " ")}</td>
    <td className="px-3 py-2 text-xs">{payment.reference}</td>
    <td className="px-3 py-2 text-xs">
      {payment.voidedAt ? <span className="text-red-700">VOID · {payment.voidReason}</span> : open
        ? <form className="flex gap-1" onSubmit={(event) => { event.preventDefault(); void onVoid(reason.trim()); }}>
            <input aria-label="Reason for voiding" required minLength={5} maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Reason" className="w-32 rounded border border-line px-2 py-1" disabled={busy} />
            <button className="rounded bg-red-700 px-2 py-1 text-white disabled:opacity-40" disabled={busy || reason.trim().length < 5}>Void</button>
            <button type="button" className="px-1 text-ink/50" onClick={() => setOpen(false)}>Cancel</button>
          </form>
        : <button type="button" className="text-ink/50 underline" onClick={() => setOpen(true)} disabled={busy}>Correct</button>}
    </td>
  </tr>;
}
