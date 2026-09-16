import { useState } from "react";
import { PasswordPage } from "../pages/PasswordPage";
import { LogOut } from "lucide-react";
import type { Role } from "../App";
import { useAcademy } from "../data/academyStore";

const roleTagline: Record<Role, string> = {
  "IT Admin": "USA operations, access, and system health",
  Finance: "US tuition and payment monitoring",
  Teacher: "Attendance, grading, and homework",
  Registration: "Admissions, assessments, and family intake",
};

export function Topbar({ role }: { role: Role }) {
  const [changingPassword, setChangingPassword] = useState(false);
  const { apiOnline, loading, logout, user } = useAcademy();
  return (
    <>
    {changingPassword && <div className="fixed inset-0 z-50 overflow-y-auto bg-cream"><PasswordPage onClose={() => setChangingPassword(false)} /></div>}
    <header className="flex flex-col gap-3 border-b border-line bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
      <div className="min-w-0">
        <p className="truncate text-base font-bold text-ink">ABA Academy USA</p>
        <p className="truncate text-sm text-ink/50">{roleTagline[role]}</p>
      </div>

      <div className="flex items-center justify-between gap-3 sm:justify-end">
        <span
          className={`hidden rounded-lg px-2.5 py-1.5 text-xs font-semibold sm:inline-flex ${
            apiOnline ? "bg-emerald-500/10 text-emerald-700" : "bg-amber-400/15 text-amber-700"
          }`}
        >
          {loading ? "Loading" : apiOnline ? "Live DB" : "Connection unavailable"}
        </span>
        <div className="min-w-0 rounded-lg border border-line bg-cream px-3 py-2">
          <p className="truncate text-xs font-bold leading-tight text-ink">{user?.name ?? role}</p>
          <p className="truncate text-[11px] font-semibold text-ink/45">{role}</p>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-900 text-xs font-semibold text-cream">
          {role
            .split(" ")
            .map((w) => w[0])
            .join("")}
        </div>
        <button type="button" onClick={() => setChangingPassword(true)} className="rounded-lg border border-line px-3 py-2 text-sm font-bold">Change password</button>
        <button
          type="button"
          onClick={() => void logout()}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-sm font-bold text-ink transition hover:bg-cream"
          aria-label="Log out"
          title="Log out"
        >
          <LogOut size={16} />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </header>
    </>
  );
}
