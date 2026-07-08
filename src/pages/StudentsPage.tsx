import { SectionTitle, StatusPill } from "../components/ui";
import { students } from "../data/mockData";

export function StudentsPage() {
  const sorted = [...students].sort((a, b) => a.rank - b.rank);
  return (
    <div className="space-y-6">
      <SectionTitle eyebrow="IT Admin" title="All students" sub="Overall ranking and status" />

      <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line bg-cream/60 text-xs uppercase tracking-wide text-ink/50">
              <th className="px-5 py-3 font-semibold">#</th>
              <th className="px-5 py-3 font-semibold">Student</th>
              <th className="px-5 py-3 font-semibold">Class</th>
              <th className="px-5 py-3 font-semibold">Attendance</th>
              <th className="px-5 py-3 font-semibold">Performance</th>
              <th className="px-5 py-3 font-semibold">Overall</th>
              <th className="px-5 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((s) => (
              <tr key={s.id} className="border-b border-line last:border-0 transition-colors hover:bg-cream/60">
                <td className="px-5 py-3.5 text-ink/40">{s.rank}</td>
                <td className="px-5 py-3.5 font-medium text-ink">{s.name}</td>
                <td className="px-5 py-3.5 text-ink/60">{s.klass}</td>
                <td className="px-5 py-3.5 text-ink/70">{s.attendancePct}%</td>
                <td className="px-5 py-3.5 text-ink/70">{s.performance}</td>
                <td className="px-5 py-3.5 font-semibold text-ink">{s.overall}</td>
                <td className="px-5 py-3.5">
                  <StatusPill status={s.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
