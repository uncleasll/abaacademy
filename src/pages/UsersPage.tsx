import { useState } from "react";
import { Search } from "lucide-react";
import { SectionTitle } from "../components/ui";
import { type StaffUser } from "../data/mockData";
import { useAcademy } from "../data/academyStore";

const roleColors: Record<string, string> = {
  "IT Admin": "bg-emerald-500/10 text-emerald-700",
  Finance: "bg-gold-500/15 text-gold-600",
  Teacher: "bg-indigo-500/10 text-indigo-700",
  Registration: "bg-purple-500/10 text-purple-700",
};

export function UsersPage() {
  const { staffUsers: users, user: currentUser, updateUserStatus } = useAcademy();
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("Access is limited to the eight approved academy accounts. Staff can change their own password after signing in.");

  const filtered = users.filter((u) =>
    `${u.name} ${u.email} ${u.role}`.toLowerCase().includes(query.toLowerCase())
  );

  const [updating, setUpdating] = useState<string | null>(null);
  const toggleStatus = async (user: StaffUser) => {
    setUpdating(user.id);
    try {
      await updateUserStatus(user.id, user.status === "active" ? "inactive" : "active");
      setNotice("User access status updated.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not update user access.");
    } finally { setUpdating(null); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <SectionTitle eyebrow="IT Admin" title="Users & roles" sub="Manage staff access to the system" />

      </div>

      <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">{notice}</div>

      <div className="relative max-w-xs">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink/40" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name..."
          className="w-full rounded-lg border border-line bg-white py-2.5 pl-9 pr-4 text-sm outline-none focus:border-gold-500"
        />
      </div>

      <div className="grid gap-3 md:hidden">
        {filtered.map((user) => (
          <div key={user.id} className="rounded-xl border border-line bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-ink">{user.name}</p>
                <p className="mt-1 truncate text-xs text-ink/45">{user.email}</p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${roleColors[user.role]}`}>
                {user.role}
              </span>
            </div>
            <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-3">
              <div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    user.status === "active" ? "bg-emerald-500/10 text-emerald-700" : "bg-ink/5 text-ink/40"
                  }`}
                >
                  {user.status === "active" ? "Active" : "Inactive"}
                </span>
                <p className="mt-2 text-xs text-ink/45">{user.lastActive}</p>
              </div>
              <button
                onClick={() => void toggleStatus(user)}
                disabled={updating !== null || user.id === currentUser?.id}
                className="rounded-lg border border-line px-3 py-2 text-xs font-semibold text-ink/60 hover:border-gold-500 hover:text-gold-600"
              >
                {user.status === "active" ? "Deactivate" : "Activate"}
              </button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="rounded-xl border border-line bg-white p-8 text-center text-sm text-ink/40">
            No users match your search.
          </div>
        )}
      </div>

      <div className="hidden overflow-x-auto rounded-xl border border-line bg-white shadow-sm md:block">
        <table className="min-w-[820px] w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line bg-cream/60 text-xs uppercase tracking-wide text-ink/50">
              <th className="px-5 py-3 font-semibold">Name</th>
              <th className="px-5 py-3 font-semibold">Role</th>
              <th className="px-5 py-3 font-semibold">Email</th>
              <th className="px-5 py-3 font-semibold">Status</th>
              <th className="px-5 py-3 font-semibold">Last active</th>
              <th className="px-5 py-3 font-semibold text-right">Action</th>
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
                <td className="px-5 py-3.5 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => void toggleStatus(u)}
                      disabled={updating !== null || u.id === currentUser?.id}
                      className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink/60 hover:border-gold-500 hover:text-gold-600"
                    >
                      {u.status === "active" ? "Deactivate" : "Activate"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-sm text-ink/40">
                  No users match your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
