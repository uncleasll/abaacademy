import { StatCard, SectionTitle } from "../components/ui";
import { students } from "../data/mockData";

export function FinanceOverview() {
  const overdue = students.filter((s) => s.tuitionStatus === "overdue");
  const unpaid = students.filter((s) => s.tuitionStatus === "unpaid");
  const totalDue = students.reduce((sum, s) => sum + s.amountDue, 0);
  const format = (n: number) => n.toLocaleString("en-US") + " UZS";

  return (
    <div className="space-y-8">
      <SectionTitle eyebrow="Finance" title="Finance overview" sub="June 2026" />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Amount due" value={format(totalDue)} sub="Across all students" accent />
        <StatCard label="Overdue" value={String(overdue.length)} sub="Needs immediate reminder" />
        <StatCard label="Pending" value={String(unpaid.length)} sub="Not yet due" />
        <StatCard label="Fully paid" value={String(students.length - overdue.length - unpaid.length)} sub="Students" />
      </div>

      <div className="rounded-2xl border border-line bg-white shadow-sm p-6">
        <p className="font-display text-lg text-ink">Payments needing attention</p>
        <ul className="mt-4 space-y-3">
          {[...overdue, ...unpaid].map((s) => (
            <li key={s.id} className="flex items-center justify-between border-b border-line/70 pb-3 last:border-0 last:pb-0">
              <div>
                <p className="text-sm font-medium text-ink">{s.name}</p>
                <p className="text-xs text-ink/50">{s.klass}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-ink">{format(s.amountDue)}</p>
                <p className={`text-xs ${s.tuitionStatus === "overdue" ? "text-red-600" : "text-amber-600"}`}>
                  {s.tuitionStatus === "overdue" ? "Overdue" : "Pending"}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
