import { ChevronDown } from "lucide-react";
import type { Role } from "../App";

const roles: Role[] = ["IT Admin", "Finance", "Teacher", "Registration"];

const roleTagline: Record<Role, string> = {
  "IT Admin": "System and user management",
  Finance: "Tuition and payment monitoring",
  Teacher: "Attendance, grading and homework",
  Registration: "Applications and assessments",
};

export function Topbar({
  role,
  onChangeRole,
}: {
  role: Role;
  onChangeRole: (r: Role) => void;
}) {
  return (
    <header className="flex items-center justify-between border-b border-line bg-cream/90 px-8 py-4 backdrop-blur">
      <div>
        <p className="font-display text-lg text-ink">Welcome back</p>
        <p className="text-sm text-ink/50">{roleTagline[role]}</p>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative">
          <select
            value={role}
            onChange={(e) => onChangeRole(e.target.value as Role)}
            className="appearance-none rounded-full border border-line bg-white py-2 pl-4 pr-9 text-sm font-semibold text-ink shadow-sm outline-none focus:border-gold-500"
          >
            {roles.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <ChevronDown
            size={14}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink/40"
          />
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-green-900 text-xs font-semibold text-gold-300">
          {role
            .split(" ")
            .map((w) => w[0])
            .join("")}
        </div>
      </div>
    </header>
  );
}
