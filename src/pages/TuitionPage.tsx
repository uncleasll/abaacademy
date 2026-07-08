import { useState } from "react";
import { Bell, Check } from "lucide-react";
import { SectionTitle, PaymentPill } from "../components/ui";
import { students as initialStudents, type PaymentStatus } from "../data/mockData";

export function TuitionPage() {
  const [rows, setRows] = useState(initialStudents);
  const format = (n: number) => (n === 0 ? "—" : n.toLocaleString("en-US") + " UZS");

  const markPaid = (id: string) => {
    setRows((prev) =>
      prev.map((s) => (s.id === id ? { ...s, tuitionStatus: "paid" as PaymentStatus, amountDue: 0 } : s))
    );
  };

  return (
    <div className="space-y-6">
      <SectionTitle eyebrow="Finance" title="Tuition & payments" sub="Status per student" />

      <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line bg-cream/60 text-xs uppercase tracking-wide text-ink/50">
              <th className="px-5 py-3 font-semibold">Student</th>
              <th className="px-5 py-3 font-semibold">Class</th>
              <th className="px-5 py-3 font-semibold">Amount</th>
              <th className="px-5 py-3 font-semibold">Status</th>
              <th className="px-5 py-3 font-semibold text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id} className="border-b border-line last:border-0 transition-colors hover:bg-cream/60">
                <td className="px-5 py-3.5 font-medium text-ink">{s.name}</td>
                <td className="px-5 py-3.5 text-ink/60">{s.klass}</td>
                <td className="px-5 py-3.5 text-ink/70">{format(s.amountDue)}</td>
                <td className="px-5 py-3.5">
                  <PaymentPill status={s.tuitionStatus} />
                </td>
                <td className="px-5 py-3.5 text-right">
                  {s.tuitionStatus === "paid" ? (
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
                      <Check size={14} /> Paid
                    </span>
                  ) : (
                    <div className="flex justify-end gap-2">
                      <button className="rounded-full border border-line px-3 py-1.5 text-xs font-medium text-ink/70 hover:border-gold-500 hover:text-gold-600 inline-flex items-center gap-1">
                        <Bell size={13} /> Remind
                      </button>
                      <button
                        onClick={() => markPaid(s.id)}
                        className="rounded-full bg-green-900 px-3 py-1.5 text-xs font-semibold text-cream hover:bg-green-800"
                      >
                        Mark as paid
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
