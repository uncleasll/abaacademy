import { useState } from "react";
import { Phone, Plus } from "lucide-react";
import { SectionTitle } from "../components/ui";
import { applications as initialApplications, type AppStatus } from "../data/mockData";

const columns: { key: AppStatus; label: string }[] = [
  { key: "pending", label: "New" },
  { key: "assessment", label: "Assessment" },
  { key: "interview", label: "Interview" },
  { key: "accepted", label: "Accepted" },
  { key: "rejected", label: "Rejected" },
];

const nextStatus: Partial<Record<AppStatus, AppStatus>> = {
  pending: "assessment",
  assessment: "interview",
  interview: "accepted",
};

export function ApplicationsPage() {
  const [apps, setApps] = useState(initialApplications);

  const advance = (id: string) => {
    setApps((prev) =>
      prev.map((a) => (a.id === id && nextStatus[a.status] ? { ...a, status: nextStatus[a.status]! } : a))
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <SectionTitle eyebrow="Registration" title="Applications" sub="Step-by-step admission pipeline" />
        <button className="flex items-center gap-2 rounded-full bg-green-900 px-4 py-2.5 text-sm font-semibold text-cream hover:bg-green-800">
          <Plus size={16} /> New application
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
        {columns.map((col) => (
          <div key={col.key} className="rounded-2xl border border-line bg-cream/50 p-3">
            <p className="mb-3 px-1 text-xs font-semibold uppercase tracking-wide text-ink/50">
              {col.label} · {apps.filter((a) => a.status === col.key).length}
            </p>
            <div className="space-y-2">
              {apps
                .filter((a) => a.status === col.key)
                .map((a) => (
                  <div key={a.id} className="rounded-xl border border-line bg-white shadow-sm p-3.5">
                    <p className="text-sm font-semibold text-ink">{a.name}</p>
                    <p className="text-xs text-ink/50">Age {a.age} · {a.program}</p>
                    <p className="mt-2 flex items-center gap-1.5 text-xs text-ink/60">
                      <Phone size={11} /> {a.phone}
                    </p>
                    <p className="mt-1 text-[11px] text-ink/40">Parent: {a.parentName}</p>
                    {nextStatus[a.status] && (
                      <button
                        onClick={() => advance(a.id)}
                        className="mt-3 w-full rounded-full border border-line py-1.5 text-xs font-semibold text-ink/70 hover:border-gold-500 hover:text-gold-600"
                      >
                        Move to next stage →
                      </button>
                    )}
                  </div>
                ))}
              {apps.filter((a) => a.status === col.key).length === 0 && (
                <p className="px-1 text-xs text-ink/30">Empty</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
