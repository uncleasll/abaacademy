import { useState } from "react";
import { Plus, Search } from "lucide-react";
import { SectionTitle } from "../components/ui";
import { staffUsers } from "../data/mockData";

const roleColors: Record<string, string> = {
  "IT Admin": "bg-emerald-500/10 text-emerald-700",
  Finance: "bg-gold-500/15 text-gold-600",
  Teacher: "bg-indigo-500/10 text-indigo-700",
  Registration: "bg-purple-500/10 text-purple-700",
};

export function UsersPage() {
  const [query, setQuery] = useState("");
  const filtered = staffUsers.filter((u) =>
    u.name.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <SectionTitle eyebrow="IT Admin" title="Users & roles" sub="Manage staff access to the system" />
        <button className="flex items-center gap-2 rounded-full bg-green-900 px-4 py-2.5 text-sm font-semibold text-cream hover:bg-green-800">
          <Plus size={16} /> New user
        </button>
      </div>

      <div className="relative max-w-xs">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink/40" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name..."
          className="w-full rounded-full border border-line bg-white py-2.5 pl-9 pr-4 text-sm outline-none focus:border-gold-500"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line bg-cream/60 text-xs uppercase tracking-wide text-ink/50">
              <th className="px-5 py-3 font-semibold">Name</th>
              <th className="px-5 py-3 font-semibold">Role</th>
              <th className="px-5 py-3 font-semibold">Email</th>
              <th className="px-5 py-3 font-semibold">Status</th>
              <th className="px-5 py-3 font-semibold">Last active</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id} className="border-b border-line last:border-0 transition-colors hover:bg-cream/60">
                <td className="px-5 py-3.5 font-medium text-ink">{u.name}</td>
                <td className="px-5 py-3.5">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${roleColors[u.role]}`}>
                    {u.role}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-ink/60">{u.email}</td>
                <td className="px-5 py-3.5">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      u.status === "active"
                        ? "bg-emerald-500/10 text-emerald-700"
                        : "bg-ink/5 text-ink/40"
                    }`}
                  >
                    {u.status === "active" ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-ink/50">{u.lastActive}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
