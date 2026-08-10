import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  CreditCard,
  Download,
  Phone,
  ReceiptText,
  Search,
  ShieldAlert,
  Wallet,
} from "lucide-react";
import { useAcademy } from "../data/academyStore";
import type { MonthlyPaymentStatus, PaymentStatus, Student } from "../data/mockData";
import { downloadCsv, safeFilenamePart } from "../utils/exportCsv";

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const paymentStatusOptions: { key: PaymentStatus | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "overdue", label: "Overdue" },
  { key: "unpaid", label: "Pending" },
  { key: "paid", label: "Paid" },
];

function WorkbenchStat({
  label,
  value,
  detail,
  tone = "default",
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "default" | "dark" | "good" | "warn" | "bad";
}) {
  const styles = {
    default: "border-line bg-white text-ink",
    dark: "border-green-800 bg-green-900 text-cream",
    good: "border-emerald-200 bg-emerald-50 text-emerald-950",
    warn: "border-amber-200 bg-amber-50 text-amber-950",
    bad: "border-red-200 bg-red-50 text-red-950",
  };

  return (
    <div className={`rounded-lg border p-4 shadow-sm ${styles[tone]}`}>
      <p className={`text-xs font-semibold uppercase ${tone === "dark" ? "text-gold-300" : "text-ink/45"}`}>
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
      <p className={`mt-2 text-xs ${tone === "dark" ? "text-cream/65" : "text-ink/50"}`}>{detail}</p>
    </div>
  );
}

function StudentTags({ student, missed }: { student: Student; missed: number }) {
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      <span className="rounded-full bg-cream px-2.5 py-1 text-[11px] font-semibold text-ink/50">{student.teacher}</span>
      <span className="rounded-full bg-cream px-2.5 py-1 text-[11px] font-semibold text-ink/50">{student.klass}</span>
      {student.joinedDate && (
        <span className="rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-700">
          Joined {student.joinedDate}
        </span>
      )}
      {missed > 0 && (
        <span className="rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-600">
          {missed} missed
        </span>
      )}
      {student.enrollmentStatus === "terminated" && (
        <span className="rounded-full bg-red-600 px-2.5 py-1 text-[11px] font-semibold text-white">Do not contact</span>
      )}
    </div>
  );
}

