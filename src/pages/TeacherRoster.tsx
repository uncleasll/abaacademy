import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  ChevronDown,
  ClipboardCheck,
  Copy,
  FileDown,
  Save,
  Search,
  Star,
  UserCheck,
  UserX,
} from "lucide-react";
import { AttendancePill, HwPill } from "../components/ui";
import { type AttendanceStatus, type HwStatus } from "../data/mockData";
import { useAcademy } from "../data/academyStore";
import { downloadCsv, safeFilenamePart } from "../utils/exportCsv";

const attendanceOptions: { value: AttendanceStatus; label: string }[] = [
  { value: "present", label: "Present" },
  { value: "late", label: "Late" },
  { value: "absent", label: "Absent" },
];

const hwOptions: { value: HwStatus; label: string }[] = [
  { value: "done", label: "Done" },
  { value: "partial", label: "Partial" },
  { value: "not_done", label: "Not Done" },
];

function todayInputValue() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isNewStudent(joinedDate?: string) {
  if (!joinedDate) return false;
  const joined = new Date(`${joinedDate}T00:00:00`);
  const now = new Date();
  return now.getTime() - joined.getTime() <= 1000 * 60 * 60 * 24 * 14;
}

function SessionStat({
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

export function TeacherRoster() {
  const {
    applications,
    attendanceRecords,
    classGroups,
    saveClassSession,
    students,
    today,
    updateApplicationStatus,
    user,
  } = useAcademy();
  const teacherName = user?.teacherAlias ?? "";
  const teacherStudents = useMemo(
    // Terminated students keep their history but are no longer marked in class.
    () => students.filter((student) => student.teacher === teacherName && student.enrollmentStatus !== "terminated"),
    [students, teacherName]
  );
  const teacherGroups = useMemo(
    () => classGroups.filter((group) => group.teacher === teacherName),
    [classGroups, teacherName]
  );
  const [groupFilter, setGroupFilter] = useState(teacherGroups[0]?.name ?? "All groups");
  const [sessionDate, setSessionDate] = useState(() => today || todayInputValue());
  const recordedStatus = useMemo(() => {
    const map = new Map<string, AttendanceStatus>();
    attendanceRecords.forEach((record) => map.set(`${record.studentId}:${record.date}`, record.status ?? (record.present ? "present" : "absent")));
    return map;
  }, [attendanceRecords]);
  // Each class day opens with what was recorded for that day; a day not taken yet starts everyone as present.
  const rowsFor = (date: string) =>
    teacherStudents.map((student) => ({
      ...student,
      attendance: recordedStatus.get(`${student.id}:${date}`) ?? ("present" as AttendanceStatus),
      nextHwDraft: student.nextHw,
    }));
  const [rows, setRows] = useState(() => rowsFor(sessionDate));
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [saved, setSaved] = useState(true);
  const [sessionState, setSessionState] = useState<"not_started" | "in_progress" | "saved">("not_started");
  const [expandedRows, setExpandedRows] = useState<string[]>([]);
  const [notice, setNotice] = useState("Select a group and start today's class session.");

  useEffect(() => {
    // Unsaved edits are never replaced by a background sync.
    if (saved) setRows(rowsFor(sessionDate));
  }, [teacherStudents, recordedStatus, sessionDate, saved]);

  useEffect(() => {
    if (groupFilter !== "All groups" || !teacherGroups[0]) return;
    setGroupFilter(teacherGroups[0].name);
  }, [groupFilter, teacherGroups]);

  const activeGroup = teacherGroups.find((group) => group.name === groupFilter);
  const visibleRows = rows.filter((row) => {
    const matchesGroup = groupFilter === "All groups" || row.klass === groupFilter;
    const matchesQuery = `${row.name} ${row.parentName} ${row.parentPhone} ${row.nextHwDraft}`
      .toLowerCase()
      .includes(query.toLowerCase());
    return matchesGroup && matchesQuery;
  });
  const incomingApplicants = applications.filter((app) => app.teacher === teacherName && app.status === "teacher_review");

  const metrics = useMemo(() => {
    const present = visibleRows.filter((row) => row.attendance === "present").length;
    const late = visibleRows.filter((row) => row.attendance === "late").length;
    const absent = visibleRows.filter((row) => row.attendance === "absent").length;
    const incompleteHw = visibleRows.filter((row) => row.hw !== "done").length;
    const needsAttention = visibleRows.filter(
      (row) => row.attendance === "absent" || row.hw === "not_done"
    );
    return { present, late, absent, incompleteHw, needsAttention };
  }, [visibleRows]);

  const sessionLabel = {
    not_started: "Not started",
    in_progress: "In progress",
    saved: "Saved",
  }[sessionState];

  const tgMessage = useMemo(() => {
    const title = `${activeGroup?.name ?? groupFilter} | Daily attendance form | ${sessionDate}`;
    const lines = visibleRows.map((student, index) => {
      const attendance = student.attendance === "present" ? "Present" : student.attendance === "late" ? "Late" : "Absent";
      const homework = student.hw === "done" ? "HW done" : student.hw === "partial" ? "HW partial" : "HW not done";
      return `${index + 1}. ${student.name}
   ${attendance} | ${homework} | ${student.stars}/5
   Next: ${student.nextHwDraft || "-"}`;
    });
    return `${title}
Teacher: ${teacherName}

${lines.join("\n\n")}

Summary: ${metrics.present} present, ${metrics.late} late, ${metrics.absent} absent.`;
  }, [activeGroup?.name, groupFilter, metrics.absent, metrics.late, metrics.present, sessionDate, teacherName, visibleRows]);

  const update = (id: string, patch: Partial<(typeof rows)[number]>) => {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
    setSaved(false);
    setSessionState("in_progress");
    setNotice("Unsaved class changes are ready.");
  };

  const setAllAttendance = (attendance: AttendanceStatus) => {
    setRows((prev) => prev.map((row) => (visibleRows.some((item) => item.id === row.id) ? { ...row, attendance } : row)));
    setSaved(false);
    setSessionState("in_progress");
    setNotice(`${visibleRows.length} students marked ${attendance}.`);
  };

  const dateRecorded = visibleRows.length > 0 && visibleRows.every((row) => recordedStatus.has(`${row.id}:${sessionDate}`));

  const saveChanges = async () => {
    if (saving) return;
    if (!visibleRows.length) {
      setNotice("There are no students in this view to save.");
      return;
    }
    setSaving(true);
    setNotice("Saving class…");
    try {
      // One request stores the whole class: either every student is saved or none are.
      const posts = await saveClassSession(
        sessionDate,
        visibleRows.map((row) => ({ studentId: row.id, attendance: row.attendance, stars: row.stars, hw: row.hw, nextHw: row.nextHwDraft }))
      );
      setSaved(true); setSessionState("saved");
      const failed = posts.filter((post) => post.status === "failed");
      const posted = posts.filter((post) => post.status === "sent" || post.status === "updated");
      const telegramNote = failed.length
        ? ` The class is saved, but the Telegram post failed (${failed[0].detail ?? "Telegram error"}). Press Save class again to resend, or copy the summary below.`
        : posted.length
          ? posted.some((post) => post.status === "sent") ? " Attendance was posted to the Telegram group." : " The Telegram post was updated."
          : "";
      setNotice(`${visibleRows.length} student records saved for ${sessionDate}.${telegramNote}`);
    } catch (error) {
      setNotice(`Class was not saved: ${error instanceof Error ? error.message : "connection error"} Your draft is kept; press Save class to retry.`);
    } finally {
      setSaving(false);
    }
  };

  const startSession = () => {
    setSessionState("in_progress");
    setNotice(`${activeGroup?.name ?? "Class"} session started. Take attendance first.`);
  };

  const copyTgMessage = async () => {
    try {
      await navigator.clipboard.writeText(tgMessage);
      setNotice("Daily summary copied. Paste it into your class Telegram group.");
    } catch {
      setNotice("Copy is blocked by this browser. Select the summary text below and copy it manually.");
    }
  };

  const exportSession = () => {
    downloadCsv(`attendance-${sessionDate}-${safeFilenamePart(groupFilter)}.csv`, [
      ["Date", "Teacher", "Group", "Student", "Parent", "Phone", "Attendance", "Homework", "Stars", "Next Homework", "Enrollment Status", "Finance Note"],
      ...visibleRows.map((student) => [
        sessionDate,
        teacherName,
        student.klass,
        student.name,
        student.parentName,
        student.parentPhone,
        student.attendance,
        student.hw,
        student.stars,
        student.nextHwDraft || "",
        student.enrollmentStatus ?? "active",
        student.terminationNote || student.financeNote || "",
      ]),
    ]);
    setNotice(`${visibleRows.length} attendance rows exported for ${sessionDate}.`);
  };

  const toggleExpanded = (id: string) => {
    setExpandedRows((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const steps = [
    { label: "Start", active: sessionState !== "not_started" },
    { label: "Attendance", active: sessionState === "in_progress" || sessionState === "saved" },
    { label: "Save", active: sessionState === "saved" },
    { label: "Share summary", active: sessionState === "saved" },
  ];

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-line bg-white shadow-sm">
        <div className="grid gap-5 p-5 xl:grid-cols-[1fr_360px] xl:items-start">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-gold-500/15 px-2.5 py-1 text-xs font-semibold uppercase text-gold-600">
                Teacher
              </span>
              <span className="rounded-md bg-cream px-2.5 py-1 text-xs font-semibold text-ink/55">{sessionLabel}</span>
            </div>
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-ink sm:text-3xl">Today's class session</h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink/55">
              Take attendance first, update homework and rating as needed, then save the class session.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-line bg-cream/45 px-3 py-2">
                <label className="block text-xs font-semibold uppercase text-ink/40" htmlFor="teacher-session-date">
                  Date
                </label>
                <div className="mt-1 flex items-center gap-1.5">
                  <CalendarDays size={15} className="text-ink/55" />
                  <input
                    id="teacher-session-date"
                    type="date"
                    value={sessionDate}
                    max={today || undefined}
                    onChange={(event) => {
                      if (!event.target.value) return;
                      setSessionDate(event.target.value);
                      setSessionState((current) => (current === "not_started" ? current : "in_progress"));
                      setNotice(saved
                        ? `Showing the class record for ${event.target.value}.`
                        : `Class date set to ${event.target.value}. Your unsaved marks will be saved to this date.`);
                    }}
                    className="min-w-0 flex-1 rounded-md border border-line bg-white px-2 py-1 text-sm font-semibold text-ink outline-none focus:border-gold-500"
                  />
                </div>
              </div>
              <div className="rounded-lg border border-line bg-cream/45 px-3 py-2">
                <p className="text-xs font-semibold uppercase text-ink/40">Group</p>
                <p className="mt-1 text-sm font-semibold text-ink">{activeGroup?.name ?? groupFilter}</p>
              </div>
              <div className="rounded-lg border border-line bg-cream/45 px-3 py-2">
                <p className="text-xs font-semibold uppercase text-ink/40">Schedule</p>
                <p className="mt-1 truncate text-sm font-semibold text-ink">{activeGroup?.schedule ?? "Class schedule"}</p>
              </div>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-4">
              {steps.map((step, index) => (
                <div
                  key={step.label}
                  className={`rounded-lg border px-3 py-2 text-xs font-semibold ${
                    step.active ? "border-green-800 bg-green-900 text-cream" : "border-line bg-cream/45 text-ink/45"
                  }`}
                >
                  {index + 1}. {step.label}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-line bg-cream/45 p-3">
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
              <select
                value={groupFilter}
                onChange={(event) => {
                  setGroupFilter(event.target.value);
                  setNotice(`${event.target.value} selected.`);
                }}
                className="rounded-lg border border-line bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:border-gold-500"
              >
                <option>All groups</option>
                {teacherGroups.map((group) => (
                  <option key={group.id}>{group.name}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={sessionState === "not_started" ? startSession : saveChanges}
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-900 px-4 py-2.5 text-sm font-semibold text-cream hover:bg-green-800 disabled:opacity-60"
              >
                {sessionState === "not_started" ? <ClipboardCheck size={16} /> : saved && dateRecorded ? <Check size={16} /> : <Save size={16} />}
                {sessionState === "not_started" ? "Start class" : saving ? "Saving…" : saved && dateRecorded ? "Saved" : "Save class"}
              </button>
              <button
                type="button"
                onClick={exportSession}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-green-800 bg-white px-4 py-2.5 text-sm font-semibold text-green-900 hover:bg-cream"
              >
                <FileDown size={16} />
                Export Excel
              </button>
            </div>
            <p className="mt-3 rounded-md bg-white px-3 py-2 text-xs font-semibold text-ink/55">{notice}</p>
          </div>
        </div>
      </section>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <SessionStat label="Students" value={String(visibleRows.length)} detail={groupFilter} tone="dark" />
        <SessionStat label="Present" value={String(metrics.present)} detail={`${metrics.late} late`} tone="good" />
        <SessionStat label="Absent" value={String(metrics.absent)} detail="Parent follow-up signal" tone={metrics.absent ? "bad" : "default"} />
        <SessionStat label="Homework issues" value={String(metrics.incompleteHw)} detail="Partial or not done" tone={metrics.incompleteHw ? "warn" : "default"} />
        <SessionStat label="Incoming" value={String(incomingApplicants.length)} detail="Teacher decisions" />
      </div>

      <details className="rounded-lg border border-line bg-white shadow-sm">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-ink">Daily Telegram summary</h2>
            <p className="mt-0.5 text-sm text-ink/45">
              {activeGroup?.telegramConnected
                ? "This group's attendance is posted to its Telegram group automatically when you save. You can also copy the summary."
                : "No Telegram group is connected for this class yet. Copy the summary after saving and paste it into your group."}
            </p>
          </div>
          <ChevronDown size={18} className="text-ink/45" />
        </summary>
        <div className="flex flex-wrap gap-2 border-t border-line px-5 py-4">
          <button
            type="button"
            onClick={copyTgMessage}
            className="inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-xs font-semibold text-ink/60 hover:border-gold-500 hover:text-gold-600"
          >
            <Copy size={14} /> Copy summary
          </button>
        </div>
        <pre className="max-h-72 overflow-y-auto whitespace-pre-wrap border-t border-line p-5 font-mono text-xs leading-relaxed text-ink/70">
          {tgMessage}
        </pre>
      </details>

      {(incomingApplicants.length > 0 || metrics.needsAttention.length > 0) && (
        <section className="grid gap-4 xl:grid-cols-[1fr_420px]">
          {incomingApplicants.length > 0 && (
            <div className="rounded-lg border border-line bg-white shadow-sm">
              <div className="border-b border-line px-5 py-4">
                <h2 className="text-lg font-bold text-ink">Needs your decision</h2>
                <p className="mt-0.5 text-sm text-ink/45">Registration assigned these incoming students to you.</p>
              </div>
              <div className="divide-y divide-line">
                {incomingApplicants.map((app) => (
                  <div key={app.id} className="grid gap-4 px-5 py-4 md:grid-cols-[1fr_220px] md:items-center">
                    <div>
                      <p className="font-semibold text-ink">{app.name}</p>
                      <p className="mt-1 text-xs text-ink/45">
                        Age {app.age} · {app.klass} · {app.program}
                      </p>
                      <p className="mt-1 text-xs text-ink/45">
                        {app.parentName} {app.parentSurname} · {app.phone}
                      </p>
                    </div>
                    <div className="flex gap-2 md:justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          void updateApplicationStatus(app.id, "accepted").then(() => setNotice(`${app.name} accepted for ${app.klass}.`)).catch(error => setNotice(`Could not confirm acceptance: ${error.message}`));
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-green-900 px-3 py-2 text-xs font-semibold text-cream hover:bg-green-800"
                      >
                        <UserCheck size={14} /> Accept
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void updateApplicationStatus(app.id, "rejected").then(() => setNotice(`${app.name} declined by teacher.`)).catch(error => setNotice(`Could not confirm decision: ${error.message}`));
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-xs font-semibold text-red-600 hover:border-red-200 hover:bg-red-50"
                      >
                        <UserX size={14} /> Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-lg border border-line bg-white shadow-sm">
            <div className="border-b border-line px-5 py-4">
              <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
                <AlertTriangle size={18} /> Needs attention
              </h2>
              <p className="mt-0.5 text-sm text-ink/45">Absent, homework issue, or enrollment note.</p>
            </div>
            <div className="divide-y divide-line">
              {metrics.needsAttention.slice(0, 6).map((student) => (
                <div key={student.id} className="px-5 py-3">
                  <p className="text-sm font-semibold text-ink">{student.name}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <AttendancePill status={student.attendance} />
                    <HwPill status={student.hw} />
                    {student.enrollmentStatus === "terminated" && (
                      <span className="rounded-full bg-red-600 px-2.5 py-1 text-xs font-semibold text-white">Terminated</span>
                    )}
                  </div>
                  {(student.terminationNote || student.financeNote) && (
                    <p className="mt-2 text-xs font-semibold text-amber-700">{student.terminationNote || student.financeNote}</p>
                  )}
                </div>
              ))}
              {metrics.needsAttention.length === 0 && (
                <p className="px-5 py-8 text-center text-sm text-ink/40">No classroom issues in this group.</p>
              )}
            </div>
          </div>
        </section>
      )}

      <section className="rounded-lg border border-line bg-white shadow-sm">
        <div className="grid gap-3 border-b border-line p-4 lg:grid-cols-[1fr_auto] lg:items-center">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/35" size={17} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search student, parent, phone, assignment"
              className="w-full rounded-lg border border-line bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-gold-500"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            {attendanceOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setAllAttendance(option.value)}
                className="rounded-lg border border-line px-3 py-2 text-xs font-semibold text-ink/60 hover:border-gold-500 hover:text-gold-600"
              >
                Mark all {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="divide-y divide-line">
          {visibleRows.map((student) => (
            <div
              key={student.id}
              className={`px-4 py-3 ${
                student.attendance === "absent"
                  ? "bg-red-50/60"
                  : student.hw === "not_done"
                    ? "bg-amber-50/55"
                    : "bg-white"
              }`}
            >
              <div className="grid gap-3 xl:grid-cols-[minmax(360px,1fr)_250px_190px_120px] xl:items-center">
                <div className="min-w-0">
                  <div className="flex min-w-0 flex-wrap items-center gap-2 xl:flex-nowrap">
                    <p className="truncate font-semibold text-ink">{student.name}</p>
                    {isNewStudent(student.joinedDate) && (
                      <span className="rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-700">
                        New student
                      </span>
                    )}
                    <AttendancePill status={student.attendance} />
                    {student.enrollmentStatus === "terminated" && (
                      <span className="rounded-full bg-red-600 px-2.5 py-1 text-xs font-semibold text-white">Terminated</span>
                    )}
                    <span className="hidden truncate text-xs text-ink/45 xl:inline">
                      {student.klass} · {student.parentPhone}{student.joinedDate ? ` · Joined ${student.joinedDate}` : ""}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-ink/45 xl:hidden">
                    {student.klass} · {student.parentPhone}
                    {student.joinedDate ? ` · Joined ${student.joinedDate}` : ""}
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-1.5">
                  {attendanceOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => update(student.id, { attendance: option.value })}
                      className={`rounded-lg px-2.5 py-2 text-xs font-semibold ${
                        student.attendance === option.value
                          ? "bg-green-900 text-cream"
                          : "border border-line bg-white text-ink/55 hover:border-gold-500 hover:text-gold-600"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={student.hw}
                    onChange={(event) => update(student.id, { hw: event.target.value as HwStatus })}
                    className="rounded-lg border border-line bg-white px-2.5 py-2 text-xs font-semibold text-ink outline-none focus:border-gold-500"
                  >
                    {hwOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <div className="flex h-[34px] items-center gap-0.5 rounded-lg border border-line bg-white px-2">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <button
                        key={index}
                        type="button"
                        aria-label={`${index + 1} star${index ? "s" : ""} for ${student.name}`}
                        onClick={() => update(student.id, { stars: student.stars === index + 1 ? 0 : index + 1 })}
                        className="inline-flex h-7 w-5 items-center justify-center"
                      >
                        <Star
                          size={14}
                          className={index < student.stars ? "fill-amber-400 text-amber-400" : "text-line"}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => toggleExpanded(student.id)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-line bg-white px-3 py-2 text-xs font-semibold text-ink/60 hover:border-gold-500 hover:text-gold-600"
                >
                  Details <ChevronDown size={14} />
                </button>
              </div>

              {expandedRows.includes(student.id) && (
                <div className="mt-3 grid gap-3 rounded-lg border border-line bg-white p-3 lg:grid-cols-[1fr_360px]">
                  <label className="block space-y-1.5 text-xs font-semibold uppercase text-ink/40">
                    Next assignment
                    <input
                      value={student.nextHwDraft}
                      onChange={(event) => update(student.id, { nextHwDraft: event.target.value })}
                      className="w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm font-medium normal-case text-ink outline-none focus:border-gold-500"
                    />
                  </label>

                  <div className="rounded-lg border border-line bg-cream/45 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase text-ink/40">Enrollment / finance</p>
                      <span className="text-xs font-semibold">{student.enrollmentStatus ?? "active"}</span>
                    </div>
                    <p className="mt-2 text-xs text-ink/60">{student.terminationNote || student.financeNote || "Enrollment and billing are managed by administration / finance."}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
          {visibleRows.length === 0 && (
            <div className="px-5 py-12 text-center text-sm text-ink/40">No students match this view.</div>
          )}
        </div>
      </section>
    </div>
  );
}
