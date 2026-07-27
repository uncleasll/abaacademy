import { useEffect, useMemo, useState } from "react";
import { Check, CheckSquare, Save, Search, Star } from "lucide-react";
import { AttendancePill, HwPill, SectionTitle } from "../components/ui";
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

function TeacherMetric({
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
    <div className={`rounded-xl border p-4 shadow-sm ${styles[tone]}`}>
      <p className={`text-xs font-semibold uppercase ${tone === "dark" ? "text-gold-300" : "text-ink/45"}`}>
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
      <p className={`mt-2 text-xs ${tone === "dark" ? "text-cream/65" : "text-ink/50"}`}>{detail}</p>
    </div>
  );
}

export function TeacherRoster() {
  const { attendanceDates, attendanceRecords, classGroups, students, updateAttendanceRecord, updateStudent } = useAcademy();
  const [rows, setRows] = useState(students.map((student) => ({ ...student, nextHwDraft: student.nextHw })));
  const [groupFilter, setGroupFilter] = useState("All groups");
  const [query, setQuery] = useState("");
  const [saved, setSaved] = useState(true);
  const [notice, setNotice] = useState("Roster is ready for today's attendance and homework updates.");

  useEffect(() => {
    setRows(students.map((student) => ({ ...student, nextHwDraft: student.nextHw })));
  }, [students]);

  const visibleRows = rows.filter((row) => {
    const matchesGroup = groupFilter === "All groups" || row.klass === groupFilter;
    const matchesQuery = `${row.name} ${row.parentName} ${row.parentPhone} ${row.nextHwDraft}`
      .toLowerCase()
      .includes(query.toLowerCase());
    return matchesGroup && matchesQuery;
  });

  const metrics = useMemo(() => {
    const present = visibleRows.filter((row) => row.attendance === "present").length;
    const late = visibleRows.filter((row) => row.attendance === "late").length;
    const absent = visibleRows.filter((row) => row.attendance === "absent").length;
    const completeHw = visibleRows.filter((row) => row.hw === "done").length;
    const avgRating = visibleRows.length
      ? (visibleRows.reduce((sum, row) => sum + row.stars, 0) / visibleRows.length).toFixed(1)
      : "0.0";
    return { present, late, absent, completeHw, avgRating };
  }, [visibleRows]);

  const recentDates = attendanceDates.slice(-5);
  const attendanceMap = useMemo(() => {
    const map = new Map<string, boolean>();
    attendanceRecords.forEach((record) => map.set(`${record.studentId}:${record.date}`, record.present));
    return map;
  }, [attendanceRecords]);
  const dateLabel = (date: string) => {
    const value = new Date(`${date}T00:00:00`);
    return `${value.getMonth() + 1}/${value.getDate()}/${String(value.getFullYear()).slice(2)}`;
  };

  const update = (id: string, patch: Partial<(typeof rows)[number]>) => {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
    setSaved(false);
    setNotice("Unsaved classroom changes are ready to save.");
  };

  const saveChanges = () => {
    setRows((prev) => prev.map((row) => ({ ...row, nextHw: row.nextHwDraft })));
    visibleRows.forEach((row) => {
      void updateStudent(row.id, {
        attendance: row.attendance,
        stars: row.stars,
        hw: row.hw,
        nextHw: row.nextHwDraft,
      });
    });
    setSaved(true);
    setNotice(`${visibleRows.length} student records saved for today's class.`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <SectionTitle
          eyebrow="Teacher"
          title="Class workspace"
          sub="Take attendance, grade homework, and prepare the next assignment in one clean view."
        />
        <button
          onClick={saveChanges}
          className="inline-flex items-center gap-2 rounded-lg bg-green-900 px-4 py-2.5 text-sm font-semibold text-cream hover:bg-green-800"
        >
          {saved ? <Check size={16} /> : <Save size={16} />}
          {saved ? "Saved" : "Save changes"}
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <TeacherMetric label="Students shown" value={String(visibleRows.length)} detail={groupFilter} tone="dark" />
        <TeacherMetric label="Present" value={String(metrics.present)} detail={`${metrics.late} late · ${metrics.absent} absent`} tone="good" />
        <TeacherMetric label="Homework done" value={String(metrics.completeHw)} detail="Completed before class" />
        <TeacherMetric label="Average rating" value={metrics.avgRating} detail="Out of 5 stars" tone="warn" />
      </div>

      <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">{notice}</div>

      <section className="rounded-xl border border-line bg-white shadow-sm">
        <div className="grid gap-3 border-b border-line p-4 lg:grid-cols-[1fr_210px]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/35" size={17} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search student, parent, phone, assignment"
              className="w-full rounded-lg border border-line bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-gold-500"
            />
          </label>
          <select
            value={groupFilter}
            onChange={(event) => setGroupFilter(event.target.value)}
            className="rounded-lg border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-gold-500"
          >
            <option>All groups</option>
            {classGroups.map((group) => (
              <option key={group.id}>{group.name}</option>
            ))}
          </select>
        </div>

        <div className="divide-y divide-line md:hidden">
          {visibleRows.map((student) => (
            <div key={student.id} className="space-y-4 p-4">
              <div>
                <p className="font-semibold text-ink">{student.name}</p>
                <p className="mt-1 text-xs text-ink/45">
                  {student.klass} · {student.parentPhone}
                </p>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase text-ink/40">Attendance</span>
                  <AttendancePill status={student.attendance} />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {attendanceOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => update(student.id, { attendance: option.value })}
                      className={`rounded-lg px-2.5 py-2 text-xs font-semibold ${
                        student.attendance === option.value
                          ? "bg-green-900 text-cream"
                          : "bg-cream text-ink/45 hover:bg-line"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase text-ink/40">Rating</p>
                  <div className="flex gap-1">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <button key={index} onClick={() => update(student.id, { stars: index + 1 })}>
                        <Star
                          size={20}
                          className={index < student.stars ? "fill-amber-400 text-amber-400" : "text-line"}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase text-ink/40">Homework</span>
                    <HwPill status={student.hw} />
                  </div>
                  <select
                    value={student.hw}
                    onChange={(event) => update(student.id, { hw: event.target.value as HwStatus })}
                    className="w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-gold-500"
                  >
                    {hwOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <label className="space-y-1.5 text-xs font-semibold uppercase text-ink/40">
                Next assignment
                <input
                  value={student.nextHwDraft}
                  onChange={(event) => update(student.id, { nextHwDraft: event.target.value })}
                  className="w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm font-medium normal-case text-ink outline-none focus:border-gold-500"
                />
              </label>
            </div>
          ))}
          {visibleRows.length === 0 && (
            <div className="px-5 py-12 text-center text-sm text-ink/40">
              No students match this view.
            </div>
          )}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="min-w-[1180px] w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line bg-cream/60 text-xs uppercase text-ink/45">
                <th className="px-5 py-3 font-semibold">Student</th>
                <th className="px-5 py-3 font-semibold">Attendance</th>
                {recentDates.map((date) => (
                  <th key={date} className="px-3 py-3 text-center font-semibold">{dateLabel(date)}</th>
                ))}
                <th className="px-5 py-3 font-semibold">Rating</th>
                <th className="px-5 py-3 font-semibold">Homework</th>
                <th className="min-w-72 px-5 py-3 font-semibold">Next assignment</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((student) => (
                <tr key={student.id} className="border-b border-line last:border-0 hover:bg-cream/50">
                  <td className="px-5 py-4">
                    <p className="font-semibold text-ink">{student.name}</p>
                    <p className="mt-1 text-xs text-ink/45">
                      {student.klass} · {student.parentPhone}
                    </p>
                  </td>
                  <td className="px-5 py-4">
                    <div className="mb-2">
                      <AttendancePill status={student.attendance} />
                    </div>
                    <div className="flex gap-1">
                      {attendanceOptions.map((option) => (
                        <button
                          key={option.value}
                          onClick={() => update(student.id, { attendance: option.value })}
                          className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
                            student.attendance === option.value
                              ? "bg-green-900 text-cream"
                              : "bg-cream text-ink/45 hover:bg-line"
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </td>
                  {recentDates.map((date) => {
                    const checked = attendanceMap.get(`${student.id}:${date}`) ?? false;
                    return (
                      <td key={date} className="px-3 py-4 text-center">
                        <button
                          type="button"
                          onClick={() => void updateAttendanceRecord(student.id, date, !checked)}
                          className={`inline-flex h-7 w-7 items-center justify-center rounded-md border ${
                            checked ? "border-green-800 bg-green-900 text-white" : "border-ink/35 bg-white text-transparent"
                          }`}
                          aria-label={`${checked ? "Mark absent" : "Mark present"} ${student.name} on ${date}`}
                        >
                          <CheckSquare size={16} />
                        </button>
                      </td>
                    );
                  })}
                  <td className="px-5 py-4">
                    <div className="flex gap-0.5">
                      {Array.from({ length: 5 }).map((_, index) => (
                        <button key={index} onClick={() => update(student.id, { stars: index + 1 })}>
                          <Star
                            size={17}
                            className={index < student.stars ? "fill-amber-400 text-amber-400" : "text-line"}
                          />
                        </button>
                      ))}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="mb-2">
                      <HwPill status={student.hw} />
                    </div>
                    <select
                      value={student.hw}
                      onChange={(event) => update(student.id, { hw: event.target.value as HwStatus })}
                      className="rounded-lg border border-line bg-white px-2.5 py-2 text-xs outline-none focus:border-gold-500"
                    >
                      {hwOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-5 py-4">
                    <input
                      value={student.nextHwDraft}
                      onChange={(event) => update(student.id, { nextHwDraft: event.target.value })}
                      className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-gold-500"
                    />
                  </td>
                </tr>
              ))}
              {visibleRows.length === 0 && (
                <tr>
                  <td colSpan={5 + recentDates.length} className="px-5 py-12 text-center text-sm text-ink/40">
                    No students match this view.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
