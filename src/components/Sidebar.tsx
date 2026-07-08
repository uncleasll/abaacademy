import type { LucideIcon } from "lucide-react";
import {
  LayoutGrid,
  Users,
  Wallet,
  ClipboardList,
  Send,
  UserCog,
  FileCheck2,
  CalendarClock,
  Moon,
} from "lucide-react";
import type { Role } from "../App";

export interface NavItem {
  key: string;
  label: string;
  icon: LucideIcon;
}

export const navByRole: Record<Role, NavItem[]> = {
  "IT Admin": [
    { key: "overview", label: "Overview", icon: LayoutGrid },
    { key: "users", label: "Users & Roles", icon: UserCog },
    { key: "students", label: "Students", icon: Users },
  ],
  Finance: [
    { key: "overview", label: "Overview", icon: LayoutGrid },
    { key: "tuition", label: "Tuition & Payments", icon: Wallet },
  ],
  Teacher: [
    { key: "roster", label: "My Class", icon: ClipboardList },
    { key: "report", label: "Send Report", icon: Send },
  ],
  Registration: [
    { key: "applications", label: "Applications", icon: FileCheck2 },
    { key: "schedule", label: "Assessment Schedule", icon: CalendarClock },
  ],
};

export function Sidebar({
  role,
  active,
  onSelect,
}: {
  role: Role;
  active: string;
  onSelect: (key: string) => void;
}) {
  const items = navByRole[role];
  return (
    <aside className="flex h-screen w-64 flex-col border-r border-green-800/40 bg-green-950 text-cream">
      <div className="flex items-center gap-2.5 px-6 py-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gold-500/15 ring-1 ring-gold-500/40">
          <Moon size={16} className="text-gold-400" strokeWidth={1.75} />
        </div>
        <div>
          <p className="font-display text-base leading-tight text-cream">Al-Bukhari</p>
          <p className="text-[11px] uppercase tracking-widest text-gold-400/80">Academy System</p>
        </div>
      </div>

      <nav className="mt-2 flex-1 space-y-1 px-3">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.key;
          return (
            <button
              key={item.key}
              onClick={() => onSelect(item.key)}
              className={`relative flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm transition-all duration-150 ${
                isActive
                  ? "bg-gold-500/15 text-gold-300 font-semibold"
                  : "text-cream/65 hover:bg-white/5 hover:text-cream hover:translate-x-0.5"
              }`}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-gold-400" />
              )}
              <Icon size={17} strokeWidth={1.75} />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="border-t border-white/10 px-6 py-5">
        <p className="text-[11px] leading-relaxed text-cream/40">
          "My Lord, increase me in knowledge" — Surah Taha 20:114
        </p>
      </div>
    </aside>
  );
}