export function FinanceOverview() {
  const {
    students,
    attendanceDates,
    attendanceRecords,
    tuitionMonths,
    tuitionRecords,
    queueReminder,
    downloadReceipts,
    reconcileFinance,
    updateTuitionRecord,
  } = useAcademy();
  const [notice, setNotice] = useState("Collections workbench is ready.");
  const [reminded, setReminded] = useState<string[]>([]);
  const [workingAction, setWorkingAction] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | "all">("all");
  const [monthFilter, setMonthFilter] = useState(tuitionMonths[tuitionMonths.length - 1] ?? "June");
  const [teacherFilter, setTeacherFilter] = useState("All teachers");
  const [groupFilter, setGroupFilter] = useState("All groups");

  const teachers = useMemo(() => Array.from(new Set(students.map((student) => student.teacher))), [students]);
  const groupOptions = useMemo(() => {
    if (teacherFilter === "All teachers") return Array.from(new Set(students.map((student) => student.klass)));
    return Array.from(new Set(students.filter((student) => student.teacher === teacherFilter).map((student) => student.klass)));
  }, [students, teacherFilter]);
  const scopedStudents = useMemo(
    () =>
      students.filter((student) => {
        const matchesTeacher = teacherFilter === "All teachers" || student.teacher === teacherFilter;
        const matchesGroup = groupFilter === "All groups" || student.klass === groupFilter;
        return matchesTeacher && matchesGroup;
      }),
    [groupFilter, students, teacherFilter]
  );
  const tuitionMap = useMemo(() => {
    const map = new Map<string, (typeof tuitionRecords)[number]>();
    tuitionRecords.forEach((record) => map.set(`${record.studentId}:${record.month}`, record));
    return map;
  }, [tuitionRecords]);
  const missedMap = useMemo(() => {
    const map = new Map<string, { missed: number; total: number }>();
    scopedStudents.forEach((student) => {
      const recent = attendanceDates
        .slice(-12)
        .map((date) => attendanceRecords.find((record) => record.studentId === student.id && record.date === date))
        .filter(Boolean);
      map.set(student.id, {
        missed: recent.filter((record) => !record!.present).length,
        total: recent.length,
      });
    });
    return map;
  }, [attendanceDates, attendanceRecords, scopedStudents]);

  const summary = useMemo(() => {
    const monthStatus = (studentId: string) => tuitionMap.get(`${studentId}:${monthFilter}`)?.status ?? "unpaid";
    const monthAmount = (studentId: string) => tuitionMap.get(`${studentId}:${monthFilter}`)?.amount ?? 0;
    const paid = scopedStudents.filter((student) => monthStatus(student.id) === "paid");
    const open = scopedStudents.filter((student) => monthStatus(student.id) !== "paid");
    const doNotContact = open.filter((student) => student.enrollmentStatus === "terminated");
    const contactable = open.filter((student) => student.enrollmentStatus !== "terminated");
    const totalDue = open.reduce((sum, student) => sum + (student.amountDue || Math.max(0, 450 - monthAmount(student.id))), 0);
    const collected = scopedStudents.reduce((sum, student) => sum + monthAmount(student.id), 0);
    const collectible = totalDue + collected;
    const collectionRate = collectible ? Math.round((collected / collectible) * 100) : 0;
    const risk = contactable.filter((student) => (missedMap.get(student.id)?.missed ?? 0) >= 2 || student.financeNote);
    const newStudents = scopedStudents.filter((student) => student.joinedDate);
    return { paid, open, doNotContact, contactable, totalDue, collected, collectionRate, risk, newStudents };
  }, [missedMap, monthFilter, scopedStudents, tuitionMap]);

  const contactQueue = summary.contactable
    .filter((student) => {
      const matchesStatus = statusFilter === "all" || student.tuitionStatus === statusFilter;
      const matchesQuery = `${student.name} ${student.parentName} ${student.parentPhone} ${student.klass} ${student.teacher}`
        .toLowerCase()
        .includes(query.toLowerCase());
      return matchesStatus && matchesQuery;
    })
    .sort((a, b) => {
      const missedDelta = (missedMap.get(b.id)?.missed ?? 0) - (missedMap.get(a.id)?.missed ?? 0);
      if (missedDelta) return missedDelta;
      return b.amountDue - a.amountDue;
    });
  const doNotContactQueue = summary.doNotContact.filter((student) =>
    `${student.name} ${student.parentName} ${student.parentPhone} ${student.klass} ${student.teacher}`.toLowerCase().includes(query.toLowerCase())
  );
  const highestDue = Math.max(...scopedStudents.map((student) => student.amountDue), 1);

  const paymentCellClass: Record<MonthlyPaymentStatus, string> = {
    paid: "bg-emerald-400/90 text-emerald-950",
    partial: "bg-yellow-300 text-yellow-950",
    unpaid: "bg-red-500 text-white",
    sponsor: "bg-yellow-200 text-yellow-950",
    voucher: "bg-cyan-200 text-cyan-950",
    absent: "bg-red-500 text-white",
  };

  const remindFamily = (student: Student) => {
    void queueReminder({ studentId: student.id, parentName: student.parentName, month: monthFilter });
    setReminded((prev) => (prev.includes(student.id) ? prev : [...prev, student.id]));
    setNotice(`Reminder queued for ${student.parentName}.`);
  };

  const queueAll = () => {
    void queueReminder({ scope: "finance-contact-today", month: monthFilter, studentIds: contactQueue.map((student) => student.id) });
    setReminded(contactQueue.map((student) => student.id));
    setNotice(`${contactQueue.length} contactable reminders queued. Terminated students were excluded.`);
  };

  const exportContactQueue = () => {
    downloadCsv(`finance-contact-${safeFilenamePart(monthFilter)}-${safeFilenamePart(statusFilter)}.csv`, [
      ["Student", "Teacher", "Group", "Parent", "Phone", "Month", "Balance", "Status", "Missed Recent Classes", "Suggested Action", "Finance Note"],
      ...contactQueue.map((student) => {
        const missed = missedMap.get(student.id)?.missed ?? 0;
        const monthRecord = tuitionMap.get(`${student.id}:${monthFilter}`);
        const monthDue = monthRecord?.status === "paid" ? 0 : student.amountDue || Math.max(0, 450 - (monthRecord?.amount ?? 0));
        const suggestedAction = missed >= 3 ? "Call before reminder" : student.tuitionStatus === "overdue" ? "Payment reminder" : "Friendly follow-up";
        return [
          student.name,
          student.teacher,
          student.klass,
          student.parentName,
          student.parentPhone,
          monthFilter,
          monthDue,
          student.tuitionStatus,
          missed,
          suggestedAction,
          student.terminationNote || student.financeNote || "",
        ];
      }),
    ]);
    setNotice(`${contactQueue.length} contact queue rows exported.`);
  };

  const exportTuitionMatrix = () => {
    downloadCsv(`finance-matrix-${safeFilenamePart(teacherFilter)}-${safeFilenamePart(groupFilter)}.csv`, [
      ["Student", "Teacher", "Group", "Parent", "Phone", "Joined", ...tuitionMonths.flatMap((month) => [`${month} Status`, `${month} Amount`])],
      ...scopedStudents.map((student) => [
        student.name,
        student.teacher,
        student.klass,
        student.parentName,
        student.parentPhone,
        student.joinedDate || "",
        ...tuitionMonths.flatMap((month) => {
          const record = tuitionMap.get(`${student.id}:${month}`) ?? { status: "unpaid", amount: 0 };
          const effectiveStatus = student.enrollmentStatus === "terminated" ? "absent" : record.status;
          return [effectiveStatus, record.amount];
        }),
      ]),
    ]);
    setNotice(`${scopedStudents.length} finance matrix rows exported.`);
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
    <div className="space-y-5">
      <section className="rounded-lg border border-line bg-white shadow-sm">
        <div className="grid gap-5 p-5 xl:grid-cols-[1fr_420px] xl:items-start">
          <div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-md bg-gold-500/15 px-2.5 py-1 text-xs font-semibold uppercase text-gold-600">
                Finance
              </span>
              <span className="rounded-md bg-cream px-2.5 py-1 text-xs font-semibold text-ink/55">{monthFilter}</span>
            </div>
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-ink sm:text-3xl">Collections & risk workbench</h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink/55">
              Start with contactable families, keep terminated students out of outreach, and use attendance signals before calling parents.
            </p>
          </div>
          <div className="rounded-lg border border-line bg-cream/45 p-3">
            <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-1">
              <select
                value={monthFilter}
                onChange={(event) => setMonthFilter(event.target.value)}
                className="rounded-lg border border-line bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:border-gold-500"
              >
                {tuitionMonths.map((month) => (
                  <option key={month}>{month}</option>
                ))}
              </select>
              <select
                value={teacherFilter}
                onChange={(event) => {
                  setTeacherFilter(event.target.value);
                  setGroupFilter("All groups");
                }}
                className="rounded-lg border border-line bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:border-gold-500"
              >
                <option>All teachers</option>
                {teachers.map((teacher) => (
                  <option key={teacher}>{teacher}</option>
                ))}
              </select>
              <select
                value={groupFilter}
                onChange={(event) => setGroupFilter(event.target.value)}
                className="rounded-lg border border-line bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:border-gold-500"
              >
                <option>All groups</option>
                {groupOptions.map((group) => (
                  <option key={group}>{group}</option>
                ))}
              </select>
            </div>
            <p className="mt-3 rounded-md bg-white px-3 py-2 text-xs font-semibold text-ink/55">{notice}</p>
          </div>
        </div>
      </section>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <WorkbenchStat label="Contact today" value={String(contactQueue.length)} detail="Excludes terminated" tone="dark" />
        <WorkbenchStat label="Do not contact" value={String(doNotContactQueue.length)} detail="Terminated or stop billing" tone={doNotContactQueue.length ? "bad" : "default"} />
        <WorkbenchStat label="Attendance risk" value={String(summary.risk.length)} detail="Missed classes or notes" tone={summary.risk.length ? "warn" : "default"} />
        <WorkbenchStat label="New students" value={String(summary.newStudents.length)} detail="Accepted into class" tone={summary.newStudents.length ? "good" : "default"} />
        <WorkbenchStat label="Outstanding" value={usd.format(summary.totalDue)} detail={`${monthFilter} open balance`} tone="warn" />
        <WorkbenchStat label="Collected" value={`${summary.collectionRate}%`} detail={usd.format(summary.collected)} tone="good" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
        <section data-payment-queue className="rounded-lg border border-line bg-white shadow-sm">
          <div className="grid gap-3 border-b border-line p-4 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <h2 className="text-lg font-bold text-ink">Contact today</h2>
              <p className="mt-0.5 text-sm text-ink/45">Sorted by missed classes first, then balance. Terminated students are excluded.</p>
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
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as PaymentStatus | "all")}
                className="rounded-lg border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-gold-500"
              >
                {paymentStatusOptions.map((option) => (
                  <option key={option.key} value={option.key}>{option.label}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={queueAll}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-900 px-4 py-2.5 text-sm font-semibold text-cream hover:bg-green-800"
              >
                <Bell size={16} /> Queue all
              </button>
            </div>
          </div>

          <div className="divide-y divide-line">
            {contactQueue.map((student) => {
              const missed = missedMap.get(student.id)?.missed ?? 0;
              const monthRecord = tuitionMap.get(`${student.id}:${monthFilter}`);
              const monthDue = monthRecord?.status === "paid" ? 0 : student.amountDue || Math.max(0, 450 - (monthRecord?.amount ?? 0));
              const suggestedAction = missed >= 3 ? "Call before reminder" : student.tuitionStatus === "overdue" ? "Payment reminder" : "Friendly follow-up";
              return (
                <div key={student.id} className="grid gap-4 px-5 py-4 lg:grid-cols-[1fr_170px_132px] lg:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-ink">{student.name}</p>
                      {student.joinedDate && (
                        <span className="rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-700">
                          New · {student.joinedDate}
                        </span>
                      )}
                      <span className="rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-700">
                        {suggestedAction}
                      </span>
                    </div>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-ink/45">
                      <Phone size={12} /> {student.parentName} · {student.parentPhone}
                    </p>
                    <StudentTags student={student} missed={missed} />
                    {(student.financeNote || student.terminationNote) && (
                      <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                        {student.terminationNote || student.financeNote}
                      </p>
                    )}
                  </div>
                  <div>
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-sm font-semibold text-ink">{usd.format(monthDue)}</p>
                      <p className={student.tuitionStatus === "overdue" ? "text-xs font-semibold text-red-600" : "text-xs font-semibold text-amber-600"}>
                        {student.tuitionStatus === "overdue" ? "Overdue" : "Pending"}
                      </p>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-line">
                      <div
                        className={student.tuitionStatus === "overdue" ? "h-full rounded-full bg-red-500" : "h-full rounded-full bg-amber-400"}
                        style={{ width: `${Math.max(8, Math.round((monthDue / highestDue) * 100))}%` }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-ink/45">{monthFilter} balance</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => remindFamily(student)}
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
              );
            })}
            {contactQueue.length === 0 && (
              <div className="px-5 py-12 text-center text-sm text-ink/40">No contactable families match this filter.</div>
            )}
          </div>
        </section>

        <div className="space-y-5">
          <section className="rounded-lg border border-red-200 bg-red-50 shadow-sm">
            <div className="border-b border-red-200 px-5 py-4">
              <h2 className="flex items-center gap-2 text-lg font-bold text-red-950">
                <ShieldAlert size={18} /> Do not contact
              </h2>
              <p className="mt-0.5 text-sm text-red-900/60">Keep these families out of reminder blasts until finance reviews them.</p>
            </div>
            <div className="divide-y divide-red-200">
              {doNotContactQueue.map((student) => (
                <div key={student.id} className="px-5 py-4">
                  <p className="text-sm font-semibold text-red-950">{student.name}</p>
                  <p className="mt-1 text-xs text-red-900/60">{student.parentName} · {student.parentPhone}</p>
                  <StudentTags student={student} missed={missedMap.get(student.id)?.missed ?? 0} />
                  <p className="mt-2 rounded-lg bg-white/70 px-3 py-2 text-xs font-semibold text-red-800">
                    {student.terminationNote || student.financeNote || "Terminated. Verify before outreach."}
                  </p>
                </div>
              ))}
              {doNotContactQueue.length === 0 && (
                <p className="px-5 py-8 text-center text-sm text-red-900/45">No terminated students in this filter.</p>
              )}
            </div>
          </section>

          <section className="rounded-lg border border-line bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-ink">Finance actions</h2>
                <p className="mt-0.5 text-sm text-ink/45">Exports, receipts, and reconciliation.</p>
              </div>
              <Wallet size={20} className="text-ink/35" />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={exportContactQueue}
                disabled={workingAction === "export"}
                className="flex items-center justify-center gap-2 rounded-lg border border-line px-3 py-2.5 text-xs font-semibold text-ink/65 hover:border-gold-500 hover:text-gold-600"
              >
                <Download size={14} /> Contact export
              </button>
              <button
                type="button"
                onClick={() =>
                  void runAction("receipts", async () => {
                    await downloadReceipts();
                    setNotice("Paid-family receipts CSV downloaded.");
                  })
                }
                disabled={workingAction === "receipts"}
                className="flex items-center justify-center gap-2 rounded-lg border border-line px-3 py-2.5 text-xs font-semibold text-ink/65 hover:border-gold-500 hover:text-gold-600"
              >
                <ReceiptText size={14} /> {workingAction === "receipts" ? "Preparing" : "Receipts"}
              </button>
            </div>
            <button
              type="button"
              onClick={() =>
                void runAction("reconcile", async () => {
                  const result = await reconcileFinance();
                  setNotice(
                    `Reconciled: ${usd.format(result.totalDue)} outstanding, ${result.overdue} overdue, ${result.unpaid} pending.`
                  );
                })
              }
              disabled={workingAction === "reconcile"}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-green-900 px-4 py-2.5 text-sm font-semibold text-cream hover:bg-green-800"
            >
              <CreditCard size={15} /> {workingAction === "reconcile" ? "Checking..." : "Reconcile finance"}
            </button>
          </section>

          <section className="rounded-lg border border-line bg-white shadow-sm">
            <div className="border-b border-line px-5 py-4">
              <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
                <AlertTriangle size={18} /> Attendance signals
              </h2>
              <p className="mt-0.5 text-sm text-ink/45">Recent misses under this filter.</p>
            </div>
            <div className="divide-y divide-line">
              {summary.risk.slice(0, 5).map((student) => {
                const missed = missedMap.get(student.id)?.missed ?? 0;
                const total = missedMap.get(student.id)?.total ?? attendanceDates.length;
                return (
                  <div key={student.id} className="px-5 py-3">
                    <p className="text-sm font-semibold text-ink">{student.name}</p>
                    <p className="mt-1 text-xs font-semibold text-red-600">{missed}/{total || attendanceDates.length} missed</p>
                  </div>
                );
              })}
              {summary.risk.length === 0 && (
                <p className="px-5 py-8 text-center text-sm text-ink/40">No attendance risk in this filter.</p>
              )}
            </div>
          </section>
        </div>
      </div>

      <section className="rounded-lg border border-line bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-ink">Monthly tuition matrix</h2>
            <p className="mt-0.5 text-sm text-ink/45">Secondary editing view for all monthly payment cells.</p>
          </div>
          <span className="rounded-lg bg-cream px-3 py-2 text-xs font-semibold text-ink/50">{tuitionMonths.length} program months · July/Aug off</span>
          <button
            type="button"
            onClick={exportTuitionMatrix}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-900 px-3 py-2 text-xs font-semibold text-cream hover:bg-green-800"
          >
            <Download size={14} /> Export Excel
          </button>
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
                <th className="px-4 py-3 font-semibold">Joined</th>
                {tuitionMonths.map((month) => (
                  <th key={month} className="px-2 py-3 text-center font-semibold">{month.slice(0, 3)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {scopedStudents.map((student) => (
                <tr key={student.id} className="border-b border-line last:border-0 odd:bg-cream/30 hover:bg-gold-300/15">
                  <td className="sticky left-0 bg-white px-4 py-3 font-semibold text-ink shadow-[1px_0_0_rgba(15,23,32,0.08)]">{student.name}</td>
                  <td className="px-4 py-3 font-medium text-ink/65">{student.teacher}</td>
                  <td className="px-4 py-3 text-ink/60">{student.klass}</td>
                  <td className="px-4 py-3 text-ink/65">{student.parentName}</td>
                  <td className="px-4 py-3 text-ink/55">{student.parentPhone}</td>
                  <td className="px-4 py-3 text-ink/55">{student.joinedDate || "-"}</td>
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
              {scopedStudents.length === 0 && (
                <tr>
                  <td colSpan={6 + tuitionMonths.length} className="px-5 py-10 text-center text-sm text-ink/40">
                    No students match this finance filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
