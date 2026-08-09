import { useState, type FormEvent } from "react";
import { Plus, Search, Trash2 } from "lucide-react";
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
  const { staffUsers: users, createUser, deleteUser, updateUserStatus } = useAcademy();
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [notice, setNotice] = useState("Role changes are saved locally for this session.");
  const [form, setForm] = useState({
    name: "",
    email: "",
    role: "Teacher" as StaffUser["role"],
  });

  const filtered = users.filter((u) =>
    `${u.name} ${u.email} ${u.role}`.toLowerCase().includes(query.toLowerCase())
  );

  const addUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await createUser({
      name: form.name.trim(),
      email: form.email.trim(),
      role: form.role,
    });
    setNotice(`Invite created for ${form.name.trim()}.`);
    setForm({ name: "", email: "", role: "Teacher" });
    setShowForm(false);
  };

  const toggleStatus = (user: StaffUser) => {
    void updateUserStatus(user.id, user.status === "active" ? "inactive" : "active");
    setNotice("User access status updated.");
  };
  const removeUser = (user: StaffUser) => {
    void deleteUser(user.id);
    setNotice(`${user.name} removed from staff access.`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <SectionTitle eyebrow="IT Admin" title="Users & roles" sub="Manage staff access to the system" />
        <button
          onClick={() => setShowForm((prev) => !prev)}
          className="flex items-center gap-2 rounded-lg bg-green-900 px-4 py-2.5 text-sm font-semibold text-cream hover:bg-green-800"
        >
          <Plus size={16} /> {showForm ? "Close form" : "New user"}
        </button>
      </div>

      <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">{notice}</div>

      {showForm && (
        <form onSubmit={addUser} className="grid gap-3 rounded-xl border border-line bg-white p-4 shadow-sm md:grid-cols-[1fr_1fr_180px_auto]">
          <input
            required
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Full name"
            className="rounded-lg border border-line px-3 py-2.5 text-sm outline-none focus:border-gold-500"
          />
          <input
            required
            type="email"
            value={form.email}
            onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
            placeholder="name@abaacademy.us"
            className="rounded-lg border border-line px-3 py-2.5 text-sm outline-none focus:border-gold-500"
          />
          <select
            value={form.role}
            onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value as StaffUser["role"] }))}
            className="rounded-lg border border-line px-3 py-2.5 text-sm outline-none focus:border-gold-500"
          >
            {["IT Admin", "Finance", "Teacher", "Registration"].map((role) => (
              <option key={role}>{role}</option>
            ))}
          </select>
          <button className="rounded-lg bg-green-900 px-4 py-2.5 text-sm font-semibold text-cream hover:bg-green-800">
            Invite
          </button>
        </form>
      )}

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
                onClick={() => toggleStatus(user)}
                className="rounded-lg border border-line px-3 py-2 text-xs font-semibold text-ink/60 hover:border-gold-500 hover:text-gold-600"
              >
                {user.status === "active" ? "Deactivate" : "Activate"}
              </button>
              <button
                onClick={() => removeUser(user)}
                className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"
                aria-label={`Delete ${user.name}`}
              >
                Delete
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
                      onClick={() => toggleStatus(u)}
                      className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink/60 hover:border-gold-500 hover:text-gold-600"
                    >
                      {u.status === "active" ? "Deactivate" : "Activate"}
                    </button>
                    <button
                      onClick={() => removeUser(u)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                      aria-label={`Delete ${u.name}`}
                    >
                      <Trash2 size={13} /> Delete
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
