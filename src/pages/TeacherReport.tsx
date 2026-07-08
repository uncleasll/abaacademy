import { useState } from "react";
import { Send, Copy, Check } from "lucide-react";
import { SectionTitle } from "../components/ui";
import { students } from "../data/mockData";

const attendanceLabel: Record<string, string> = {
  present: "Present",
  late: "Late",
  absent: "❌ Absent",
};
const hwLabel: Record<string, string> = {
  done: "Done",
  partial: "Partial",
  not_done: "Not Done",
};

function buildReport() {
  const lines = students.map((s, i) => {
    if (s.attendance === "absent") {
      return `${i + 1}. ${s.name}\n  ❌ Absent`;
    }
    const stars = "⭐".repeat(s.stars);
    return `${i + 1}. ${s.name}\n  ${attendanceLabel[s.attendance]} | ${stars} | Last HW: ${hwLabel[s.hw]}\n  Next HW: ${s.nextHw}`;
  });

  return `Al-Bukhari Academy | Attendance | 01 Jul 2026\n──────────────────\n\n${lines.join(
    "\n\n"
  )}\n\n──────────────────\n📖 My Lord! Increase me in knowledge. -Surah Taha 20:114`;
}

export function TeacherReport() {
  const [sent, setSent] = useState(false);
  const [copied, setCopied] = useState(false);
  const report = buildReport();

  const handleSend = () => {
    setSent(true);
    setTimeout(() => setSent(false), 2500);
  };

  const handleCopy = () => {
    navigator.clipboard?.writeText(report);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="space-y-6">
      <SectionTitle
        eyebrow="Teacher"
        title="Send daily report"
        sub="Auto-generated from today's class data"
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="rounded-2xl border border-line bg-white shadow-sm p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink/40">
            Auto-generated message
          </p>
          <pre className="mt-3 max-h-[520px] overflow-y-auto whitespace-pre-wrap rounded-xl bg-cream p-4 font-mono text-xs leading-relaxed text-ink/80">
            {report}
          </pre>
          <div className="mt-4 flex gap-3">
            <button
              onClick={handleSend}
              className="flex items-center gap-2 rounded-full bg-green-900 px-5 py-2.5 text-sm font-semibold text-cream hover:bg-green-800"
            >
              <Send size={15} />
              {sent ? "Sent!" : "Send to Telegram"}
            </button>
            <button
              onClick={handleCopy}
              className="flex items-center gap-2 rounded-full border border-line px-5 py-2.5 text-sm font-semibold text-ink/70 hover:border-gold-500 hover:text-gold-600"
            >
              {copied ? <Check size={15} /> : <Copy size={15} />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-green-800 bg-green-950 p-5 text-cream">
          <p className="text-xs font-semibold uppercase tracking-wide text-gold-400">
            Telegram preview
          </p>
          <div className="mt-3 rounded-xl bg-green-900/60 p-4">
            <p className="text-xs leading-relaxed text-cream/85 font-mono whitespace-pre-wrap">
              {report.slice(0, 260)}...
            </p>
          </div>
          <p className="mt-4 text-xs text-cream/50">
            This report is sent automatically to the parents' group and the admin channel.
            Once the backend is connected, "Send to Telegram" will dispatch a real message via the Bot API.
          </p>
        </div>
      </div>
    </div>
  );
}
