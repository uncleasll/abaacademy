import { useMemo, useState } from "react";
import { Check, Copy, Download, Send } from "lucide-react";
import { SectionTitle } from "../components/ui";
import { type Student } from "../data/mockData";
import { useAcademy } from "../data/academyStore";

const attendanceLabel: Record<string, string> = {
  present: "Present",
  late: "Late",
  absent: "Absent",
};

const hwLabel: Record<string, string> = {
  done: "Done",
  partial: "Partial",
  not_done: "Not done",
};

function buildReport(group: string, channel: string, rows: Student[]) {
  const title = group === "All groups" ? "ABA Academy USA" : `${group} class`;
  const lines = rows.map((student, index) => {
    const stars = "*".repeat(student.stars);
    return `${index + 1}. ${student.name}
   Attendance: ${attendanceLabel[student.attendance]}
   Rating: ${stars || "-"} (${student.stars}/5)
   Homework: ${hwLabel[student.hw]}
   Next: ${student.nextHw}`;
  });

  return `${title} | Daily class report | July 1, 2026
Channel: ${channel}

${lines.join("\n\n")}

Summary: ${rows.length} students included.
ABA Academy USA`;
}

export function TeacherReport() {
  const { classGroups, students, prepareExport, queueReminder } = useAcademy();
  const [groupFilter, setGroupFilter] = useState("Al-Bukhari");
  const [channel, setChannel] = useState("Parents SMS");
  const [copied, setCopied] = useState(false);
  const [sent, setSent] = useState(false);
  const [notice, setNotice] = useState("Report preview is ready.");

  const reportRows = useMemo(() => {
    return students.filter((student) => groupFilter === "All groups" || student.klass === groupFilter);
  }, [groupFilter, students]);

  const report = useMemo(() => buildReport(groupFilter, channel, reportRows), [groupFilter, channel, reportRows]);
  const presentCount = reportRows.filter((student) => student.attendance === "present").length;
  const absentCount = reportRows.filter((student) => student.attendance === "absent").length;
  const homeworkDone = reportRows.filter((student) => student.hw === "done").length;

  const handleCopy = async () => {
    await navigator.clipboard?.writeText(report);
    setCopied(true);
    setNotice("Report copied to clipboard.");
    setTimeout(() => setCopied(false), 1800);
  };

  const handleSend = () => {
    void queueReminder({ type: "teacher-report", group: groupFilter, channel, count: reportRows.length });
    setSent(true);
    setNotice(`Report queued for ${channel}.`);
    setTimeout(() => setSent(false), 2200);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <SectionTitle
          eyebrow="Teacher"
          title="Daily report"
          sub="Review a polished class summary, then copy or send it to the selected family channel."
        />
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-2 rounded-lg border border-line bg-white px-4 py-2.5 text-sm font-semibold text-ink shadow-sm hover:border-gold-500 hover:text-gold-600"
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            onClick={() => {
              void prepareExport({ type: "teacher-report", group: groupFilter, channel });
              setNotice("Report export prepared.");
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-line bg-white px-4 py-2.5 text-sm font-semibold text-ink shadow-sm hover:border-gold-500 hover:text-gold-600"
          >
            <Download size={16} /> Export
          </button>
          <button
            onClick={handleSend}
            className="inline-flex items-center gap-2 rounded-lg bg-green-900 px-4 py-2.5 text-sm font-semibold text-cream hover:bg-green-800"
          >
            {sent ? <Check size={16} /> : <Send size={16} />}
            {sent ? "Queued" : "Send"}
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-green-800 bg-green-900 p-4 text-cream shadow-sm">
          <p className="text-xs font-semibold uppercase text-gold-300">Students</p>
          <p className="mt-2 text-2xl font-semibold">{reportRows.length}</p>
          <p className="mt-2 text-xs text-cream/65">{groupFilter}</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950 shadow-sm">
          <p className="text-xs font-semibold uppercase text-emerald-700/70">Present</p>
          <p className="mt-2 text-2xl font-semibold">{presentCount}</p>
          <p className="mt-2 text-xs text-emerald-900/55">Ready to share</p>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-950 shadow-sm">
          <p className="text-xs font-semibold uppercase text-red-700/70">Absent</p>
          <p className="mt-2 text-2xl font-semibold">{absentCount}</p>
          <p className="mt-2 text-xs text-red-900/55">Included in report</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950 shadow-sm">
          <p className="text-xs font-semibold uppercase text-amber-700/70">Homework done</p>
          <p className="mt-2 text-2xl font-semibold">{homeworkDone}</p>
          <p className="mt-2 text-xs text-amber-900/55">Completed today</p>
        </div>
      </div>

      <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">{notice}</div>

      <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
        <section className="rounded-xl border border-line bg-white p-5 shadow-sm">
          <h3 className="font-display text-lg text-ink">Report settings</h3>
          <div className="mt-5 space-y-4">
            <label className="space-y-1.5 text-xs font-semibold text-ink/55">
              Group
              <select
                value={groupFilter}
                onChange={(event) => {
                  setGroupFilter(event.target.value);
                  setNotice("Report preview updated.");
                }}
                className="w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm font-medium text-ink outline-none focus:border-gold-500"
              >
                <option>All groups</option>
                {classGroups.map((group) => (
                  <option key={group.id}>{group.name}</option>
                ))}
              </select>
            </label>

            <label className="space-y-1.5 text-xs font-semibold text-ink/55">
              Channel
              <select
                value={channel}
                onChange={(event) => {
                  setChannel(event.target.value);
                  setNotice(`${event.target.value} selected.`);
                }}
                className="w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm font-medium text-ink outline-none focus:border-gold-500"
              >
                <option>Parents SMS</option>
                <option>Email digest</option>
                <option>Admin channel</option>
                <option>Teacher archive</option>
              </select>
            </label>

            <div className="rounded-xl bg-cream/60 p-4">
              <p className="text-sm font-semibold text-ink">Included fields</p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-ink/55">
                {["Attendance", "Rating", "Homework", "Next assignment"].map((item) => (
                  <span key={item} className="rounded-lg bg-white px-2.5 py-2">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-line bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <div>
              <h3 className="font-display text-lg text-ink">Message preview</h3>
              <p className="mt-0.5 text-sm text-ink/45">{reportRows.length} student records included</p>
            </div>
            <span className="rounded-full bg-gold-500/15 px-3 py-1 text-xs font-semibold text-gold-600">
              {channel}
            </span>
          </div>
          <pre className="max-h-[560px] overflow-y-auto whitespace-pre-wrap p-5 font-mono text-xs leading-relaxed text-ink/75">
            {report}
          </pre>
        </section>
      </div>
    </div>
  );
}
