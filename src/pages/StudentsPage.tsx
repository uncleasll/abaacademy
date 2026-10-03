import { useMemo, useState } from "react";
import { CheckSquare, FileDown, Filter, Phone, Search, UserRound } from "lucide-react";
import { AttendancePill, PaymentPill, StatusPill } from "../components/ui";
import { useAcademy } from "../data/academyStore";
import type { AttendanceStatus } from "../data/mockData";
import { downloadCsv, safeFilenamePart } from "../utils/exportCsv";
import { usd } from "../data/financeTypes";

function DirectoryStat({
  label,
  value,
  detail,
  tone = "default",
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "default" | "dark" | "good" | "warn";
}) {
  const styles = {
    default: "border-line bg-white text-ink",
    dark: "border-green-800 bg-green-900 text-cream",
    good: "border-emerald-200 bg-emerald-50 text-emerald-950",
    warn: "border-amber-200 bg-amber-50 text-amber-950",
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

export function StudentsPage() {
  const { attendanceDates, attendanceRecords, classGroups, students, updateAttendanceRecord, updateStudent } = useAcademy();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [enrollmentNote, setEnrollmentNote] = useState("");
  const run = async (action: () => Promise<void>, success: string) => {
    if (busy) return;
    setBusy(true);
    try { await action(); setNotice(success); }
    catch (error) { setNotice(`Not saved: ${error instanceof Error ? error.message : "connection error"}`); }
    finally { setBusy(false); }
  };
  const [teacherFilter, setTeacherFilter] = useState("All teachers");
  const [groupFilter, setGroupFilter] = useState("All groups");
  const [riskFilter, setRiskFilter] = useState("All students");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(students[0]?.id ?? "");

  const teachers = useMemo(() => Array.from(new Set(classGroups.map((group) => group.teacher))), [classGroups]);
  const groupOptions = useMemo(() => {
    if (teacherFilter === "All teachers") return classGroups.map((group) => group.name);
    return classGroups.filter((group) => group.teacher === teacherFilter).map((group) => group.name);
  }, [classGroups, teacherFilter]);

  const filtered = students.filter((student) => {
    const matchesTeacher = teacherFilter === "All teachers" || student.teacher === teacherFilter;
    const matchesGroup = groupFilter === "All groups" || student.klass === groupFilter;
    const matchesRisk =
      riskFilter === "All students" ||
      (riskFilter === "Low attendance" && (student.attendancePct < 80 || student.attendance === "absent")) ||
      (riskFilter === "Overdue tuition" && student.tuitionStatus === "overdue");
    const matchesQuery = `${student.name} ${student.parentName} ${student.parentPhone} ${student.address} ${student.klass} ${student.teacher}`
      .toLowerCase()
      .includes(query.toLowerCase());
    return matchesTeacher && matchesGroup && matchesRisk && matchesQuery;
  });
  const sorted = [...filtered].sort((a, b) => a.rank - b.rank);
  const selected = students.find((student) => student.id === selectedId) ?? sorted[0] ?? students[0];

  const handleTeacherFilter = (teacher: string) => {
    setTeacherFilter(teacher);
    setGroupFilter("All groups");
  };
  const clearFilters = () => {
    setTeacherFilter("All teachers");
    setGroupFilter("All groups");
    setRiskFilter("All students");
    setQuery("");
  };

  const attendanceMap = useMemo(() => {
    const map = new Map<string, AttendanceStatus>();
    attendanceRecords.forEach((record) => map.set(`${record.studentId}:${record.date}`, record.status ?? (record.present ? "present" : "absent")));
    return map;
  }, [attendanceRecords]);

  const selectedAttendance = attendanceDates.map((date) => ({
    date,
    // Days with no record (another group's class day, or before the student joined) are not absences.
    status: selected ? attendanceMap.get(`${selected.id}:${date}`) : undefined,
  }));
  const missedCount = selectedAttendance.filter((record) => record.status === "absent").length;
  const statusLabel = (status?: AttendanceStatus) => (status ? status[0].toUpperCase() + status.slice(1) : "");
  const overdueCount = students.filter((student) => student.tuitionStatus === "overdue").length;
  const lowAttendanceCount = students.filter((student) => student.attendancePct < 80 || student.attendance === "absent").length;

  const dateLabel = (date: string) => {
    const value = new Date(`${date}T00:00:00`);
    return `${value.getMonth() + 1}/${value.getDate()}/${String(value.getFullYear()).slice(2)}`;
  };

  const exportStudents = () => {
    const attendanceColumns = attendanceDates.map((date) => `Attendance ${dateLabel(date)}`);
    downloadCsv(`students-${safeFilenamePart(teacherFilter)}-${safeFilenamePart(groupFilter)}-${safeFilenamePart(riskFilter)}.csv`, [
      [
        "Student",
        "Age",
        "Teacher",
        "Group",
        "Parent",
        "Phone",
        "Address",
        "Attendance %",
        "Current Attendance",
        "Tuition Status",
        "Amount Due",
        "Performance",
        "Homework Avg",
        "Overall",
        "Status",
        "Enrollment Status",
        ...attendanceColumns,
      ],
      ...sorted.map((student) => [
        student.name,
        student.age,
        student.teacher,
        student.klass,
        student.parentName,
        student.parentPhone,
        student.address,
        `${student.attendancePct}%`,
        student.attendance,
        student.tuitionStatus,
        student.amountDue,
        `${student.performance}%`,
        `${student.homeworkAvg}%`,
        `${student.overall}%`,
        student.status,
        student.enrollmentStatus ?? "active",
        ...attendanceDates.map((date) => statusLabel(attendanceMap.get(`${student.id}:${date}`))),
      ]),
    ]);
  };

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-line bg-white shadow-sm">
        <div className="grid gap-5 p-5 xl:grid-cols-[1fr_360px] xl:items-start">
          <div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-md bg-gold-500/15 px-2.5 py-1 text-xs font-semibold uppercase text-gold-600">
                IT Admin
              </span>
              <span className="rounded-md bg-cream px-2.5 py-1 text-xs font-semibold text-ink/55">
                {sorted.length} of {students.length} students
              </span>
            </div>
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-ink sm:text-3xl">Student directory</h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink/55">
              Search families, review parent contact details, and inspect attendance or tuition risk from one profile view.
            </p>
          </div>
          <div className="rounded-lg border border-line bg-cream/45 p-3">
            <div className="grid gap-2">
              <label className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/35" size={16} />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search student, parent, phone, address"
                  className="w-full rounded-lg border border-line bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-gold-500"
                />
              </label>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="relative">
                  <Filter className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/35" size={15} />
                  <select
                    value={teacherFilter}
                    onChange={(event) => handleTeacherFilter(event.target.value)}
                    className="w-full rounded-lg border border-line bg-white py-2.5 pl-9 pr-3 text-sm font-semibold outline-none focus:border-gold-500"
                  >
                    <option>All teachers</option>
                    {teachers.map((teacher) => (
                      <option key={teacher}>{teacher}</option>
                    ))}
                  </select>
                </label>
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
              <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                <select
                  value={riskFilter}
                  onChange={(event) => setRiskFilter(event.target.value)}
                  className="rounded-lg border border-line bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:border-gold-500"
                >
                  <option>All students</option>
                  <option>Low attendance</option>
                  <option>Overdue tuition</option>
                </select>
                <button
                  type="button"
                  onClick={clearFilters}
                  className="rounded-lg border border-line bg-white px-3 py-2.5 text-sm font-semibold text-ink/60 hover:border-gold-500 hover:text-gold-600"
                >
                  Clear all
                </button>
                <button
                  type="button"
                  onClick={exportStudents}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-900 px-3 py-2.5 text-sm font-semibold text-cream hover:bg-green-800"
                >
                  <FileDown size={16} />
                  Export Excel
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <DirectoryStat label="Students" value={String(students.length)} detail="Total enrolled records" tone="dark" />
        <DirectoryStat label="Low attendance" value={String(lowAttendanceCount)} detail="Absent or below 80%" tone={lowAttendanceCount ? "warn" : "good"} />
        <DirectoryStat label="Overdue tuition" value={String(overdueCount)} detail="Needs finance review" tone={overdueCount ? "warn" : "default"} />
        <DirectoryStat label="Visible" value={String(sorted.length)} detail={`${teacherFilter} · ${groupFilter}`} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="rounded-lg border border-line bg-white shadow-sm">
          <div className="border-b border-line px-5 py-4">
            <h2 className="text-lg font-bold text-ink">Directory</h2>
            <p className="mt-0.5 text-sm text-ink/45">Select a student to open the profile panel.</p>
          </div>
          <div className="divide-y divide-line">
            {sorted.map((student) => (
              <button
                key={student.id}
                type="button"
                onClick={() => setSelectedId(student.id)}
                className={`grid w-full gap-4 px-5 py-4 text-left transition md:grid-cols-[1fr_150px_150px] md:items-center ${
                  selected?.id === student.id ? "bg-gold-300/15" : "hover:bg-cream/50"
                }`}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-semibold text-ink">{student.name}</p>
                    {student.enrollmentStatus === "terminated" && (
                      <span className="rounded-full bg-red-600 px-2.5 py-1 text-[11px] font-semibold text-white">Terminated</span>
                    )}
                    {student.attendancePct < 80 && (
                      <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">Attendance risk</span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-ink/45">
                    Age {student.age} · {student.address}
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-ink/60">
                    <Phone size={12} /> {student.parentName} · {student.parentPhone}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs md:block md:space-y-1">
                  <p className="font-semibold text-ink">{student.teacher}</p>
                  <p className="text-ink/45">{student.klass}</p>
                </div>
                <div className="flex flex-wrap gap-2 md:justify-end">
                  <AttendancePill status={student.attendance} />
                  <PaymentPill status={student.tuitionStatus} />
                </div>
              </button>
            ))}
            {sorted.length === 0 && (
              <p className="px-5 py-12 text-center text-sm text-ink/40">No students match these filters.</p>
            )}
          </div>
        </section>

        <aside className="rounded-lg border border-line bg-white shadow-sm xl:sticky xl:top-5 xl:self-start">
          {selected ? (
            <>
              <div className="border-b border-line px-5 py-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-green-900 text-cream">
                    <UserRound size={19} />
                  </div>
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-bold text-ink">{selected.name}</h2>
                    <p className="mt-1 text-sm text-ink/45">
                      {selected.teacher} · {selected.klass} · age {selected.age}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <StatusPill status={selected.status} />
                  <AttendancePill status={selected.attendance} />
                  <PaymentPill status={selected.tuitionStatus} />
                  {selected.enrollmentStatus === "terminated" && (
                    <span className="rounded-full bg-red-600 px-2.5 py-1 text-xs font-semibold text-white">Terminated</span>
                  )}
                </div>
              </div>

              <div className="space-y-4 p-5">
                <section className="rounded-lg border border-line bg-cream/45 p-3">
                  <p className="text-xs font-semibold uppercase text-ink/40">Parent contact</p>
                  <p className="mt-2 text-sm font-semibold text-ink">{selected.parentName}</p>
                  <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-ink/65">
                    <Phone size={14} /> {selected.parentPhone}
                  </p>
                  <p className="mt-1 text-xs text-ink/45">{selected.address}</p>
                </section>

                <section className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-line bg-white p-3">
                    <p className="text-xs font-semibold uppercase text-ink/40">Attendance</p>
                    <p className="mt-2 text-xl font-bold text-ink">{selected.attendancePct}%</p>
                    <p className="mt-1 text-xs text-ink/45">{missedCount} absences recorded</p>
                  </div>
                  <div className="rounded-lg border border-line bg-white p-3">
                    <p className="text-xs font-semibold uppercase text-ink/40">Tuition due</p>
                    <p className="mt-2 text-xl font-bold text-ink">{usd.format(selected.amountDue)}</p>
                    <p className="mt-1 text-xs text-ink/45">{selected.tuitionStatus}</p>
                  </div>
                </section>

                <section className="rounded-lg border border-line bg-white">
                  <div className="border-b border-line px-3 py-3">
                    <p className="text-sm font-bold text-ink">Attendance history</p>
                    <p className="mt-0.5 text-xs text-ink/45">Green present, amber late, red absent, grey no record. Click a day to correct it.</p>
                  </div>
                  <div className="grid grid-cols-4 gap-2 p-3">
                    {selectedAttendance.map((record) => {
                      const next: AttendanceStatus = record.status && record.status !== "absent" ? "absent" : "present";
                      return (
                        <button
                          key={record.date}
                          type="button"
                          disabled={busy}
                          onClick={() => void run(() => updateAttendanceRecord(selected.id, record.date, next), `${selected.name} marked ${next} on ${record.date}.`)}
                          className={`rounded-lg border px-2 py-2 text-center text-xs font-semibold disabled:opacity-60 ${
                            record.status === "present" ? "border-green-800 bg-green-900 text-white"
                              : record.status === "late" ? "border-amber-300 bg-amber-100 text-amber-900"
                              : record.status === "absent" ? "border-red-200 bg-red-50 text-red-600"
                              : "border-line bg-white text-ink/35"
                          }`}
                          aria-label={`Mark ${selected.name} ${next} on ${record.date} (currently ${record.status ?? "no record"})`}
                        >
                          <CheckSquare className="mx-auto mb-1" size={14} />
                          {dateLabel(record.date)}
                        </button>
                      );
                    })}
                  </div>
                </section>

                <section className="rounded-lg border border-line bg-white p-3">
                  <p className="text-sm font-bold text-ink">Enrollment</p>
                  <p className="mt-0.5 text-xs text-ink/45">
                    {selected.enrollmentStatus === "terminated"
                      ? "This student is terminated: the seat is free and no new monthly invoices are issued. Existing balances stay on record."
                      : "Ending enrollment frees the group seat and stops new monthly invoices. Attendance and payment history are kept."}
                  </p>
                  {selected.enrollmentStatus === "terminated" ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void run(() => updateStudent(selected.id, { enrollmentStatus: "active", terminationNote: "" }), `${selected.name} is active again.`)}
                      className="mt-3 rounded-lg bg-green-900 px-3 py-2 text-xs font-semibold text-cream disabled:opacity-60"
                    >
                      Reactivate enrollment
                    </button>
                  ) : (
                    <form
                      className="mt-3 flex flex-wrap gap-2"
                      onSubmit={(event) => {
                        event.preventDefault();
                        if (!window.confirm(`End enrollment for ${selected.name}?`)) return;
                        void run(async () => {
                          await updateStudent(selected.id, { enrollmentStatus: "terminated", terminationNote: enrollmentNote.trim() });
                          setEnrollmentNote("");
                        }, `${selected.name}'s enrollment was ended.`);
                      }}
                    >
                      <input
                        aria-label="Reason for ending enrollment"
                        required
                        minLength={3}
                        maxLength={1000}
                        value={enrollmentNote}
                        onChange={(event) => setEnrollmentNote(event.target.value)}
                        placeholder="Reason (moved, withdrew…)"
                        className="min-w-40 flex-1 rounded-lg border border-line px-3 py-2 text-xs outline-none focus:border-gold-500"
                      />
                      <button disabled={busy} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60">
                        End enrollment
                      </button>
                    </form>
                  )}
                </section>
                {notice && <p role="status" className="rounded-lg bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-900">{notice}</p>}

                {(selected.financeNote || selected.terminationNote) && (
                  <section className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <p className="text-xs font-semibold uppercase text-amber-700/70">Finance note</p>
                    <p className="mt-2 text-sm font-semibold text-amber-900">{selected.terminationNote || selected.financeNote}</p>
                  </section>
                )}
              </div>
            </>
          ) : (
            <p className="p-8 text-center text-sm text-ink/40">Select a student to view the profile.</p>
          )}
        </aside>
      </div>
    </div>
  );
}
