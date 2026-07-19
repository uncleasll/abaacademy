import { useMemo, useState } from "react";
import { ArrowUpRight, Bell, CheckCircle2, CreditCard, Download, ReceiptText, Wallet } from "lucide-react";
import { SectionTitle } from "../components/ui";
import { useAcademy } from "../data/academyStore";

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function FinanceMetric({
  label,
  value,
  detail,
  tone = "default",
}: {
  label: string;
  value: string;
  detail: string;
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
      <p className={`text-xs font-semibold uppercase ${tone === "dark" ? "text-gold-300" : "text-ink/45"}`}>
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
      <p className={`mt-2 text-xs ${tone === "dark" ? "text-cream/65" : "text-ink/50"}`}>{detail}</p>
    </div>
  );
}

export function FinanceOverview() {
  const { students, queueReminder, downloadFinanceExport, downloadReceipts, reconcileFinance } = useAcademy();
  const [notice, setNotice] = useState("Finance dashboard is current for July 2026.");
  const [reminded, setReminded] = useState<string[]>([]);
  const [workingAction, setWorkingAction] = useState<string | null>(null);

  const summary = useMemo(() => {
    const overdue = students.filter((student) => student.tuitionStatus === "overdue");
    const pending = students.filter((student) => student.tuitionStatus === "unpaid");
    const paid = students.filter((student) => student.tuitionStatus === "paid");
    const totalDue = students.reduce((sum, student) => sum + student.amountDue, 0);
    return { overdue, pending, paid, totalDue };
  }, [students]);

  const queue = [...summary.overdue, ...summary.pending].sort((a, b) => b.amountDue - a.amountDue);
  const collectedEstimate = summary.paid.length * 450;

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
          sub="Clean view of tuition collection, outstanding balances, and family follow-ups."
        />
        <div className="flex flex-wrap gap-2">
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
        <FinanceMetric label="Outstanding" value={usd.format(summary.totalDue)} detail={`${queue.length} families need follow-up`} tone="dark" />
        <FinanceMetric label="Collected" value={usd.format(collectedEstimate)} detail={`${summary.paid.length} students fully paid`} tone="good" />
        <FinanceMetric label="Overdue" value={String(summary.overdue.length)} detail="Prioritize these today" tone="warn" />
        <FinanceMetric label="Pending" value={String(summary.pending.length)} detail="Not overdue yet" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <section data-payment-queue className="rounded-xl border border-line bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <div>
              <h3 className="font-display text-lg text-ink">Payment queue</h3>
              <p className="mt-0.5 text-sm text-ink/45">Families sorted by balance and urgency.</p>
            </div>
            <button
              onClick={() => setNotice("Payment queue refreshed.")}
              className="text-xs font-semibold text-gold-600 hover:text-gold-500"
            >
              Refresh
            </button>
          </div>

          <div className="divide-y divide-line">
            {queue.map((student) => (
              <div key={student.id} className="grid gap-3 px-5 py-4 md:grid-cols-[1fr_150px_120px] md:items-center">
                <div>
                  <p className="text-sm font-semibold text-ink">{student.name}</p>
                  <p className="mt-1 text-xs text-ink/45">
                    {student.parentName} · {student.parentPhone} · {student.klass}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-ink">{usd.format(student.amountDue)}</p>
                  <p className={student.tuitionStatus === "overdue" ? "text-xs text-red-600" : "text-xs text-amber-600"}>
                    {student.tuitionStatus === "overdue" ? "Overdue" : "Pending"}
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
          </div>
        </section>

        <section className="rounded-xl border border-line bg-white p-5 shadow-sm">
          <h3 className="font-display text-lg text-ink">Collection health</h3>
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

          <div className="mt-6 rounded-xl bg-cream/60 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-ink/60">
                <Wallet size={18} />
              </div>
              <div>
                <p className="text-sm font-semibold text-ink">Monthly tuition</p>
                <p className="text-xs text-ink/45">$450 standard plan per active student</p>
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
    </div>
  );
}
