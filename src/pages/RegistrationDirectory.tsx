import { useMemo, useState } from "react";
import { GraduationCap, Search, Users } from "lucide-react";
import { SectionTitle, PaymentPill, StatusPill } from "../components/ui";
import { useAcademy } from "../data/academyStore";

type RiskFilter = "all" | "new" | "low-attendance" | "tuition" | "attention";

const riskOptions: { value: RiskFilter; label: string }[] = [
  { value: "all", label: "All students" },
  { value: "new", label: "New students" },
  { value: "low-attendance", label: "Low attendance" },
  { value: "tuition", label: "Tuition issue" },
  { value: "attention", label: "Needs attention" },
];

function formatDate(value?: string) {
  if (!value) return "Existing student";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function RegistrationDirectory() {
  const { students, staffUsers, classGroups } = useAcademy();
  const [query, setQuery] = useState("");
  const [teacherFilter, setTeacherFilter] = useState("all");
  const [groupFilter, setGroupFilter] = useState("all");
  const [riskFilter, setRiskFilter] = useState<RiskFilter>("all");
  const notice = "Teacher access is limited to the five approved academy teachers.";

  const teachers = useMemo(
    () => staffUsers.filter((user) => user.role === "Teacher").sort((a, b) => a.name.localeCompare(b.name)),
    [staffUsers]
  );

  const teacherNames = useMemo(() => {
    const names = new Set<string>();
    teachers.forEach((teacher) => names.add(teacher.name.split(" ")[0]));
    students.forEach((student) => names.add(student.teacher));
    classGroups.forEach((group) => names.add(group.teacher));
    return Array.from(names).filter(Boolean).sort((a, b) => a.localeCompare(b));
  }, [classGroups, students, teachers]);

  const groupNames = useMemo(
    () => Array.from(new Set([...classGroups.map((group) => group.name), ...students.map((student) => student.klass)]))
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b)),
    [classGroups, students]
  );

  const filteredStudents = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return students
      .filter((student) => {
        const matchesQuery =
          !normalizedQuery ||
          `${student.name} ${student.parentName} ${student.parentPhone} ${student.klass} ${student.teacher}`
            .toLowerCase()
            .includes(normalizedQuery);
        const matchesTeacher = teacherFilter === "all" || student.teacher === teacherFilter;
        const matchesGroup = groupFilter === "all" || student.klass === groupFilter;
        const matchesRisk =
          riskFilter === "all" ||
          (riskFilter === "new" && Boolean(student.joinedDate)) ||
          (riskFilter === "low-attendance" && student.attendancePct < 85) ||
          (riskFilter === "tuition" && student.tuitionStatus !== "paid") ||
          (riskFilter === "attention" && student.status === "Needs Attention");
        return matchesQuery && matchesTeacher && matchesGroup && matchesRisk;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [groupFilter, query, riskFilter, students, teacherFilter]);

  const riskCount = students.filter(
    (student) => student.attendancePct < 85 || student.tuitionStatus !== "paid" || student.status === "Needs Attention"
  ).length;

  return (
    <div className="min-w-0 space-y-5">
      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,520px)] xl:items-end">
        <SectionTitle
          eyebrow="Registration"
          title="Directory"
          sub="Manage teacher access and find every enrolled student without leaving registration."
        />
        <div className="grid min-w-0 gap-2 sm:grid-cols-3">
          <div className="rounded-lg border border-line bg-white px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink/45">Teachers</p>
            <p className="mt-1 text-2xl font-semibold text-ink">{teachers.length}</p>
          </div>
          <div className="rounded-lg border border-line bg-white px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink/45">Students</p>
            <p className="mt-1 text-2xl font-semibold text-ink">{students.length}</p>
          </div>
          <div className="rounded-lg border border-line bg-white px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink/45">Needs review</p>
            <p className="mt-1 text-2xl font-semibold text-red-600">{riskCount}</p>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-medium text-sky-900">
        {notice}
      </div>

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
        <section className="min-w-0 rounded-lg border border-line bg-white shadow-sm">
          <div className="border-b border-line px-4 py-4">
            <div className="flex items-center gap-2">
              <Users size={18} className="text-green-800" />
              <h3 className="text-lg font-semibold text-ink">Teacher roster</h3>
            </div>
            <p className="mt-1 text-sm text-ink/50">Approved teacher accounts and their assigned students.</p>
          </div>

          <div className="max-h-[540px] divide-y divide-line overflow-y-auto">
            {teachers.map((teacher) => {
              const assigned = students.filter((student) => student.teacher === teacher.name.split(" ")[0]).length;
              return (
                <div key={teacher.id} className="flex min-w-0 items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">{teacher.name}</p>
                    <p className="truncate text-xs text-ink/45">{teacher.email}</p>
                    <p className="mt-1 text-xs font-semibold text-ink/50">{assigned} assigned students</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="min-w-0 rounded-lg border border-line bg-white shadow-sm">
          <div className="border-b border-line px-4 py-4">
            <div className="flex items-center gap-2">
              <GraduationCap size={18} className="text-green-800" />
              <h3 className="text-lg font-semibold text-ink">Student directory</h3>
            </div>
            <p className="mt-1 text-sm text-ink/50">Search all enrolled students and filter by teacher, group, or risk.</p>
          </div>

          <div className="grid min-w-0 gap-3 border-b border-line p-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,150px)_minmax(0,150px)_minmax(0,160px)]">
            <label className="relative min-w-0">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink/35" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search student or parent"
                className="w-full rounded-lg border border-line py-2.5 pl-9 pr-3 text-sm outline-none focus:border-gold-500"
              />
            </label>
            <select
              value={teacherFilter}
              onChange={(event) => setTeacherFilter(event.target.value)}
              className="min-w-0 rounded-lg border border-line px-3 py-2.5 text-sm outline-none focus:border-gold-500"
            >
              <option value="all">All teachers</option>
              {teacherNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            <select
              value={groupFilter}
              onChange={(event) => setGroupFilter(event.target.value)}
              className="min-w-0 rounded-lg border border-line px-3 py-2.5 text-sm outline-none focus:border-gold-500"
            >
              <option value="all">All groups</option>
              {groupNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            <select
              value={riskFilter}
              onChange={(event) => setRiskFilter(event.target.value as RiskFilter)}
              className="min-w-0 rounded-lg border border-line px-3 py-2.5 text-sm outline-none focus:border-gold-500"
            >
              {riskOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 text-sm">
            <p className="font-semibold text-ink">{filteredStudents.length} visible students</p>
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setTeacherFilter("all");
                setGroupFilter("all");
                setRiskFilter("all");
              }}
              className="rounded-lg border border-line px-3 py-2 text-xs font-semibold text-ink/60 hover:bg-cream"
            >
              Clear filters
            </button>
          </div>

          <div className="max-h-[640px] divide-y divide-line overflow-y-auto">
            {filteredStudents.map((student) => (
              <div key={student.id} className="grid min-w-0 gap-3 px-4 py-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,140px)_minmax(0,180px)_minmax(0,130px)] lg:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold text-ink">{student.name}</p>
                    {student.joinedDate && (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-bold text-green-800">
                        New
                      </span>
                    )}
                  </div>
                  <p className="mt-1 truncate text-xs text-ink/45">
                    {student.parentName} · {student.parentPhone}
                  </p>
                </div>
                <div className="min-w-0 text-sm">
                  <p className="truncate font-semibold text-ink">{student.klass}</p>
                  <p className="truncate text-xs text-ink/45">{student.teacher}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill status={student.status} />
                  <PaymentPill status={student.tuitionStatus} />
                </div>
                <div className="text-sm lg:text-right">
                  <p className={`font-semibold ${student.attendancePct < 85 ? "text-red-600" : "text-ink"}`}>
                    {student.attendancePct}% attendance
                  </p>
                  <p className="text-xs text-ink/45">{formatDate(student.joinedDate)}</p>
                </div>
              </div>
            ))}

            {filteredStudents.length === 0 && (
              <div className="px-4 py-10 text-center text-sm font-medium text-ink/45">
                No students match the selected filters.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
