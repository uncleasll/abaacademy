import { StatCard, SectionTitle } from "../components/ui";
import { staffUsers, students } from "../data/mockData";

export function AdminOverview() {
  const activeUsers = staffUsers.filter((u) => u.status === "active").length;
  return (
    <div className="space-y-8">
      <SectionTitle eyebrow="IT Admin" title="System overview" sub="Status across all modules" />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Total students" value={String(students.length)} sub="Active enrollment" accent />
        <StatCard label="Staff" value={String(staffUsers.length)} sub={`${activeUsers} active`} />
        <StatCard label="Avg attendance" value="88%" sub="Current month" />
        <StatCard label="System status" value="Stable" sub="All modules running" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-line bg-white shadow-sm p-6">
          <p className="font-display text-lg text-ink">Modules</p>
          <ul className="mt-4 space-y-3 text-sm">
            {[
              ["Attendance & Performance", "Active"],
              ["Finance & Tuition", "Active"],
              ["Registration / Apply", "Active"],
              ["Telegram integration", "In progress"],
              ["Parent Portal", "Phase 2"],
            ].map(([name, status]) => (
              <li key={name} className="flex items-center justify-between border-b border-line/70 pb-3 last:border-0 last:pb-0">
                <span className="text-ink/80">{name}</span>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    status === "Active"
                      ? "bg-emerald-500/10 text-emerald-700"
                      : "bg-amber-400/15 text-amber-600"
                  }`}
                >
                  {status}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-line bg-white shadow-sm p-6">
          <p className="font-display text-lg text-ink">Recent activity</p>
          <ul className="mt-4 space-y-4 text-sm">
            <li className="flex gap-3">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-gold-500" />
              <span className="text-ink/70">Teacher Behzodjon submitted today's attendance — Al-Bukhari class</span>
            </li>
            <li className="flex gap-3">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-gold-500" />
              <span className="text-ink/70">Kamola moved a new application to the "Assessment" stage</span>
            </li>
            <li className="flex gap-3">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-gold-500" />
              <span className="text-ink/70">Malika sent payment reminders to 3 families</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
