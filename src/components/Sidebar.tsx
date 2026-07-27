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
  PanelLeftClose,
  PanelLeftOpen,
  GraduationCap,
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
  collapsed,
  onToggle,
}: {
  role: Role;
  active: string;
  onSelect: (key: string) => void;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const items = navByRole[role];
  return (
    <aside
      className={`relative hidden h-screen flex-col border-r border-line bg-white text-ink transition-[width] duration-200 lg:flex ${
        collapsed ? "w-20" : "w-72"
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-label={collapsed ? "Open sidebar" : "Close sidebar"}
        className="group absolute right-3 top-4 z-20 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-ink text-white shadow-sm transition-colors hover:bg-green-800"
      >
        {collapsed ? <PanelLeftOpen size={21} strokeWidth={1.8} /> : <PanelLeftClose size={21} strokeWidth={1.8} />}
        <span className="pointer-events-none absolute left-full top-1/2 ml-3 -translate-y-1/2 whitespace-nowrap rounded-sm bg-ink px-3 py-2 text-sm font-bold text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
          {collapsed ? "Open sidebar" : "Close sidebar"}
        </span>
      </button>

      <div className={`flex items-center border-b border-line py-5 ${collapsed ? "justify-center px-3" : "gap-3 px-5"}`}>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-900 text-cream">
          <GraduationCap size={19} strokeWidth={1.9} />
        </div>
        <div className={`min-w-0 ${collapsed ? "hidden" : "block"}`}>
          <p className="truncate text-sm font-bold leading-tight text-ink">ABA Academy</p>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-ink/40">USA Operations</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.key;
          return (
            <button
              key={item.key}
              onClick={() => onSelect(item.key)}
              title={collapsed ? item.label : undefined}
              className={`relative flex w-full items-center rounded-lg px-3.5 py-2.5 text-sm font-semibold transition-colors ${
                collapsed ? "justify-center" : "gap-3"
              } ${
                isActive
                  ? "bg-green-900 text-cream"
                  : "text-ink/55 hover:bg-cream hover:text-ink"
              }`}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-gold-400" />
              )}
              <Icon size={17} strokeWidth={1.75} />
              {!collapsed && item.label}
            </button>
          );
        })}
      </nav>

      <div className={`border-t border-line p-4 ${collapsed ? "hidden" : "block"}`}>
        <div className="rounded-xl bg-cream p-3">
          <p className="text-xs font-semibold text-ink">Production workspace</p>
          <p className="mt-1 text-[11px] leading-relaxed text-ink/45">
            Staff, student, finance, and admissions operations.
          </p>
        </div>
      </div>
    </aside>
  );
}

export function MobileNav({
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
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 px-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 shadow-[0_-10px_30px_rgba(15,23,32,0.08)] backdrop-blur lg:hidden">
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.key;
          return (
            <button
              key={item.key}
              onClick={() => onSelect(item.key)}
              className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-[11px] font-semibold ${
                isActive ? "bg-green-900 text-cream" : "text-ink/50 hover:bg-cream"
              }`}
            >
              <Icon size={17} strokeWidth={1.9} />
              <span className="max-w-full truncate">{item.label.replace("Assessment ", "")}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
