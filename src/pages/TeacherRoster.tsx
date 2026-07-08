import { useState } from "react";
import { Star } from "lucide-react";
import { SectionTitle } from "../components/ui";
import { students as initialStudents, type AttendanceStatus, type HwStatus } from "../data/mockData";

const attendanceOptions: { value: AttendanceStatus; label: string }[] = [
  { value: "present", label: "Present" },
  { value: "late", label: "Late" },
  { value: "absent", label: "Absent" },
];
const hwOptions: { value: HwStatus; label: string }[] = [
  { value: "done", label: "Done" },
  { value: "partial", label: "Partial" },
  { value: "not_done", label: "Not Done" },
];

export function TeacherRoster() {
  const [rows, setRows] = useState(
    initialStudents.map((s) => ({ ...s, nextHwDraft: s.nextHw }))
  );

  const update = (id: string, patch: Partial<(typeof rows)[number]>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  return (
    <div className="space-y-6">
      <SectionTitle
        eyebrow="Teacher · Al-Bukhari Class"
        title="Today's attendance & grading"
        sub="July 1, 2026"
      />

      <div className="overflow-x-auto rounded-2xl border border-line bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line bg-cream/60 text-xs uppercase tracking-wide text-ink/50">
              <th className="px-5 py-3 font-semibold">Student</th>
              <th className="px-5 py-3 font-semibold">Attendance</th>
              <th className="px-5 py-3 font-semibold">Rating</th>
              <th className="px-5 py-3 font-semibold">Homework</th>
              <th className="px-5 py-3 font-semibold min-w-64">Next assignment</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id} className="border-b border-line last:border-0 transition-colors hover:bg-cream/60">
                <td className="px-5 py-3.5 font-medium text-ink whitespace-nowrap">{s.name}</td>
                <td className="px-5 py-3.5">
                  <div className="flex gap-1">
                    {attendanceOptions.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => update(s.id, { attendance: opt.value })}
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
                          s.attendance === opt.value
                            ? opt.value === "present"
                              ? "bg-green-900 text-cream"
                              : opt.value === "late"
                              ? "bg-amber-400 text-green-950"
                              : "bg-red-600 text-white"
                            : "bg-cream text-ink/40 hover:bg-line"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <button key={i} onClick={() => update(s.id, { stars: i + 1 })}>
                        <Star
                          size={16}
                          className={i < s.stars ? "fill-amber-400 text-amber-400" : "text-line"}
                        />
                      </button>
                    ))}
                  </div>
                </td>
                <td className="px-5 py-3.5">
                  <select
                    value={s.hw}
                    onChange={(e) => update(s.id, { hw: e.target.value as HwStatus })}
                    className="rounded-lg border border-line bg-white px-2 py-1.5 text-xs outline-none focus:border-gold-500"
                  >
                    {hwOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-5 py-3.5">
                  <input
                    value={s.nextHwDraft}
                    onChange={(e) => update(s.id, { nextHwDraft: e.target.value })}
                    className="w-full rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs outline-none focus:border-gold-500"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
