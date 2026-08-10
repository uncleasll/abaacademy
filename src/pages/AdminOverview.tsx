import {
  BarChart3,
  Check,
  ClipboardList,
  CreditCard,
  FileCheck2,
  ShieldCheck,
  TrendingUp,
  UserCog,
  Users,
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

function percent(value: number, total: number) {
  return total ? Math.round((value / total) * 100) : 0;
}

function monthKey(date: string) {
  return date.slice(0, 7);
}

function monthLabel(key: string) {
  const value = new Date(`${key}-01T00:00:00`);
  return value.toLocaleString("en-US", { month: "long", year: "numeric" });
}

function OpsStat({
  label,
  value,
  detail,
  tone = "default",
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "default" | "dark" | "good" | "warn" | "bad";
}) {
  const styles = {
    default: "border-line bg-white text-ink",
    dark: "border-green-800 bg-green-900 text-cream",
    good: "border-emerald-200 bg-emerald-50 text-emerald-950",
    warn: "border-amber-200 bg-amber-50 text-amber-950",
    bad: "border-red-200 bg-red-50 text-red-950",
  };

  return (
    <div className={`rounded-lg border p-4 shadow-sm ${styles[tone]}`}>
      <p className={`text-xs font-semibold uppercase ${tone === "dark" ? "text-gold-300" : "text-ink/45"}`}>
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
      <p className={`mt-2 text-xs ${tone === "dark" ? "text-cream/65" : "text-ink/50"}`}>{detail}</p>
    </div>
  );
}

export function AdminOverview() {
  const { applications, attendanceDates, attendanceRecords, classGroups, staffUsers, students } = useAcademy();
  const [notice, setNotice] = useState("Operations exceptions are current.");
  const [acknowledged, setAcknowledged] = useState<string[]>([]);
  const monthOptions = useMemo(() => Array.from(new Set(attendanceDates.map(monthKey))).sort(), [attendanceDates]);
  const [monthFilter, setMonthFilter] = useState(monthOptions.at(-1) ?? "all");
  const [teacherFilter, setTeacherFilter] = useState("All teachers");
  const [groupFilter, setGroupFilter] = useState("All groups");

  const teacherOptions = useMemo(() => Array.from(new Set(classGroups.map((group) => group.teacher))), [classGroups]);
  const groupOptions = useMemo(() => {
    if (teacherFilter === "All teachers") return classGroups.map((group) => group.name);
    return classGroups.filter((group) => group.teacher === teacherFilter).map((group) => group.name);
  }, [classGroups, teacherFilter]);

  const scopedStudents = useMemo(
    () =>
      students.filter((student) => {
        const matchesTeacher = teacherFilter === "All teachers" || student.teacher === teacherFilter;
        const matchesGroup = groupFilter === "All groups" || student.klass === groupFilter;
        return matchesTeacher && matchesGroup;
      }),
    [groupFilter, students, teacherFilter]
  );

  const kpi = useMemo(() => {
    const activeDates = monthFilter === "all" ? attendanceDates : attendanceDates.filter((date) => monthKey(date) === monthFilter);
    const scopedIds = new Set(scopedStudents.map((student) => student.id));
    const monthRecords = attendanceRecords.filter((record) => scopedIds.has(record.studentId) && activeDates.includes(record.date));
    const present = monthRecords.filter((record) => record.present).length;
    const absent = monthRecords.length - present;
    const avgOverall = scopedStudents.length
      ? Math.round(scopedStudents.reduce((sum, student) => sum + student.overall, 0) / scopedStudents.length)
      : 0;
    const avgPerformance = scopedStudents.length
      ? Math.round(scopedStudents.reduce((sum, student) => sum + student.performance, 0) / scopedStudents.length)
      : 0;
    const homework = scopedStudents.length
      ? Math.round(scopedStudents.reduce((sum, student) => sum + student.homeworkAvg, 0) / scopedStudents.length)
      : 0;
    const lowAttendance = scopedStudents.filter((student) => {
      const studentRecords = monthRecords.filter((record) => record.studentId === student.id);
      const studentAttendance = percent(studentRecords.filter((record) => record.present).length, studentRecords.length);
      return studentRecords.length > 0 && studentAttendance < 80;
    });
    const needsAcademicHelp = scopedStudents.filter((student) => student.overall < 75 || student.performance < 75);
    const excellent = scopedStudents.filter((student) => student.overall >= 90).length;
    return {
      activeDates,
      monthRecords,
      present,
      absent,
      attendancePct: percent(present, monthRecords.length),
      avgOverall,
      avgPerformance,
      homework,
      lowAttendance,
      needsAcademicHelp,
      excellentPct: percent(excellent, scopedStudents.length),
    };
  }, [attendanceDates, attendanceRecords, monthFilter, scopedStudents]);

  const attendanceTrend = useMemo(
    () =>
      monthOptions.map((key) => {
        const dates = attendanceDates.filter((date) => monthKey(date) === key);
        const scopedIds = new Set(scopedStudents.map((student) => student.id));
        const records = attendanceRecords.filter((record) => scopedIds.has(record.studentId) && dates.includes(record.date));
        const present = records.filter((record) => record.present).length;
        return { key, label: monthLabel(key), pct: percent(present, records.length), total: records.length };
      }),
    [attendanceDates, attendanceRecords, monthOptions, scopedStudents]
  );

  const teacherBreakdown = useMemo(
    () =>
      teacherOptions.map((teacher) => {
        const teacherStudents = scopedStudents.filter((student) => student.teacher === teacher);
        const avgOverall = teacherStudents.length
          ? Math.round(teacherStudents.reduce((sum, student) => sum + student.overall, 0) / teacherStudents.length)
          : 0;
        const ids = new Set(teacherStudents.map((student) => student.id));
        const records = kpi.monthRecords.filter((record) => ids.has(record.studentId));
        const present = records.filter((record) => record.present).length;
        return { teacher, count: teacherStudents.length, overall: avgOverall, attendance: percent(present, records.length) };
      }).filter((item) => item.count > 0),
    [kpi.monthRecords, scopedStudents, teacherOptions]
  );

  const operations = useMemo(() => {
    const missedStats = students
      .map((student) => {
        const recent = attendanceDates
          .slice(-12)
          .map((date) => attendanceRecords.find((record) => record.studentId === student.id && record.date === date))
          .filter(Boolean);
        const missed = recent.filter((record) => !record!.present).length;
        const escalation = missed >= 5 ? "Terminate review" : missed >= 3 ? "Parent warning" : missed >= 1 ? "Watch" : "Clear";
        return { student, missed, total: recent.length || attendanceDates.length, escalation };
      })
      .filter((item) => item.missed > 0)
      .sort((a, b) => b.missed - a.missed);
    const teacherReview = applications.filter((app) => app.status === "teacher_review");
    const openApplications = applications.filter((app) => app.status !== "accepted" && app.status !== "rejected");
    const overdue = students.filter((student) => student.tuitionStatus === "overdue");
    const terminated = students.filter((student) => student.enrollmentStatus === "terminated");
    const lowAttendance = students.filter((student) => student.attendancePct < 80 || student.attendance === "absent");
    const inactiveUsers = staffUsers.filter((user) => user.status !== "active");
    const capacityWarnings = classGroups.filter((group) => group.enrolled / group.capacity >= 0.85);
    const outstanding = students.reduce((sum, student) => sum + student.amountDue, 0);
    const activeUsers = staffUsers.filter((user) => user.status === "active").length;
    const exceptions = [
      ...teacherReview.map((app) => ({
        id: `app-${app.id}`,
        title: `${app.name} needs teacher decision`,
        detail: `${app.teacher} · ${app.klass} · parent ${app.phone}`,
        owner: "Registration",
        tone: "warn" as const,
      })),
      ...terminated.map((student) => ({
        id: `terminated-${student.id}`,
        title: `${student.name} is terminated`,
        detail: `Finance should not contact ${student.parentName} until reviewed.`,
        owner: "Finance",
        tone: "bad" as const,
      })),
      ...overdue.slice(0, 5).map((student) => ({
        id: `overdue-${student.id}`,
        title: `${student.name} has overdue tuition`,
        detail: `${money.format(student.amountDue)} · ${student.teacher} · ${student.klass}`,
        owner: "Finance",
        tone: "warn" as const,
      })),
      ...missedStats.slice(0, 5).map(({ student, missed, total, escalation }) => ({
        id: `attendance-${student.id}`,
        title: `${student.name} missed ${missed} classes`,
        detail: `${missed}/${total} missed · ${escalation} · ${student.teacher} · ${student.parentPhone}`,
        owner: "Teacher",
        tone: missed >= 5 ? "bad" as const : "warn" as const,
      })),
      ...inactiveUsers.map((user) => ({
        id: `user-${user.id}`,
        title: `${user.name} account is inactive`,
        detail: `${user.role} · ${user.email}`,
        owner: "IT Admin",
        tone: "default" as const,
      })),
      ...capacityWarnings.map((group) => ({
        id: `capacity-${group.id}`,
        title: `${group.name} is near capacity`,
        detail: `${group.enrolled}/${group.capacity} seats · ${group.teacher}`,
        owner: "IT Admin",
        tone: "default" as const,
      })),
    ];
    return { teacherReview, openApplications, overdue, terminated, lowAttendance, inactiveUsers, capacityWarnings, outstanding, activeUsers, exceptions, missedStats };
  }, [applications, attendanceDates, attendanceRecords, classGroups, staffUsers, students]);

  const visibleExceptions = operations.exceptions.filter((item) => !acknowledged.includes(item.id)).slice(0, 10);

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-line bg-white shadow-sm">
        <div className="grid gap-5 p-5 xl:grid-cols-[1fr_380px] xl:items-start">
          <div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-md bg-gold-500/15 px-2.5 py-1 text-xs font-semibold uppercase text-gold-600">
                IT Admin
              </span>
              <span className="rounded-md bg-cream px-2.5 py-1 text-xs font-semibold text-ink/55">
                {visibleExceptions.length} open exceptions
              </span>
            </div>
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-ink sm:text-3xl">Operations exceptions center</h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink/55">
              See where daily operations need follow-up across teacher attendance, admissions, finance, capacity, and staff access.
            </p>
          </div>
          <div className="rounded-lg border border-line bg-cream/45 p-3">
            <p className="rounded-md bg-white px-3 py-2 text-xs font-semibold text-ink/55">{notice}</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setNotice(`${operations.teacherReview.length} applicants are waiting for teacher review.`)}
                className="rounded-lg border border-line bg-white px-3 py-2 text-xs font-semibold text-ink/60 hover:border-gold-500 hover:text-gold-600"
              >
                Review admissions
              </button>
              <button
                type="button"
                onClick={() => setNotice(`${operations.inactiveUsers.length} inactive users need access review.`)}
                className="rounded-lg border border-line bg-white px-3 py-2 text-xs font-semibold text-ink/60 hover:border-gold-500 hover:text-gold-600"
              >
                Review access
              </button>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <OpsStat label="Open exceptions" value={String(visibleExceptions.length)} detail="Unacknowledged items" tone="dark" />
        <OpsStat label="Teacher review" value={String(operations.teacherReview.length)} detail="Admissions waiting" tone={operations.teacherReview.length ? "warn" : "default"} />
        <OpsStat label="Finance risk" value={String(operations.overdue.length + operations.terminated.length)} detail={`${money.format(operations.outstanding)} open`} tone="warn" />
        <OpsStat label="Attendance" value={String(operations.lowAttendance.length)} detail="Students needing follow-up" tone={operations.lowAttendance.length ? "bad" : "good"} />
        <OpsStat label="Staff active" value={`${operations.activeUsers}/${staffUsers.length}`} detail="Access coverage" tone="good" />
      </div>

      <section className="rounded-lg border border-line bg-white shadow-sm">
        <div className="grid gap-4 border-b border-line p-5 xl:grid-cols-[1fr_560px] xl:items-start">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
              <BarChart3 size={19} /> Student KPI dashboard
            </h2>
            <p className="mt-1 max-w-3xl text-sm leading-relaxed text-ink/50">
              Month, teacher, and group view of how students are performing, with attendance percentages calculated from class records.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <select
              value={monthFilter}
              onChange={(event) => setMonthFilter(event.target.value)}
              className="rounded-lg border border-line bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:border-gold-500"
            >
              <option value="all">All months</option>
              {monthOptions.map((key) => (
                <option key={key} value={key}>{monthLabel(key)}</option>
              ))}
            </select>
            <select
              value={teacherFilter}
              onChange={(event) => {
                setTeacherFilter(event.target.value);
                setGroupFilter("All groups");
              }}
              className="rounded-lg border border-line bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:border-gold-500"
            >
              <option>All teachers</option>
              {teacherOptions.map((teacher) => (
                <option key={teacher}>{teacher}</option>
              ))}
            </select>
            <select
              value={groupFilter}
              onChange={(event) => setGroupFilter(event.target.value)}
              className="rounded-lg border border-line bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:border-gold-500"
            >
              <option>All groups</option>
              {groupOptions.map((group) => (
                <option key={group}>{group}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-6">
          <OpsStat label="Students" value={String(scopedStudents.length)} detail={`${teacherFilter} · ${groupFilter}`} tone="dark" />
          <OpsStat label="Overall" value={`${kpi.avgOverall}%`} detail="Average student score" tone={kpi.avgOverall >= 80 ? "good" : "warn"} />
          <OpsStat label="Performance" value={`${kpi.avgPerformance}%`} detail="Academic performance" tone={kpi.avgPerformance >= 80 ? "good" : "warn"} />
          <OpsStat label="Attendance" value={`${kpi.attendancePct}%`} detail={`${kpi.present}/${kpi.monthRecords.length} present`} tone={kpi.attendancePct >= 85 ? "good" : "bad"} />
          <OpsStat label="Homework" value={`${kpi.homework}%`} detail="Homework average" tone={kpi.homework >= 80 ? "good" : "warn"} />
          <OpsStat label="At risk" value={String(kpi.lowAttendance.length + kpi.needsAcademicHelp.length)} detail="Attendance or academic" tone={kpi.lowAttendance.length + kpi.needsAcademicHelp.length ? "bad" : "good"} />
        </div>

        <div className="grid gap-5 border-t border-line p-5 xl:grid-cols-[1fr_420px]">
          <div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-bold text-ink">
                  <TrendingUp size={17} /> Monthly attendance trend
                </h3>
                <p className="mt-0.5 text-xs text-ink/45">Calculated from teacher attendance records.</p>
              </div>
              <span className="rounded-lg bg-cream px-3 py-2 text-xs font-semibold text-ink/50">
                {kpi.activeDates.length || attendanceDates.length} class dates
              </span>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {attendanceTrend.map((item) => (
                <div key={item.key} className="rounded-lg border border-line bg-cream/35 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold text-ink/60">{item.label}</p>
                    <p className={item.pct >= 85 ? "text-sm font-bold text-emerald-700" : "text-sm font-bold text-red-600"}>
                      {item.pct}%
                    </p>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-line">
                    <div
                      className={item.pct >= 85 ? "h-full rounded-full bg-emerald-500" : "h-full rounded-full bg-red-500"}
                      style={{ width: `${item.pct}%` }}
                    />
                  </div>
                  <p className="mt-2 text-[11px] font-semibold text-ink/40">{item.total} records</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-line bg-cream/35">
            <div className="border-b border-line px-4 py-3">
              <h3 className="text-sm font-bold text-ink">Teacher breakdown</h3>
              <p className="mt-0.5 text-xs text-ink/45">Filtered scope by teacher.</p>
            </div>
            <div className="divide-y divide-line">
              {teacherBreakdown.map((item) => (
                <div key={item.teacher} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-ink">{item.teacher}</p>
                      <p className="mt-0.5 text-xs text-ink/45">{item.count} students</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-ink">{item.overall}%</p>
                      <p className="text-xs font-semibold text-ink/45">{item.attendance}% attendance</p>
                    </div>
                  </div>
                </div>
              ))}
              {teacherBreakdown.length === 0 && (
                <p className="px-4 py-8 text-center text-sm text-ink/40">No teacher data in this filter.</p>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-5 border-t border-line p-5 xl:grid-cols-2">
          <div>
            <h3 className="text-sm font-bold text-ink">Lowest attendance this month</h3>
            <div className="mt-3 divide-y divide-line rounded-lg border border-line">
              {kpi.lowAttendance.slice(0, 5).map((student) => {
                const studentRecords = kpi.monthRecords.filter((record) => record.studentId === student.id);
                const present = studentRecords.filter((record) => record.present).length;
                const attendance = percent(present, studentRecords.length);
                return (
                  <div key={student.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-ink">{student.name}</p>
                      <p className="mt-0.5 text-xs text-ink/45">{student.teacher} · {student.klass}</p>
                    </div>
                    <p className="text-sm font-bold text-red-600">{attendance}%</p>
                  </div>
                );
              })}
              {kpi.lowAttendance.length === 0 && (
                <p className="px-4 py-8 text-center text-sm text-ink/40">No low attendance in this filter.</p>
              )}
            </div>
          </div>
          <div>
            <h3 className="text-sm font-bold text-ink">Academic follow-up</h3>
            <div className="mt-3 divide-y divide-line rounded-lg border border-line">
              {kpi.needsAcademicHelp.slice(0, 5).map((student) => (
                <div key={student.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-ink">{student.name}</p>
                    <p className="mt-0.5 text-xs text-ink/45">{student.teacher} · {student.klass}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-amber-700">{student.overall}%</p>
                    <p className="text-xs font-semibold text-ink/45">overall</p>
                  </div>
                </div>
              ))}
              {kpi.needsAcademicHelp.length === 0 && (
                <p className="px-4 py-8 text-center text-sm text-ink/40">No academic risk in this filter.</p>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
        <section className="rounded-lg border border-line bg-white shadow-sm">
          <div className="border-b border-line px-5 py-4">
            <h2 className="text-lg font-bold text-ink">Needs follow-up</h2>
            <p className="mt-0.5 text-sm text-ink/45">Highest-signal queue for today. Acknowledge items after assigning ownership.</p>
          </div>
          <div className="divide-y divide-line">
            {visibleExceptions.map((item) => (
              <div key={item.id} className="grid gap-4 px-5 py-4 md:grid-cols-[1fr_120px_120px] md:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-ink">{item.title}</p>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        item.tone === "bad"
                          ? "bg-red-50 text-red-600"
                          : item.tone === "warn"
                            ? "bg-amber-50 text-amber-700"
                            : "bg-cream text-ink/50"
                      }`}
                    >
                      {item.owner}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-ink/45">{item.detail}</p>
                </div>
                <span className="rounded-lg bg-cream px-3 py-2 text-center text-xs font-semibold text-ink/55">
                  {item.tone === "bad" ? "Blocker" : item.tone === "warn" ? "Needs action" : "Review"}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setAcknowledged((prev) => [...prev, item.id]);
                    setNotice(`${item.title} acknowledged.`);
                  }}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-line px-3 py-2 text-xs font-semibold text-ink/60 hover:border-gold-500 hover:text-gold-600"
                >
                  <Check size={14} /> Acknowledge
                </button>
              </div>
            ))}
            {visibleExceptions.length === 0 && (
              <p className="px-5 py-12 text-center text-sm text-ink/40">All operations exceptions are acknowledged.</p>
            )}
          </div>
        </section>

        <div className="space-y-5">
          <section className="rounded-lg border border-line bg-white shadow-sm">
            <div className="border-b border-line px-5 py-4">
              <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
                <ClipboardList size={18} /> Missed classes dashboard
              </h2>
              <p className="mt-0.5 text-sm text-ink/45">Last 12 class records from teacher attendance.</p>
            </div>
            <div className="divide-y divide-line">
              {operations.missedStats.slice(0, 6).map(({ student, missed, total, escalation }) => (
                <div key={student.id} className="grid gap-3 px-5 py-4 sm:grid-cols-[1fr_110px] sm:items-center">
                  <div>
                    <p className="text-sm font-semibold text-ink">{student.name}</p>
                    <p className="mt-1 text-xs text-ink/45">{student.teacher} · {student.klass} · {student.parentPhone}</p>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className={missed >= 5 ? "text-sm font-bold text-red-600" : "text-sm font-bold text-amber-700"}>
                      {missed}/{total}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-ink/45">{escalation}</p>
                  </div>
                </div>
              ))}
              {operations.missedStats.length === 0 && (
                <p className="px-5 py-8 text-center text-sm text-ink/40">No missed class records.</p>
              )}
            </div>
          </section>

          <section className="rounded-lg border border-line bg-white shadow-sm">
            <div className="border-b border-line px-5 py-4">
              <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
                <Users size={18} /> Group capacity
              </h2>
              <p className="mt-0.5 text-sm text-ink/45">Capacity and attendance by group.</p>
            </div>
            <div className="divide-y divide-line">
              {classGroups.map((group) => {
                const pct = Math.round((group.enrolled / group.capacity) * 100);
                const groupStudents = students.filter((student) => student.klass === group.name);
                const attendance = groupStudents.length
                  ? Math.round(groupStudents.reduce((sum, student) => sum + student.attendancePct, 0) / groupStudents.length)
                  : 0;
                return (
                  <div key={group.id} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-ink">{group.name}</p>
                        <p className="mt-1 text-xs text-ink/45">{group.teacher} · {group.schedule}</p>
                      </div>
                      <p className="text-sm font-semibold text-ink">{group.enrolled}/{group.capacity}</p>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-line">
                      <div className={pct >= 90 ? "h-full rounded-full bg-red-500" : "h-full rounded-full bg-gold-500"} style={{ width: `${pct}%` }} />
                    </div>
                    <div className="mt-2 flex justify-between text-xs text-ink/45">
                      <span>Capacity {pct}%</span>
                      <span>Attendance {attendance}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-lg border border-line bg-white shadow-sm">
            <div className="border-b border-line px-5 py-4">
              <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
                <UserCog size={18} /> Role access
              </h2>
              <p className="mt-0.5 text-sm text-ink/45">Active and inactive staff accounts.</p>
            </div>
            <div className="divide-y divide-line">
              {staffUsers.map((staff) => (
                <div key={staff.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">{staff.name}</p>
                    <p className="truncate text-xs text-ink/45">{staff.email}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${roleTone[staff.role]}`}>{staff.role}</span>
                    <span className={staff.status === "active" ? "text-xs font-semibold text-emerald-700" : "text-xs font-semibold text-red-600"}>
                      {staff.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        {[
          { icon: ClipboardList, title: "Teacher operations", sub: `${operations.lowAttendance.length} attendance follow-ups.` },
          { icon: CreditCard, title: "Finance operations", sub: `${operations.overdue.length} overdue and ${operations.terminated.length} terminated flags.` },
          { icon: FileCheck2, title: "Admissions operations", sub: `${operations.openApplications.length} active applicants in pipeline.` },
          { icon: ShieldCheck, title: "Access hygiene", sub: `${operations.inactiveUsers.length} inactive account reviews.` },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.title} className="flex gap-3 rounded-lg border border-line bg-white p-4 shadow-sm">
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
