import { useMemo, useState } from "react";
import { Bell, Check, CreditCard, FileDown, Search } from "lucide-react";
import { PaymentPill, SectionTitle } from "../components/ui";
import { type PaymentStatus } from "../data/mockData";
import { useAcademy } from "../data/academyStore";
import { downloadCsv, safeFilenamePart } from "../utils/exportCsv";

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const filters: { key: PaymentStatus | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "overdue", label: "Overdue" },
  { key: "unpaid", label: "Pending" },
  { key: "paid", label: "Paid" },
];

export function TuitionPage() {
  const { students: rows, updateStudent, queueReminder } = useAcademy();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | "all">("all");
  const [reminded, setReminded] = useState<string[]>([]);
  const [notice, setNotice] = useState("Review balances, send reminders, or mark payments as received.");

  const totals = useMemo(() => {
    const outstanding = rows.reduce((sum, student) => sum + student.amountDue, 0);
    const overdue = rows.filter((student) => student.tuitionStatus === "overdue").length;
    const pending = rows.filter((student) => student.tuitionStatus === "unpaid").length;
    const paid = rows.filter((student) => student.tuitionStatus === "paid").length;
    return { outstanding, overdue, pending, paid };
  }, [rows]);

  const visibleRows = rows.filter((student) => {
    const matchesStatus = statusFilter === "all" || student.tuitionStatus === statusFilter;
    const matchesQuery = `${student.name} ${student.klass} ${student.parentName} ${student.parentPhone} ${student.address}`
      .toLowerCase()
      .includes(query.toLowerCase());
    return matchesStatus && matchesQuery;
  });

  const markPaid = (id: string, name: string) => {
    void updateStudent(id, { tuitionStatus: "paid" as PaymentStatus, amountDue: 0 });
    setNotice(`${name}'s payment was marked as received.`);
  };

  const remind = (id: string, name: string) => {
    void queueReminder({ studentId: id, name, scope: "tuition" });
    setReminded((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setNotice(`Reminder queued for ${name}'s family.`);
  };

  const exportTuition = () => {
    downloadCsv(`tuition-${safeFilenamePart(statusFilter)}.csv`, [
      ["Student", "Group", "Parent", "Phone", "Address", "Balance", "Status"],
      ...visibleRows.map((student) => [
        student.name,
        student.klass,
        student.parentName,
        student.parentPhone,
        student.address,
        student.amountDue,
        student.tuitionStatus,
      ]),
    ]);
    setNotice(`${visibleRows.length} tuition rows exported.`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <SectionTitle
          eyebrow="Finance"
          title="Tuition & payments"
          sub="A clean payment workspace for family balances and follow-ups."
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={exportTuition}
            className="inline-flex items-center gap-2 rounded-lg border border-green-800 bg-white px-4 py-2.5 text-sm font-semibold text-green-900 hover:bg-cream"
          >
            <FileDown size={16} /> Export Excel
          </button>
          <button
            onClick={() => {
              const payable = rows.filter((student) => student.tuitionStatus !== "paid");
              void queueReminder({ scope: "tuition-all", studentIds: payable.map((student) => student.id) });
              setReminded(payable.map((student) => student.id));
              setNotice(`${payable.length} payment reminders queued.`);
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-green-900 px-4 py-2.5 text-sm font-semibold text-cream hover:bg-green-800"
          >
            <Bell size={16} /> Remind all due
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-xl border border-green-800 bg-green-900 p-4 text-cream shadow-sm">
          <p className="text-xs font-semibold uppercase text-gold-300">Outstanding</p>
          <p className="mt-2 text-2xl font-semibold">{usd.format(totals.outstanding)}</p>
          <p className="mt-2 text-xs text-cream/65">Open tuition balance</p>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-950 shadow-sm">
          <p className="text-xs font-semibold uppercase text-red-700/70">Overdue</p>
          <p className="mt-2 text-2xl font-semibold">{totals.overdue}</p>
          <p className="mt-2 text-xs text-red-900/55">Needs follow-up</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950 shadow-sm">
          <p className="text-xs font-semibold uppercase text-amber-700/70">Pending</p>
          <p className="mt-2 text-2xl font-semibold">{totals.pending}</p>
          <p className="mt-2 text-xs text-amber-900/55">Not yet overdue</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950 shadow-sm">
          <p className="text-xs font-semibold uppercase text-emerald-700/70">Paid</p>
          <p className="mt-2 text-2xl font-semibold">{totals.paid}</p>
          <p className="mt-2 text-xs text-emerald-900/55">Fully settled</p>
        </div>
      </div>

      <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">{notice}</div>

      <section className="rounded-xl border border-line bg-white shadow-sm">
        <div className="grid gap-3 border-b border-line p-4 lg:grid-cols-[1fr_auto]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/35" size={17} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search student, parent, phone, address"
              className="w-full rounded-lg border border-line bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-gold-500"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            {filters.map((filter) => (
              <button
                key={filter.key}
                onClick={() => setStatusFilter(filter.key)}
                className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                  statusFilter === filter.key
                    ? "bg-green-900 text-cream"
                    : "border border-line bg-white text-ink/60 hover:border-gold-500 hover:text-gold-600"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[880px] w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line bg-cream/60 text-xs uppercase text-ink/45">
                <th className="px-5 py-3 font-semibold">Family</th>
                <th className="px-5 py-3 font-semibold">Group</th>
                <th className="px-5 py-3 font-semibold">Balance</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((student) => (
                <tr key={student.id} className="border-b border-line last:border-0 hover:bg-cream/50">
                  <td className="px-5 py-4">
                    <p className="font-semibold text-ink">{student.name}</p>
                    <p className="mt-1 text-xs text-ink/45">
                      {student.parentName} · {student.parentPhone}
                    </p>
                    <p className="mt-0.5 text-xs text-ink/35">{student.address}</p>
                  </td>
                  <td className="px-5 py-4 text-ink/60">{student.klass}</td>
                  <td className="px-5 py-4 font-semibold text-ink">
                    {student.amountDue === 0 ? "-" : usd.format(student.amountDue)}
                  </td>
                  <td className="px-5 py-4">
                    <PaymentPill status={student.tuitionStatus} />
                  </td>
                  <td className="px-5 py-4 text-right">
                    {student.tuitionStatus === "paid" ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                        <Check size={14} /> Received
                      </span>
                    ) : (
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => remind(student.id, student.name)}
                          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold ${
                            reminded.includes(student.id)
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-line text-ink/60 hover:border-gold-500 hover:text-gold-600"
                          }`}
                        >
                          {reminded.includes(student.id) ? <Check size={13} /> : <Bell size={13} />}
                          {reminded.includes(student.id) ? "Queued" : "Remind"}
                        </button>
                        <button
                          onClick={() => markPaid(student.id, student.name)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-green-900 px-3 py-2 text-xs font-semibold text-cream hover:bg-green-800"
                        >
                          <CreditCard size={13} /> Mark paid
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {visibleRows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-sm text-ink/40">
                    No payment records match these filters.
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
