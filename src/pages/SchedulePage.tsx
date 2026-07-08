import { SectionTitle } from "../components/ui";
import { applications } from "../data/mockData";

const slots = [
  { time: "09:00", day: "Monday" },
  { time: "10:30", day: "Monday" },
  { time: "09:00", day: "Wednesday" },
  { time: "11:00", day: "Wednesday" },
  { time: "14:00", day: "Thursday" },
];

const scheduled = applications.filter((a) => a.status === "assessment" || a.status === "interview");

export function SchedulePage() {
  return (
    <div className="space-y-8">
      <SectionTitle eyebrow="Registration" title="Assessment schedule" sub="Open slots and upcoming meetings" />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-line bg-white shadow-sm p-6">
          <p className="font-display text-lg text-ink">Open slots</p>
          <div className="mt-4 space-y-2">
            {slots.map((s, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-xl border border-line px-4 py-3 hover:border-gold-500"
              >
                <span className="text-sm font-medium text-ink">{s.day}</span>
                <span className="text-sm text-ink/60">{s.time}</span>
                <button className="rounded-full bg-cream px-3 py-1 text-xs font-semibold text-ink/60 hover:bg-gold-500/15 hover:text-gold-600">
                  Book
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-white shadow-sm p-6">
          <p className="font-display text-lg text-ink">Upcoming meetings</p>
          <div className="mt-4 space-y-3">
            {scheduled.map((a) => (
              <div key={a.id} className="flex items-center justify-between border-b border-line/70 pb-3 last:border-0 last:pb-0">
                <div>
                  <p className="text-sm font-medium text-ink">{a.name}</p>
                  <p className="text-xs text-ink/50">{a.program}</p>
                </div>
                <span className="rounded-full bg-gold-500/15 px-2.5 py-1 text-xs font-semibold text-gold-600">
                  {a.status === "assessment" ? "Assessment" : "Interview"}
                </span>
              </div>
            ))}
            {scheduled.length === 0 && <p className="text-sm text-ink/40">No meetings scheduled yet</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
