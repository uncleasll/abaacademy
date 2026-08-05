import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  ClipboardCheck,
  Copy,
  Save,
  Search,
  Send,
  Star,
  UserCheck,
  UserX,
} from "lucide-react";
import { AttendancePill, HwPill } from "../components/ui";
import { type AttendanceStatus, type HwStatus } from "../data/mockData";
import { useAcademy } from "../data/academyStore";

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
    attendanceDates,
    classGroups,
    queueReminder,
    students,
    updateApplicationStatus,
    updateAttendanceRecord,
    updateStudent,
    user,
  } = useAcademy();
  const teacherName = user?.name.split(" ")[0] ?? "";
  const teacherStudents = useMemo(
    () => students.filter((student) => student.teacher === teacherName),
    [students, teacherName]
  );
  const teacherGroups = useMemo(
    () => classGroups.filter((group) => group.teacher === teacherName),
    [classGroups, teacherName]
  );
  const sessionDate = attendanceDates[attendanceDates.length - 1] ?? new Date().toISOString().slice(0, 10);

  const [rows, setRows] = useState(teacherStudents.map((student) => ({ ...student, nextHwDraft: student.nextHw })));
  const [groupFilter, setGroupFilter] = useState(teacherGroups[0]?.name ?? "All groups");
  const [query, setQuery] = useState("");
  const [saved, setSaved] = useState(true);
  const [sessionState, setSessionState] = useState<"not_started" | "in_progress" | "saved">("not_started");
  const [notice, setNotice] = useState("Select a group and start today's class session.");

  useEffect(() => {
    setRows(teacherStudents.map((student) => ({ ...student, nextHwDraft: student.nextHw })));
  }, [teacherStudents]);

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
      (row) => row.attendance === "absent" || row.hw === "not_done" || row.enrollmentStatus === "terminated"
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

