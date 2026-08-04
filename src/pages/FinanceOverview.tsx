import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  Bell,
  CheckCircle2,
  CreditCard,
  Download,
  Filter,
  ReceiptText,
  Search,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { SectionTitle } from "../components/ui";
import { useAcademy } from "../data/academyStore";
import type { MonthlyPaymentStatus, PaymentStatus } from "../data/mockData";

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function FinanceMetric({
  label,
  value,
  detail,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Wallet;
  tone?: "default" | "dark" | "warn" | "good";
}) {
  const styles = {
    default: "border-line bg-white text-ink",
    dark: "border-green-800 bg-green-900 text-cream",
    warn: "border-amber-200 bg-amber-50 text-amber-950",
    good: "border-emerald-200 bg-emerald-50 text-emerald-950",
  };

  return (
    <div className={`rounded-xl border p-4 shadow-sm ${styles[tone]}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={`text-xs font-semibold uppercase ${tone === "dark" ? "text-gold-300" : "text-ink/45"}`}>
            {label}
          </p>
          <p className="mt-2 text-2xl font-semibold">{value}</p>
        </div>
        <div className={`rounded-lg p-2 ${tone === "dark" ? "bg-white/10 text-gold-300" : "bg-white/80 text-ink/50"}`}>
          <Icon size={18} />
        </div>
      </div>
      <p className={`mt-3 text-xs ${tone === "dark" ? "text-cream/65" : "text-ink/50"}`}>{detail}</p>
    </div>
  );
}

const paymentStatusOptions: { key: PaymentStatus | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "overdue", label: "Overdue" },
  { key: "unpaid", label: "Pending" },
  { key: "paid", label: "Paid" },
];

export function FinanceOverview() {
  const {
    students,
    tuitionMonths,
    tuitionRecords,
    queueReminder,
    downloadFinanceExport,
    downloadReceipts,
    reconcileFinance,
    updateTuitionRecord,
  } = useAcademy();
  const [notice, setNotice] = useState("Finance dashboard is current for July 2026.");
  const [reminded, setReminded] = useState<string[]>([]);
  const [workingAction, setWorkingAction] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | "all">("all");

  const summary = useMemo(() => {
    const overdue = students.filter((student) => student.tuitionStatus === "overdue");
    const pending = students.filter((student) => student.tuitionStatus === "unpaid");
    const paid = students.filter((student) => student.tuitionStatus === "paid");
    const financeFlags = students.filter((student) => student.attendance === "absent" || student.enrollmentStatus === "terminated" || student.financeNote);
    const totalDue = students.reduce((sum, student) => sum + student.amountDue, 0);
    const collectible = totalDue + paid.length * 450;
    const collectionRate = collectible ? Math.round(((paid.length * 450) / collectible) * 100) : 0;
    return { overdue, pending, paid, financeFlags, totalDue, collectionRate };
  }, [students]);

  const queue = [...summary.overdue, ...summary.pending]
    .filter((student) => {
      const matchesStatus = statusFilter === "all" || student.tuitionStatus === statusFilter;
      const matchesQuery = `${student.name} ${student.parentName} ${student.parentPhone} ${student.klass} ${student.teacher}`
        .toLowerCase()
        .includes(query.toLowerCase());
      return matchesStatus && matchesQuery;
    })
    .sort((a, b) => b.amountDue - a.amountDue);
  const collectedEstimate = summary.paid.length * 450;
  const highestDue = Math.max(...students.map((student) => student.amountDue), 1);
  const tuitionMap = useMemo(() => {
    const map = new Map<string, (typeof tuitionRecords)[number]>();
    tuitionRecords.forEach((record) => map.set(`${record.studentId}:${record.month}`, record));
    return map;
  }, [tuitionRecords]);

  const paymentCellClass: Record<MonthlyPaymentStatus, string> = {
    paid: "bg-emerald-400/90 text-emerald-950",
    partial: "bg-yellow-300 text-yellow-950",
    unpaid: "bg-red-500 text-white",
    sponsor: "bg-yellow-200 text-yellow-950",
    voucher: "bg-cyan-200 text-cyan-950",
    absent: "bg-red-500 text-white",
  };

  const remindFamily = (id: string, parentName: string) => {
    void queueReminder({ studentId: id, parentName });
    setReminded((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setNotice(`Reminder queued for ${parentName}.`);
  };

  const queueAll = () => {
    void queueReminder({ scope: "finance-overview", studentIds: queue.map((student) => student.id) });
    setReminded(queue.map((student) => student.id));
    setNotice(`${queue.length} payment reminders queued.`);
  };

  const runAction = async (key: string, action: () => Promise<void>) => {
    setWorkingAction(key);
    try {
      await action();
    } catch {
      setNotice("Action failed. Check the API connection and try again.");
    } finally {
      setWorkingAction(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <SectionTitle
          eyebrow="Finance"
          title="Finance overview"
          sub="Tuition collection, family follow-ups, monthly status, and export tools in one operating view."
        />
        <div className="flex flex-wrap gap-2 rounded-xl border border-line bg-white p-2 shadow-sm">
          <button
            onClick={queueAll}
            className="inline-flex items-center gap-2 rounded-lg bg-green-900 px-4 py-2.5 text-sm font-semibold text-cream hover:bg-green-800"
          >
            <Bell size={16} /> Queue reminders
          </button>
          <button
            onClick={() =>
              void runAction("export", async () => {
                await downloadFinanceExport();
                setNotice("Tuition report CSV downloaded.");
              })
            }
            disabled={workingAction === "export"}
            className="inline-flex items-center gap-2 rounded-lg border border-line bg-white px-4 py-2.5 text-sm font-semibold text-ink shadow-sm hover:border-gold-500 hover:text-gold-600"
          >
            <Download size={16} /> {workingAction === "export" ? "Exporting..." : "Export"}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">{notice}</div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <FinanceMetric label="Outstanding" value={usd.format(summary.totalDue)} detail={`${summary.overdue.length + summary.pending.length} families need follow-up`} icon={Wallet} tone="dark" />
        <FinanceMetric label="Collected" value={usd.format(collectedEstimate)} detail={`${summary.collectionRate}% collection rate estimate`} icon={TrendingUp} tone="good" />
        <FinanceMetric label="Overdue" value={String(summary.overdue.length)} detail="Prioritize these today" icon={Bell} tone="warn" />
        <FinanceMetric label="Flags" value={String(summary.financeFlags.length)} detail="Absent, notes, or terminated" icon={ReceiptText} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <section data-payment-queue className="rounded-xl border border-line bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-line px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="font-display text-lg text-ink">Payment queue</h3>
              <p className="mt-0.5 text-sm text-ink/45">Families sorted by balance, urgency, and current filter.</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <label className="relative min-w-64">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/35" size={16} />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search family, phone, group"
                  className="w-full rounded-lg border border-line bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-gold-500"
                />
              </label>
              <label className="relative">
                <Filter className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/35" size={15} />
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as PaymentStatus | "all")}
                  className="w-full rounded-lg border border-line bg-white py-2.5 pl-9 pr-8 text-sm outline-none focus:border-gold-500"
                >
                  {paymentStatusOptions.map((option) => (
                    <option key={option.key} value={option.key}>{option.label}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="divide-y divide-line">
            {queue.map((student) => (
              <div key={student.id} className="grid gap-4 px-5 py-4 md:grid-cols-[1fr_170px_126px] md:items-center">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">{student.name}</p>
                  <p className="mt-1 text-xs text-ink/45">
                    {student.parentName} · {student.parentPhone}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="rounded-full bg-cream px-2.5 py-1 text-[11px] font-semibold text-ink/50">{student.teacher}</span>
                    <span className="rounded-full bg-cream px-2.5 py-1 text-[11px] font-semibold text-ink/50">{student.klass}</span>
                    {student.attendance === "absent" && (
                      <span className="rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-600">Absent</span>
                    )}
                    {student.enrollmentStatus === "terminated" && (
                      <span className="rounded-full bg-red-600 px-2.5 py-1 text-[11px] font-semibold text-white">Terminated</span>
                    )}
                  </div>
                  {(student.financeNote || student.terminationNote) && (
                    <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                      {student.terminationNote || student.financeNote}
                    </p>
                  )}
                </div>
                <div>
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-sm font-semibold text-ink">{usd.format(student.amountDue)}</p>
                    <p className={student.tuitionStatus === "overdue" ? "text-xs font-semibold text-red-600" : "text-xs font-semibold text-amber-600"}>
                      {student.tuitionStatus === "overdue" ? "Overdue" : "Pending"}
                    </p>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-line">
                    <div
                      className={student.tuitionStatus === "overdue" ? "h-full rounded-full bg-red-500" : "h-full rounded-full bg-amber-400"}
                      style={{ width: `${Math.max(8, Math.round((student.amountDue / highestDue) * 100))}%` }}
                    />
                  </div>
                  <p className={student.tuitionStatus === "overdue" ? "text-xs text-red-600" : "text-xs text-amber-600"}>
                    Balance priority
                  </p>
                </div>
                <button
                  onClick={() => remindFamily(student.id, student.parentName)}
                  className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold ${
                    reminded.includes(student.id)
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-line text-ink/60 hover:border-gold-500 hover:text-gold-600"
                  }`}
                >
                  {reminded.includes(student.id) ? <CheckCircle2 size={14} /> : <Bell size={14} />}
                  {reminded.includes(student.id) ? "Queued" : "Remind"}
                </button>
              </div>
            ))}
            {queue.length === 0 && (
              <div className="px-5 py-12 text-center text-sm text-ink/40">
                No families match this finance queue filter.
              </div>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-line bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-lg text-ink">Collection health</h3>
              <p className="mt-0.5 text-sm text-ink/45">Current payment distribution</p>
            </div>
            <span className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700">
              {summary.collectionRate}%
            </span>
          </div>
          <div className="mt-5 space-y-5">
            {[
              { label: "Paid families", value: summary.paid.length, total: students.length, color: "bg-emerald-500" },
              { label: "Pending families", value: summary.pending.length, total: students.length, color: "bg-amber-400" },
              { label: "Overdue families", value: summary.overdue.length, total: students.length, color: "bg-red-500" },
            ].map((item) => {
              const pct = Math.round((item.value / item.total) * 100);
              return (
                <div key={item.label}>
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="font-medium text-ink">{item.label}</span>
                    <span className="text-ink/45">{pct}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-line">
                    <div className={`h-full rounded-full ${item.color}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 rounded-xl border border-line bg-cream/60 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-ink/60">
                <Wallet size={18} />
              </div>
              <div>
                <p className="text-sm font-semibold text-ink">Monthly tuition</p>
                <p className="text-xs text-ink/45">$450 standard plan · September-June only</p>
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              onClick={() =>
                void runAction("reconcile", async () => {
                  const result = await reconcileFinance();
                  setNotice(
                    `Reconciled: ${usd.format(result.totalDue)} outstanding, ${result.overdue} overdue, ${result.unpaid} pending.`
                  );
                })
              }
              disabled={workingAction === "reconcile"}
              className="flex items-center justify-center gap-2 rounded-lg border border-line px-3 py-2.5 text-xs font-semibold text-ink/65 hover:border-gold-500 hover:text-gold-600"
            >
              <CreditCard size={14} /> {workingAction === "reconcile" ? "Checking..." : "Reconcile"}
            </button>
            <button
              onClick={() =>
                void runAction("receipts", async () => {
                  await downloadReceipts();
                  setNotice("Paid-family receipts CSV downloaded.");
                })
              }
              disabled={workingAction === "receipts"}
              className="flex items-center justify-center gap-2 rounded-lg border border-line px-3 py-2.5 text-xs font-semibold text-ink/65 hover:border-gold-500 hover:text-gold-600"
            >
              <ReceiptText size={14} /> {workingAction === "receipts" ? "Preparing..." : "Receipts"}
            </button>
          </div>

          <button
            onClick={() => document.querySelector("[data-payment-queue]")?.scrollIntoView({ behavior: "smooth" })}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-green-900 px-4 py-2.5 text-sm font-semibold text-cream hover:bg-green-800"
          >
            Open payment queue <ArrowUpRight size={15} />
          </button>
        </section>
      </div>

      <section className="rounded-xl border border-line bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-display text-lg text-ink">Monthly tuition matrix</h3>
            <p className="mt-0.5 text-sm text-ink/45">Green paid, yellow partial/sponsor, red unpaid. Every cell is editable.</p>
          </div>
          <span className="rounded-lg bg-cream px-3 py-2 text-xs font-semibold text-ink/50">{tuitionMonths.length} program months · July/Aug off</span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[1360px] w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line bg-green-900 text-xs uppercase text-cream/80">
                <th className="sticky left-0 z-10 bg-green-900 px-4 py-3 font-semibold">Student</th>
                <th className="px-4 py-3 font-semibold">Teacher</th>
                <th className="px-4 py-3 font-semibold">Group</th>
                <th className="px-4 py-3 font-semibold">Parent</th>
                <th className="px-4 py-3 font-semibold">Phone</th>
                {tuitionMonths.map((month) => (
                  <th key={month} className="px-2 py-3 text-center font-semibold">{month.slice(0, 3)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <tr key={student.id} className="border-b border-line last:border-0 odd:bg-cream/30 hover:bg-gold-300/15">
                  <td className="sticky left-0 bg-white px-4 py-3 font-semibold text-ink shadow-[1px_0_0_rgba(15,23,32,0.08)]">{student.name}</td>
                  <td className="px-4 py-3 font-medium text-ink/65">{student.teacher}</td>
                  <td className="px-4 py-3 text-ink/60">{student.klass}</td>
                  <td className="px-4 py-3 text-ink/65">{student.parentName}</td>
                  <td className="px-4 py-3 text-ink/55">{student.parentPhone}</td>
                  {tuitionMonths.map((month) => {
                    const record = tuitionMap.get(`${student.id}:${month}`) ?? { status: "unpaid", amount: 0 };
                    const effectiveStatus = student.enrollmentStatus === "terminated" ? "absent" : record.status;
                    return (
                      <td key={month} className={`min-w-24 px-1.5 py-2 text-center ${paymentCellClass[effectiveStatus]}`}>
                        <select
                          value={effectiveStatus}
                          onChange={(event) => {
                            const status = event.target.value as MonthlyPaymentStatus;
                            const amount = status === "paid" ? 450 : status === "partial" ? Math.max(record.amount, 100) : 0;
                            void updateTuitionRecord(student.id, month, status, amount);
                          }}
                          className="w-full rounded border border-black/10 bg-white/75 px-1 py-1 text-[11px] font-semibold text-ink outline-none"
                        >
                          <option value="paid">paid</option>
                          <option value="partial">partial</option>
                          <option value="unpaid">unpaid</option>
                          <option value="sponsor">sponsor</option>
                          <option value="voucher">voucher</option>
                          <option value="absent">absent</option>
                        </select>
                        <input
                          type="number"
                          min={0}
                          value={record.amount}
                          onChange={(event) => void updateTuitionRecord(student.id, month, record.status, Number(event.target.value))}
                          className="mt-1 w-full rounded border border-black/10 bg-white/75 px-1 py-1 text-right text-[11px] font-semibold text-ink outline-none"
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
