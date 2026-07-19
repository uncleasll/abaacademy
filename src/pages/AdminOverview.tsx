import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  Database,
  FileCheck2,
  Server,
  ShieldCheck,
  Users,
  Wifi,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useAcademy } from "../data/academyStore";

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const roleTone: Record<string, string> = {
  "IT Admin": "bg-sky-500/10 text-sky-700",
  Finance: "bg-emerald-500/10 text-emerald-700",
  Teacher: "bg-indigo-500/10 text-indigo-700",
  Registration: "bg-amber-400/15 text-amber-700",
};

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Users;
  tone?: "default" | "dark" | "good" | "warn";
}) {
  const styles = {
    default: "border-line bg-white text-ink",
    dark: "border-green-800 bg-green-900 text-cream",
    good: "border-emerald-200 bg-emerald-50 text-emerald-950",
    warn: "border-amber-200 bg-amber-50 text-amber-950",
  };

  return (
    <div className={`rounded-xl border p-4 shadow-sm ${styles[tone]}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={`text-xs font-semibold uppercase ${tone === "dark" ? "text-gold-300" : "text-ink/45"}`}>
            {label}
          </p>
          <p className="mt-2 text-2xl font-semibold">{value}</p>
        </div>
        <div className={`rounded-lg p-2 ${tone === "dark" ? "bg-white/10 text-gold-300" : "bg-white/70 text-ink/55"}`}>
          <Icon size={18} />
        </div>
      </div>
      <p className={`mt-3 text-xs ${tone === "dark" ? "text-cream/65" : "text-ink/50"}`}>{detail}</p>
    </div>
  );
}

function PanelHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      {action && (
        <button onClick={onAction} className="text-xs font-semibold text-gold-600 hover:text-gold-500">
          {action}
        </button>
      )}
    </div>
  );
}

export function AdminOverview() {
  const { applications, classGroups, staffUsers, students } = useAcademy();
  const [notice, setNotice] = useState("System checks are current.");
  const [view, setView] = useState("Operations");
  const [acknowledged, setAcknowledged] = useState<string[]>([]);

  const activeUsers = staffUsers.filter((user) => user.status === "active").length;
  const avgAttendance = Math.round(students.reduce((sum, student) => sum + student.attendancePct, 0) / students.length);
  const openApplications = applications.filter((app) => app.status !== "accepted" && app.status !== "rejected").length;
  const outstanding = students.reduce((sum, student) => sum + student.amountDue, 0);
  const totalCapacity = classGroups.reduce((sum, group) => sum + group.capacity, 0);
  const enrolled = classGroups.reduce((sum, group) => sum + group.enrolled, 0);
  const capacityPct = Math.round((enrolled / totalCapacity) * 100);

  const urgentStudents = students
    .filter((student) => student.status === "Needs Attention" || student.tuitionStatus === "overdue")
    .filter((student) => !acknowledged.includes(student.id))
    .sort((a, b) => b.amountDue + (100 - b.attendancePct) - (a.amountDue + (100 - a.attendancePct)))
    .slice(0, 4);

  const quickActions = useMemo(
    () => [
      ["Add user", "Open Users & Roles to invite a new staff account."],
      ["Export roster", `Roster export prepared for ${students.length} students.`],
      ["Review access", `${staffUsers.filter((user) => user.status === "inactive").length} inactive account needs review.`],
    ],
    []
  );

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-line bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-widest text-gold-600">IT Admin</p>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-ink sm:text-3xl">Operations command center</h2>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink/55">
              Enrollment, staff access, class capacity, payments, and system readiness in one clean view.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {quickActions.map(([label, message]) => (
              <button
                key={label}
                onClick={() => setNotice(message)}
                className="rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold text-ink shadow-sm hover:border-gold-500 hover:text-gold-600"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900 sm:flex-row sm:items-center sm:justify-between">
        <span>{notice}</span>
        <div className="grid grid-cols-3 gap-2 sm:flex">
          {["Operations", "Security", "Admissions"].map((item) => (
            <button
              key={item}
              onClick={() => {
                setView(item);
                setNotice(`${item} view selected.`);
              }}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                view === item ? "bg-sky-700 text-white" : "bg-white text-sky-800 hover:bg-sky-100"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Students" value={String(students.length)} detail={`${capacityPct}% group capacity used`} icon={Users} tone="dark" />
        <MetricCard label="Attendance" value={`${avgAttendance}%`} detail="Across active groups" icon={ClipboardList} tone="good" />
        <MetricCard label="Admissions" value={String(openApplications)} detail="Waiting for next step" icon={FileCheck2} />
        <MetricCard label="Tuition due" value={money.format(outstanding)} detail="Open family balances" icon={CreditCard} tone="warn" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <section className="rounded-xl border border-line bg-white shadow-sm">
          <PanelHeader title="Groups" action="Manage" onAction={() => setNotice("Group management queue opened.")} />
          <div className="divide-y divide-line">
            {classGroups.map((group) => {
              const pct = Math.round((group.enrolled / group.capacity) * 100);
              const groupStudents = students.filter((student) => student.klass === group.name);
              const attendance = groupStudents.length
                ? Math.round(groupStudents.reduce((sum, student) => sum + student.attendancePct, 0) / groupStudents.length)
                : 0;
              return (
                <div key={group.id} className="p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-semibold text-ink">{group.name}</p>
                      <p className="mt-1 text-sm text-ink/50">
                        {group.teacher} · {group.program} · {group.schedule}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-ink">{group.enrolled}/{group.capacity} seats</p>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-line">
                    <div className="h-full rounded-full bg-gold-500" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-ink/55">
                    <span>Capacity {pct}%</span>
                    <span>Attendance {attendance}%</span>
                    <span>{group.capacity - group.enrolled} open</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-xl border border-line bg-white shadow-sm">
          <PanelHeader title="Needs attention" action="Open students" onAction={() => setNotice("Urgent student queue selected.")} />
          <div className="divide-y divide-line">
            {urgentStudents.map((student) => (
              <div key={student.id} className="grid grid-cols-[1fr_auto] gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{student.name}</p>
                  <p className="mt-1 text-xs text-ink/50">
                    {student.klass} · {student.teacher} · {student.parentPhone}
                  </p>
                  <p className="mt-0.5 text-xs text-ink/40">{student.address}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-amber-700">{money.format(student.amountDue)}</p>
                  <p className="mt-1 text-xs text-ink/45">{student.attendancePct}% attendance</p>
                  <button
                    onClick={() => {
                      setAcknowledged((prev) => [...prev, student.id]);
                      setNotice(`${student.name} acknowledged.`);
                    }}
                    className="mt-2 rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-ink/55 hover:border-gold-500 hover:text-gold-600"
                  >
                    Acknowledge
                  </button>
                </div>
              </div>
            ))}
            {urgentStudents.length === 0 && <p className="p-4 text-sm text-ink/45">All urgent items are acknowledged.</p>}
          </div>
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <section className="rounded-xl border border-line bg-white shadow-sm">
          <PanelHeader title="System readiness" />
          <div className="space-y-3 p-4">
            {[
              { icon: Server, label: "App server", status: "Healthy", sub: "99.98% uptime this month" },
              { icon: Database, label: "Student records", status: "Synced", sub: "Last backup: 2:00 AM ET" },
              { icon: Wifi, label: "Notifications", status: "Online", sub: "SMS and email queues clear" },
              { icon: ShieldCheck, label: "Security", status: "Protected", sub: "No failed admin logins today" },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-700">
                    <Icon size={17} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink">{item.label}</p>
                    <p className="truncate text-xs text-ink/45">{item.sub}</p>
                  </div>
                  <span className="text-xs font-semibold text-emerald-700">{item.status}</span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-xl border border-line bg-white shadow-sm">
          <PanelHeader title="Role access" />
          <div className="divide-y divide-line">
            {staffUsers.map((user) => (
              <div key={user.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{user.name}</p>
                  <p className="truncate text-xs text-ink/45">{user.email}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${roleTone[user.role]}`}>
                  {user.role}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-line bg-white shadow-sm">
          <PanelHeader title="Activity" />
          <div className="space-y-4 p-4 text-sm">
            {[
              ["9:12 AM", "Shavkat reviewed staff access permissions."],
              ["8:40 AM", "Behzodjon submitted attendance for Al-Bukhari."],
              ["Yesterday", "Kamola scheduled 2 applicant assessments."],
              ["Yesterday", "Finance sent reminders to overdue families."],
            ].map(([time, text], index) => (
              <div key={`${time}-${text}`} className="flex gap-3">
                <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${index === 0 ? "bg-gold-500" : "bg-line"}`} />
                <div>
                  <p className="text-xs font-semibold text-ink/45">{time}</p>
                  <p className="mt-0.5 text-ink/70">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {[
          { icon: CheckCircle2, title: "Daily operations ready", sub: `${activeUsers}/${staffUsers.length} staff users active today.` },
          { icon: AlertTriangle, title: "Payment follow-up", sub: `${students.filter((student) => student.tuitionStatus === "overdue").length} families need direct contact.` },
          { icon: ShieldCheck, title: "Access hygiene", sub: "Inactive teacher account should be reviewed this week." },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.title} className="flex gap-3 rounded-xl border border-line bg-white p-4 shadow-sm">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cream text-ink/60">
                <Icon size={18} />
              </div>
              <div>
                <p className="text-sm font-semibold text-ink">{item.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-ink/50">{item.sub}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
