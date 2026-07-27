import { useMemo, useState } from "react";
import { CheckSquare, Filter, Search } from "lucide-react";
import { AttendancePill, PaymentPill, SectionTitle, StatusPill } from "../components/ui";
import { useAcademy } from "../data/academyStore";

export function StudentsPage() {
  const { attendanceDates, attendanceRecords, classGroups, students, updateAttendanceRecord } = useAcademy();
  const [teacherFilter, setTeacherFilter] = useState("All teachers");
  const [groupFilter, setGroupFilter] = useState("All groups");
  const [query, setQuery] = useState("");

  const teachers = useMemo(() => Array.from(new Set(classGroups.map((group) => group.teacher))), []);
  const groupOptions = useMemo(() => {
    if (teacherFilter === "All teachers") return classGroups.map((group) => group.name);
    return classGroups.filter((group) => group.teacher === teacherFilter).map((group) => group.name);
  }, [teacherFilter]);

  const filtered = students.filter((student) => {
    const matchesTeacher = teacherFilter === "All teachers" || student.teacher === teacherFilter;
    const matchesGroup = groupFilter === "All groups" || student.klass === groupFilter;
    const matchesQuery = `${student.name} ${student.parentName} ${student.parentPhone} ${student.address}`
      .toLowerCase()
      .includes(query.toLowerCase());
    return matchesTeacher && matchesGroup && matchesQuery;
  });
  const sorted = [...filtered].sort((a, b) => a.rank - b.rank);

  const handleTeacherFilter = (teacher: string) => {
    setTeacherFilter(teacher);
    setGroupFilter("All groups");
  };

  const attendanceMap = useMemo(() => {
    const map = new Map<string, boolean>();
    attendanceRecords.forEach((record) => map.set(`${record.studentId}:${record.date}`, record.present));
    return map;
  }, [attendanceRecords]);

  const dateLabel = (date: string) => {
    const value = new Date(`${date}T00:00:00`);
    return `${value.getMonth() + 1}/${value.getDate()}/${String(value.getFullYear()).slice(2)}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <SectionTitle eyebrow="IT Admin" title="Students checklist" sub="Teacher/group roster with parent contacts and attendance history like the source sheet." />
        <div className="rounded-xl border border-line bg-white px-4 py-3 text-sm font-semibold text-ink shadow-sm">
          {sorted.length} of {students.length} students
        </div>
      </div>

      <div className="grid gap-3 rounded-xl border border-line bg-white p-4 shadow-sm lg:grid-cols-[1fr_190px_190px]">
        <label className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/35" size={17} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search student, parent, phone, address"
            className="w-full rounded-lg border border-line bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-gold-500"
          />
        </label>
        <label className="relative">
          <Filter className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/35" size={16} />
          <select
            value={teacherFilter}
            onChange={(e) => handleTeacherFilter(e.target.value)}
            className="w-full rounded-lg border border-line bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-gold-500"
          >
            <option>All teachers</option>
            {teachers.map((teacher) => (
              <option key={teacher}>{teacher}</option>
            ))}
          </select>
        </label>
        <select
          value={groupFilter}
          onChange={(e) => setGroupFilter(e.target.value)}
          className="w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-gold-500"
        >
          <option>All groups</option>
          {groupOptions.map((group) => (
            <option key={group}>{group}</option>
          ))}
        </select>
      </div>

      <div className="grid gap-3 md:hidden">
        {sorted.map((student) => (
          <div key={student.id} className="rounded-xl border border-line bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-ink">{student.name}</p>
                <p className="mt-1 text-xs text-ink/45">Age {student.age} · {student.address}</p>
              </div>
              <StatusPill status={student.status} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-cream px-3 py-2">
                <p className="text-xs font-semibold uppercase text-ink/35">Group</p>
                <p className="mt-1 font-semibold text-ink">{student.klass}</p>
              </div>
              <div className="rounded-lg bg-cream px-3 py-2">
                <p className="text-xs font-semibold uppercase text-ink/35">Teacher</p>
                <p className="mt-1 font-semibold text-ink">{student.teacher}</p>
              </div>
              <div className="rounded-lg bg-cream px-3 py-2">
                <p className="text-xs font-semibold uppercase text-ink/35">Attendance</p>
                <div className="mt-1"><AttendancePill status={student.attendance} /></div>
              </div>
              <div className="rounded-lg bg-cream px-3 py-2">
                <p className="text-xs font-semibold uppercase text-ink/35">Tuition</p>
                <div className="mt-1"><PaymentPill status={student.tuitionStatus} /></div>
              </div>
            </div>
            <div className="mt-4 border-t border-line pt-3">
              <p className="text-sm font-medium text-ink/75">{student.parentName}</p>
              <p className="mt-0.5 text-xs text-ink/45">{student.parentPhone}</p>
            </div>
          </div>
        ))}
        {sorted.length === 0 && (
          <div className="rounded-xl border border-line bg-white p-8 text-center text-sm text-ink/40">
            No students match these filters.
          </div>
        )}
      </div>

      <div className="hidden overflow-x-auto rounded-xl border border-line bg-white shadow-sm md:block">
        <table className="min-w-[1320px] w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line bg-green-900 text-xs uppercase tracking-wide text-cream/80">
              <th className="px-5 py-3 font-semibold">#</th>
              <th className="px-5 py-3 font-semibold">Teacher</th>
              <th className="px-5 py-3 font-semibold">Group</th>
              <th className="px-5 py-3 font-semibold">Student</th>
              <th className="px-5 py-3 font-semibold">Parent</th>
              <th className="px-5 py-3 font-semibold">Phone</th>
              {attendanceDates.map((date) => (
                <th key={date} className="px-3 py-3 text-center font-semibold">{dateLabel(date)}</th>
              ))}
              <th className="px-5 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((s) => (
              <tr key={s.id} className="border-b border-line last:border-0 transition-colors odd:bg-sky-50/55 even:bg-emerald-50/45 hover:bg-gold-300/20">
                <td className="px-5 py-3.5 text-ink/40">{s.rank}</td>
                <td className="px-5 py-3.5 font-medium text-ink/70">{s.teacher}</td>
                <td className="px-5 py-3.5 text-ink/60">{s.klass}</td>
                <td className="px-5 py-3.5">
                  <p className="font-medium text-ink">{s.name}</p>
                  <p className="text-xs text-ink/45">Age {s.age} · {s.address}</p>
                </td>
                <td className="px-5 py-3.5">
                  <p className="font-medium text-ink/75">{s.parentName}</p>
                </td>
                <td className="px-5 py-3.5 text-ink/60">{s.parentPhone}</td>
                {attendanceDates.map((date) => {
                  const checked = attendanceMap.get(`${s.id}:${date}`) ?? false;
                  return (
                    <td key={date} className="px-3 py-3.5 text-center">
                      <button
                        type="button"
                        onClick={() => void updateAttendanceRecord(s.id, date, !checked)}
                        className={`inline-flex h-7 w-7 items-center justify-center rounded-md border ${
                          checked ? "border-green-800 bg-green-900 text-white" : "border-ink/35 bg-white text-transparent"
                        }`}
                        aria-label={`${checked ? "Mark absent" : "Mark present"} ${s.name} on ${date}`}
                      >
                        <CheckSquare size={16} />
                      </button>
                    </td>
                  );
                })}
                <td className="px-5 py-3.5">
                  <StatusPill status={s.status} />
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={7 + attendanceDates.length} className="px-5 py-10 text-center text-sm text-ink/40">
                  No students match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