Summary: ${metrics.present} present, ${metrics.late} late, ${metrics.absent} absent.
Demo bot preview only.`;
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

  const saveChanges = () => {
    setRows((prev) => prev.map((row) => ({ ...row, nextHw: row.nextHwDraft })));
    visibleRows.forEach((row) => {
      void updateStudent(row.id, {
        attendance: row.attendance,
        stars: row.stars,
        hw: row.hw,
        nextHw: row.nextHwDraft,
        enrollmentStatus: row.enrollmentStatus,
        financeNote: row.financeNote,
        terminationNote: row.terminationNote,
      });
      void updateAttendanceRecord(row.id, sessionDate, row.attendance !== "absent");
    });
    setSaved(true);
    setSessionState("saved");
    setNotice(`${visibleRows.length} student records saved for today's class.`);
  };

  const startSession = () => {
    setSessionState("in_progress");
    setNotice(`${activeGroup?.name ?? "Class"} session started. Take attendance first.`);
  };

  const copyTgMessage = async () => {
    await navigator.clipboard?.writeText(tgMessage);
    setNotice("Daily TG form copied.");
  };

  const queueDemoBot = () => {
    void queueReminder({
      type: "teacher-daily-tg-demo",
      teacher: teacherName,
      group: groupFilter,
      date: sessionDate,
      message: tgMessage,
      studentCount: visibleRows.length,
    });
    setNotice("Demo Telegram bot message queued.");
  };

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
                <p className="text-xs font-semibold uppercase text-ink/40">Date</p>
                <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-ink">
                  <CalendarDays size={15} /> {sessionDate}
                </p>
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
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-900 px-4 py-2.5 text-sm font-semibold text-cream hover:bg-green-800"
              >
                {sessionState === "not_started" ? <ClipboardCheck size={16} /> : saved ? <Check size={16} /> : <Save size={16} />}
                {sessionState === "not_started" ? "Start class" : saved ? "Saved" : "Save class"}
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

      <section className="rounded-lg border border-line bg-white shadow-sm">
        <div className="grid gap-4 border-b border-line px-5 py-4 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <h2 className="text-lg font-bold text-ink">Daily TG bot form demo</h2>
            <p className="mt-0.5 text-sm text-ink/45">Preview the message that the Telegram bot would send for this class session.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={copyTgMessage}
              className="inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-xs font-semibold text-ink/60 hover:border-gold-500 hover:text-gold-600"
            >
              <Copy size={14} /> Copy TG form
            </button>
            <button
              type="button"
              onClick={queueDemoBot}
              className="inline-flex items-center gap-2 rounded-lg bg-green-900 px-3 py-2 text-xs font-semibold text-cream hover:bg-green-800"
            >
              <Send size={14} /> Queue demo bot
            </button>
          </div>
        </div>
        <pre className="max-h-72 overflow-y-auto whitespace-pre-wrap p-5 font-mono text-xs leading-relaxed text-ink/70">
          {tgMessage}
        </pre>
      </section>

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
                          void updateApplicationStatus(app.id, "accepted");
                          setNotice(`${app.name} accepted for ${app.klass}.`);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-green-900 px-3 py-2 text-xs font-semibold text-cream hover:bg-green-800"
                      >
                        <UserCheck size={14} /> Accept
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void updateApplicationStatus(app.id, "rejected");
                          setNotice(`${app.name} declined by teacher.`);
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

        <div className="grid gap-3 p-4 lg:grid-cols-2 2xl:grid-cols-3">
          {visibleRows.map((student) => (
            <article
              key={student.id}
              className={`rounded-lg border p-4 shadow-sm ${
                student.attendance === "absent"
                  ? "border-red-200 bg-red-50/60"
                  : student.hw === "not_done"
                    ? "border-amber-200 bg-amber-50/55"
                    : "border-line bg-white"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-ink">{student.name}</p>
                  <p className="mt-1 text-xs text-ink/45">
                    {student.klass} · {student.parentPhone}
                  </p>
                </div>
                <AttendancePill status={student.attendance} />
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
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

              <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_150px]">
                <label className="space-y-1.5 text-xs font-semibold uppercase text-ink/40">
                  Homework
                  <select
                    value={student.hw}
                    onChange={(event) => update(student.id, { hw: event.target.value as HwStatus })}
                    className="w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm font-semibold normal-case text-ink outline-none focus:border-gold-500"
                  >
                    {hwOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase text-ink/40">Rating</p>
                  <div className="flex h-[38px] items-center gap-0.5 rounded-lg border border-line bg-white px-2">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => update(student.id, { stars: index + 1 })}
                        className="inline-flex h-8 w-6 items-center justify-center"
                      >
                        <Star
                          size={17}
                          className={index < student.stars ? "fill-amber-400 text-amber-400" : "text-line"}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <label className="mt-4 block space-y-1.5 text-xs font-semibold uppercase text-ink/40">
                Next assignment
                <input
                  value={student.nextHwDraft}
                  onChange={(event) => update(student.id, { nextHwDraft: event.target.value })}
                  className="w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm font-medium normal-case text-ink outline-none focus:border-gold-500"
                />
              </label>

              <div className="mt-4 rounded-lg border border-line bg-cream/45 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      update(student.id, {
                        enrollmentStatus: student.enrollmentStatus === "terminated" ? "active" : "terminated",
                        terminationNote:
                          student.enrollmentStatus === "terminated"
                            ? ""
                            : student.terminationNote || "Teacher marked terminated. Finance review needed.",
                        financeNote:
                          student.enrollmentStatus === "terminated" ? "" : "Student terminated by teacher. Stop/verify billing.",
                      })
                    }
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold ${
                      student.enrollmentStatus === "terminated"
                        ? "bg-red-600 text-white"
                        : "border border-line bg-white text-ink/55 hover:border-red-200 hover:text-red-600"
                    }`}
                  >
                    <UserX size={14} /> {student.enrollmentStatus === "terminated" ? "Terminated" : "Terminate"}
                  </button>
                  <HwPill status={student.hw} />
                </div>
                <input
                  value={student.terminationNote ?? student.financeNote ?? ""}
                  onChange={(event) => update(student.id, { terminationNote: event.target.value, financeNote: event.target.value })}
                  placeholder="Optional note visible to finance"
                  className="mt-2 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-gold-500"
                />
              </div>
            </article>
          ))}
          {visibleRows.length === 0 && (
            <div className="col-span-full px-5 py-12 text-center text-sm text-ink/40">No students match this view.</div>
          )}
        </div>
      </section>
    </div>
  );
}
