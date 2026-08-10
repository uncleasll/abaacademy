import { useMemo, useState } from "react";
import { FileCheck2, FileDown, Save, Search } from "lucide-react";
import { SectionTitle } from "../components/ui";
import { assessmentCalendar, type AssessmentRecord, type QuarterKey } from "../data/mockData";
import { useAcademy } from "../data/academyStore";

const scoreFields: { key: keyof Omit<AssessmentRecord, "studentId" | "quarter" | "note">; label: string }[] = [
  { key: "islamicStudies", label: "Islamic Studies" },
  { key: "quranReading", label: "Qur'an Reading" },
  { key: "tajweed", label: "Tajweed" },
  { key: "memorization", label: "Memorization" },
  { key: "practical", label: "Practical" },
];

const emptyScores = {
  islamicStudies: 0,
  quranReading: 0,
  tajweed: 0,
  memorization: 0,
  practical: 0,
  note: "",
};

const quickScores = [0, 60, 75, 85, 100];

function csvCell(value: string | number) {
  const text = String(value);
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function AssessmentsPage() {
  const { assessmentRecords, classGroups, students, updateAssessmentRecord, user } = useAcademy();
  const teacherName = user?.name.split(" ")[0] ?? "";
  const teacherStudents = students.filter((student) => student.teacher === teacherName);
  const teacherGroups = classGroups.filter((group) => group.teacher === teacherName);
  const [quarter, setQuarter] = useState<QuarterKey>("Q1");
  const [groupFilter, setGroupFilter] = useState("All groups");
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("Quarterly assessment workspace is ready.");

  const recordsByStudent = useMemo(() => {
    const map = new Map<string, AssessmentRecord>();
    assessmentRecords
      .filter((record) => record.quarter === quarter)
      .forEach((record) => map.set(record.studentId, record));
    return map;
  }, [assessmentRecords, quarter]);

  const rows = teacherStudents.filter((student) => {
    const matchesGroup = groupFilter === "All groups" || student.klass === groupFilter;
    const matchesQuery = `${student.name} ${student.parentName} ${student.klass}`.toLowerCase().includes(query.toLowerCase());
    return matchesGroup && matchesQuery;
  });

  const activeCalendar = assessmentCalendar.find((item) => item.key === quarter) ?? assessmentCalendar[0];
  const completed = rows.filter((student) => recordsByStudent.has(student.id)).length;
  const average = useMemo(() => {
    const all = rows
      .map((student) => recordsByStudent.get(student.id))
      .filter(Boolean)
      .map((record) => Math.round((record!.islamicStudies + record!.quranReading + record!.tajweed + record!.memorization + record!.practical) / 5));
    if (!all.length) return 0;
    return Math.round(all.reduce((sum, value) => sum + value, 0) / all.length);
  }, [recordsByStudent, rows]);

  const saveScore = (studentId: string, patch: Partial<AssessmentRecord>) => {
    const scorePatch = Object.entries(patch).find(([key, value]) => key !== "note" && typeof value === "number");
    if (scorePatch && ((scorePatch[1] as number) < 0 || (scorePatch[1] as number) > 100)) {
      setNotice("Scores must be between 0 and 100.");
      return;
    }
    const current = recordsByStudent.get(studentId) ?? { studentId, quarter, ...emptyScores };
    const next = { ...current, ...patch, quarter };
    void updateAssessmentRecord(next);
    setNotice(`${quarter} assessment saved.`);
  };

  const saveScoreValue = (
    studentId: string,
    key: keyof Omit<AssessmentRecord, "studentId" | "quarter" | "note">,
    value: string,
  ) => {
    if (value === "") return;
    saveScore(studentId, { [key]: Number(value) });
  };

  const exportAssessments = () => {
    const exportRows = rows.map((student) => {
      const record = recordsByStudent.get(student.id) ?? { studentId: student.id, quarter, ...emptyScores };
      const rowAverage = Math.round((record.islamicStudies + record.quranReading + record.tajweed + record.memorization + record.practical) / 5);
      return [
        student.name,
        student.klass,
        student.parentName,
        activeCalendar.label,
        activeCalendar.window,
        record.islamicStudies,
        record.quranReading,
        record.tajweed,
        record.memorization,
        record.practical,
        `${rowAverage}%`,
        record.note,
        rowAverage >= 75 ? "Proficient" : "Needs review",
      ];
    });
    const safeGroup = groupFilter === "All groups" ? "all-groups" : groupFilter.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    downloadCsv(`quarterly-assessments-${quarter.toLowerCase()}-${safeGroup}.csv`, [
      [
        "Student",
        "Group",
        "Parent",
        "Quarter",
        "Assessment Window",
        "Islamic Studies",
        "Qur'an Reading",
        "Tajweed",
        "Memorization",
        "Practical",
        "Average",
        "Teacher Note",
        "Status",
      ],
      ...exportRows,
    ]);
    setNotice(`${rows.length} ${rows.length === 1 ? "row" : "rows"} exported for ${activeCalendar.label}.`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <SectionTitle
          eyebrow="Handbook"
          title="Quarterly assessments"
          sub="Track Qur'an, tajweed, memorization, Islamic Studies, and practical assessment results from the 2026-2027 curriculum handbook."
        />
        <div className="rounded-xl border border-line bg-white px-4 py-3 text-sm font-semibold text-ink shadow-sm">
          {activeCalendar.label} · {activeCalendar.window}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-green-800 bg-green-900 p-4 text-cream shadow-sm">
          <p className="text-xs font-semibold uppercase text-gold-300">Assessment Window</p>
          <p className="mt-2 text-xl font-semibold">{activeCalendar.window}</p>
          <p className="mt-2 text-xs text-cream/65">{activeCalendar.months}</p>
        </div>
        <div className="rounded-xl border border-line bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase text-ink/45">Completed</p>
          <p className="mt-2 text-2xl font-semibold text-ink">{completed}/{rows.length}</p>
          <p className="mt-2 text-xs text-ink/50">Ready for report cards</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950 shadow-sm">
          <p className="text-xs font-semibold uppercase text-amber-700/70">Average</p>
          <p className="mt-2 text-2xl font-semibold">{average}%</p>
          <p className="mt-2 text-xs text-amber-900/55">Proficient target is 75%</p>
        </div>
      </div>

      <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">{notice}</div>

      <section className="rounded-xl border border-line bg-white shadow-sm">
        <div className="grid gap-3 border-b border-line p-4 lg:grid-cols-[180px_210px_1fr_auto]">
          <select
            value={quarter}
            onChange={(event) => setQuarter(event.target.value as QuarterKey)}
            className="rounded-lg border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-gold-500"
          >
            {assessmentCalendar.map((item) => (
              <option key={item.key} value={item.key}>{item.label}</option>
            ))}
          </select>
          <select
            value={groupFilter}
            onChange={(event) => setGroupFilter(event.target.value)}
            className="rounded-lg border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-gold-500"
          >
            <option>All groups</option>
            {teacherGroups.map((group) => (
              <option key={group.id}>{group.name}</option>
            ))}
          </select>
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/35" size={17} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search student, parent, group"
              className="w-full rounded-lg border border-line bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-gold-500"
            />
          </label>
          <button
            type="button"
            onClick={exportAssessments}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-green-800 bg-green-900 px-4 py-2.5 text-sm font-semibold text-cream shadow-sm transition hover:bg-green-800"
          >
            <FileDown size={17} />
            Export Excel
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1440px] w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line bg-green-900 text-xs uppercase text-cream/80">
                <th className="px-5 py-3 font-semibold">Student</th>
                {scoreFields.map((field) => (
                  <th key={field.key} className="px-3 py-3 font-semibold">{field.label}</th>
                ))}
                <th className="px-3 py-3 font-semibold">Average</th>
                <th className="px-5 py-3 font-semibold">Teacher note</th>
                <th className="px-5 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((student) => {
                const record = recordsByStudent.get(student.id) ?? { studentId: student.id, quarter, ...emptyScores };
                const rowAverage = Math.round((record.islamicStudies + record.quranReading + record.tajweed + record.memorization + record.practical) / 5);
                return (
                  <tr key={student.id} className="border-b border-line last:border-0 hover:bg-cream/50">
                    <td className="px-5 py-4">
                      <p className="font-semibold text-ink">{student.name}</p>
                      <p className="mt-1 text-xs text-ink/45">{student.klass} · {student.parentName}</p>
                    </td>
                    {scoreFields.map((field) => (
                      <td key={field.key} className="px-3 py-4 align-top">
                        <div className="flex w-28 overflow-hidden rounded-lg border border-line bg-white focus-within:border-gold-500 focus-within:ring-2 focus-within:ring-gold-500/25">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            inputMode="numeric"
                            value={record[field.key]}
                            onFocus={(event) => event.currentTarget.select()}
                            onChange={(event) => saveScoreValue(student.id, field.key, event.target.value)}
                            className="score-input min-h-10 w-14 border-0 bg-white px-2 text-center text-base font-semibold outline-none"
                          />
                          <select
                            aria-label={`${field.label} quick score for ${student.name}`}
                            value={record[field.key]}
                            onChange={(event) => saveScore(student.id, { [field.key]: Number(event.target.value) })}
                            className="min-h-10 w-14 border-0 border-l border-line bg-cream px-1 text-xs font-semibold text-ink/70 outline-none"
                          >
                            {!quickScores.includes(record[field.key]) && <option value={record[field.key]}>{record[field.key]}</option>}
                            {quickScores.map((score) => (
                              <option key={score} value={score}>{score}</option>
                            ))}
                          </select>
                        </div>
                      </td>
                    ))}
                    <td className="px-3 py-4">
                      <span className={rowAverage >= 75 ? "font-bold text-emerald-700" : "font-bold text-red-600"}>
                        {rowAverage}%
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <input
                        value={record.note}
                        onChange={(event) => saveScore(student.id, { note: event.target.value })}
                        placeholder="Quarterly note for report card"
                        className="w-full min-w-72 rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-gold-500"
                      />
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${rowAverage >= 75 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
                        <FileCheck2 size={13} />
                        {rowAverage >= 75 ? "Proficient" : "Needs review"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex items-center gap-2 border-t border-line px-5 py-3 text-xs font-semibold text-ink/45">
          <Save size={14} />
          Scores save immediately and feed quarterly report cards.
        </div>
      </section>
    </div>
  );
}
