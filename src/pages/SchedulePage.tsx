import { useEffect, useState, type FormEvent } from "react";
import { CalendarDays, Clock, Save, Users } from "lucide-react";
import { SectionTitle } from "../components/ui";
import { useAcademy, type ScheduleBlock } from "../data/academyStore";

const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

type WeekDay = (typeof days)[number];
type ClassScheduleBlock = ScheduleBlock;

const scheduleColors = [
  "bg-sky-200 text-sky-950 border-sky-300",
  "bg-emerald-200 text-emerald-950 border-emerald-300",
  "bg-amber-200 text-amber-950 border-amber-300",
  "bg-orange-200 text-orange-950 border-orange-300",
  "bg-violet-200 text-violet-950 border-violet-300",
  "bg-rose-200 text-rose-950 border-rose-300",
];

// Earlier versions kept the schedule in this browser only; it is offered once for saving to the server.
const LEGACY_SCHEDULE_KEY = "aba_registration_weekly_schedule";

function readLegacySchedule(): ClassScheduleBlock[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(LEGACY_SCHEDULE_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.map((block) => ({
      id: String(block.id), group: String(block.group), teacher: String(block.teacher), day: block.day as WeekDay,
      start: String(block.start), end: String(block.end), color: String(block.color ?? ""),
    }));
  } catch {
    return [];
  }
}

function timeToMinutes(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function displayTime(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  const suffix = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${suffix}`;
}

function blocksOverlap(a: ClassScheduleBlock, b: ClassScheduleBlock) {
  if (a.id === b.id || a.teacher !== b.teacher || a.day !== b.day) return false;
  return timeToMinutes(a.start) < timeToMinutes(b.end) && timeToMinutes(a.end) > timeToMinutes(b.start);
}

function ScheduleMetric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-lg border border-line bg-white p-3 shadow-sm">
      <p className="text-xs font-semibold uppercase text-ink/45">{label}</p>
      <div className="mt-2 flex items-end justify-between gap-3">
        <p className="text-2xl font-semibold text-ink">{value}</p>
        <p className="pb-1 text-right text-xs text-ink/50">{detail}</p>
      </div>
    </div>
  );
}

export function SchedulePage() {
  const { classGroups, saveSchedule: persistSchedule, weeklySchedule } = useAcademy();
  const [classSchedule, setClassSchedule] = useState<ClassScheduleBlock[]>(weeklySchedule);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState(weeklySchedule[0]?.id ?? "");
  const [notice, setNotice] = useState("The weekly schedule is shared with all staff. Select a class to edit it.");

  useEffect(() => {
    if (dirty) return;
    if (!weeklySchedule.length) {
      const legacy = readLegacySchedule();
      if (legacy.length) {
        setClassSchedule(legacy);
        setDirty(true);
        setNotice("This schedule was only stored on this device. Review it and press Save schedule to share it with all staff.");
        return;
      }
    }
    setClassSchedule(weeklySchedule);
  }, [weeklySchedule, dirty]);

  const seats = (group: string) => classGroups.find((item) => item.name === group)?.enrolled ?? 0;
  const edit = (change: (prev: ClassScheduleBlock[]) => ClassScheduleBlock[]) => {
    setClassSchedule(change);
    setDirty(true);
  };

  const editingBlock = classSchedule.find((block) => block.id === editingId) ?? classSchedule[0];
  const teacherCount = new Set(classSchedule.map((block) => block.teacher)).size;
  const weeklyHours = classSchedule.reduce((sum, block) => sum + (timeToMinutes(block.end) - timeToMinutes(block.start)) / 60, 0);
  const studentSeats = Array.from(new Set(classSchedule.map((block) => block.group))).reduce((sum, group) => sum + seats(group), 0);
  const teachers = Array.from(new Set(classSchedule.map((block) => block.teacher))).sort();
  const scheduleByDay = days.map((day) => ({
    day,
    blocks: classSchedule
      .filter((block) => block.day === day)
      .sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start)),
  }));
  const scheduleByTeacher = teachers.map((teacher) => ({
    teacher,
    blocks: classSchedule.filter((block) => block.teacher === teacher),
  }));
  const conflictIds = new Set(
    classSchedule
      .filter((block) => classSchedule.some((other) => blocksOverlap(block, other)))
      .map((block) => block.id)
  );
  const updateBlock = (patch: Partial<ClassScheduleBlock>) => {
    if (!editingBlock) return;
    edit((prev) => prev.map((block) => (block.id === editingBlock.id ? { ...block, ...patch } : block)));
  };

  const addBlock = () => {
    const nextColor = scheduleColors[classSchedule.length % scheduleColors.length];
    const next: ClassScheduleBlock = {
      id: `schedule-${Date.now()}`,
      group: classGroups[0]?.name ?? "",
      teacher: classGroups[0]?.teacher ?? "",
      day: "Monday",
      start: "17:00",
      end: "19:00",
      color: nextColor,
    };
    if (!next.group) {
      setNotice("Create a group in Groups & Placement first, then add it to the schedule.");
      return;
    }
    edit((prev) => [...prev, next]);
    setEditingId(next.id);
    setNotice("New class added. Set its group and time, then press Save schedule.");
  };

  const deleteBlock = () => {
    if (!editingBlock) return;
    edit((prev) => prev.filter((block) => block.id !== editingBlock.id));
    setEditingId(classSchedule.find((block) => block.id !== editingBlock.id)?.id ?? "");
    setNotice(`${editingBlock.group} class removed. Press Save schedule to apply.`);
  };

  const saveSchedule = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    const invalid = classSchedule.find((block) => timeToMinutes(block.end) <= timeToMinutes(block.start));
    if (invalid) {
      setEditingId(invalid.id);
      setNotice(`${invalid.group} on ${invalid.day}: end time must be after start time.`);
      return;
    }
    const clash = classSchedule.find((block) => conflictIds.has(block.id));
    if (clash) {
      const other = classSchedule.find((block) => blocksOverlap(clash, block))!;
      setEditingId(clash.id);
      setNotice(`Conflict: ${clash.teacher} already has ${other.group} on ${other.day} from ${displayTime(other.start)} to ${displayTime(other.end)}.`);
      return;
    }
    setBusy(true);
    try {
      await persistSchedule(classSchedule);
      localStorage.removeItem(LEGACY_SCHEDULE_KEY);
      setDirty(false);
      setNotice("Weekly schedule saved for all staff.");
    } catch (error) {
      setNotice(`Schedule was not saved: ${error instanceof Error ? error.message : "connection error"}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-line bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <SectionTitle
            eyebrow="Registration"
            title="Weekly schedule"
            sub="Teacher availability and class blocks for the current weekly program."
          />
          <button
            type="button"
            onClick={addBlock}
            className="inline-flex items-center justify-center rounded-lg bg-green-900 px-4 py-2.5 text-sm font-semibold text-cream hover:bg-green-800"
          >
            Add class
          </button>
        </div>
      </section>

      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-green-800 bg-green-900 p-3 text-cream shadow-sm">
          <p className="text-xs font-semibold uppercase text-gold-300">Weekly classes</p>
          <div className="mt-2 flex items-end justify-between gap-3">
            <p className="text-2xl font-semibold">{classSchedule.length}</p>
            <p className="pb-1 text-right text-xs text-cream/65">Active blocks</p>
          </div>
        </div>
        <ScheduleMetric label="Teachers" value={String(teacherCount)} detail="With active weekly blocks" />
        <ScheduleMetric label="Class hours" value={`${weeklyHours}`} detail="Scheduled each week" />
        <ScheduleMetric label="Student seats" value={String(studentSeats)} detail="Across all blocks" />
      </div>

      <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">{notice}</div>
      <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-lg border border-line bg-white shadow-sm">
          <div className="border-b border-line px-5 py-4">
            <h3 className="text-lg font-bold text-ink">Teacher week view</h3>
            <p className="mt-0.5 text-sm text-ink/45">Rows are teachers. Columns are class days. Select a block to edit it.</p>
          </div>

          <div className="hidden p-4 xl:block">
            <div className="grid grid-cols-[190px_repeat(7,minmax(0,1fr))] overflow-hidden rounded-lg border border-line">
              <div className="border-b border-r border-line bg-green-900 px-3 py-3 text-xs font-bold uppercase text-cream">
                Teacher
              </div>
              {days.map((day) => (
                <div key={day} className="border-b border-r border-line bg-green-900 px-3 py-3 text-center text-xs font-bold uppercase text-cream last:border-r-0">
                  {day.slice(0, 3)}
                </div>
              ))}

              {scheduleByTeacher.map(({ teacher, blocks }) => {
                const teacherHours = blocks.reduce((sum, block) => sum + (timeToMinutes(block.end) - timeToMinutes(block.start)) / 60, 0);
                const teacherStudents = Array.from(new Set(blocks.map((block) => block.group))).reduce((sum, group) => sum + seats(group), 0);
                return (
                  <div key={teacher} className="contents">
                    <div className="border-r border-t border-line bg-white px-3 py-3">
                      <p className="truncate text-sm font-bold text-ink">{teacher}</p>
                      <p className="mt-1 text-xs font-semibold text-ink/45">{teacherHours}h weekly · {teacherStudents} students</p>
                    </div>
                    {days.map((day) => {
                      const dayBlocks = blocks
                        .filter((block) => block.day === day)
                        .sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
                      return (
                        <div key={`${teacher}-${day}`} className="min-h-28 space-y-2 border-r border-t border-line bg-cream/30 p-2 last:border-r-0">
                          {dayBlocks.map((block) => (
                            <button
                              key={block.id}
                              type="button"
                              onClick={() => setEditingId(block.id)}
                              className={`group relative w-full rounded-md border px-2.5 py-2 text-left shadow-sm transition ${block.color} ${
                                editingId === block.id ? "ring-2 ring-green-900" : ""
                              } ${
                                conflictIds.has(block.id) ? "border-red-500 bg-red-50 text-red-950 ring-2 ring-red-400" : ""
                              }`}
                              title={`${block.group} ${displayTime(block.start)}-${displayTime(block.end)}`}
                            >
                              <span className="block truncate text-xs font-bold">{displayTime(block.start)}-{displayTime(block.end)}</span>
                              <span className="mt-1 block truncate text-xs font-semibold opacity-80">{block.group}</span>
                              {conflictIds.has(block.id) && <span className="mt-1 block text-[10px] font-bold text-red-700">Conflict</span>}
                              <span className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 w-64 -translate-x-1/2 rounded-lg border border-line bg-white p-3 text-left text-xs text-ink opacity-0 shadow-xl transition group-hover:opacity-100">
                                <span className="block font-bold">{block.group}</span>
                                <span className="mt-1 block font-semibold text-ink/60">{block.teacher}</span>
                                <span className="mt-2 block font-semibold">{day}, {displayTime(block.start)} to {displayTime(block.end)}</span>
                                <span className="mt-1 block font-semibold text-ink/55">{seats(block.group)} students</span>
                              </span>
                            </button>
                          ))}
                          {dayBlocks.length === 0 && <div className="h-8 rounded-md border border-dashed border-line bg-white/50" />}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid gap-3 p-4 xl:hidden">
            {scheduleByDay.map(({ day, blocks }) => (
              <div key={day} className="rounded-lg border border-line bg-cream/45">
                <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-3">
                  <div>
                    <p className="text-sm font-bold text-ink">{day}</p>
                    <p className="mt-0.5 text-xs font-semibold text-ink/40">{blocks.length} classes</p>
                  </div>
                  <CalendarDays size={16} className="text-ink/35" />
                </div>
                <div className="grid gap-2 p-3 sm:grid-cols-2">
                  {blocks.map((block) => (
                      <button
                        key={block.id}
                        type="button"
                        onClick={() => setEditingId(block.id)}
                        className={`group relative rounded-lg border p-3 text-left shadow-sm transition ${block.color} ${
                          editingId === block.id ? "ring-2 ring-green-900" : ""
                        } ${
                          conflictIds.has(block.id) ? "border-red-500 bg-red-50 text-red-950 ring-2 ring-red-400" : ""
                        }`}
                        title={`${block.teacher} ${displayTime(block.start)}-${displayTime(block.end)}`}
                      >
                      <span className="flex items-center gap-1.5 text-xs font-bold">
                        <Clock size={13} /> {displayTime(block.start)} - {displayTime(block.end)}
                      </span>
                      <span className="mt-2 block truncate text-sm font-bold">{block.group}</span>
                      <span className="mt-0.5 block truncate text-xs font-semibold opacity-80">{block.teacher}</span>
                      {conflictIds.has(block.id) && <span className="mt-2 block text-[11px] font-bold text-red-700">Schedule conflict</span>}
                      <span className="mt-2 inline-flex items-center gap-1 rounded-md bg-white/55 px-2 py-1 text-[11px] font-bold">
                        <Users size={12} /> {seats(block.group)}
                      </span>
                      <span className="pointer-events-none absolute left-3 right-3 top-full z-30 mt-2 rounded-lg border border-line bg-white p-3 text-left text-xs text-ink opacity-0 shadow-xl transition group-hover:opacity-100">
                        <span className="block font-bold">{block.group}</span>
                        <span className="mt-1 block font-semibold text-ink/60">{block.teacher}</span>
                        <span className="mt-2 block font-semibold">{block.day}, {displayTime(block.start)} to {displayTime(block.end)}</span>
                        <span className="mt-1 block font-semibold text-ink/55">{seats(block.group)} students</span>
                      </span>
                      </button>
                  ))}
                  {blocks.length === 0 && (
                    <p className="rounded-lg border border-dashed border-line bg-white/60 px-3 py-8 text-center text-xs font-semibold text-ink/35">
                      No classes
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-line bg-white p-5 shadow-sm 2xl:sticky 2xl:top-5 2xl:self-start">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-ink">Edit class</h3>
              <p className="mt-0.5 text-sm text-ink/45">{dirty ? "Unsaved changes. Press Save schedule to share them." : "Saved for all staff."}</p>
            </div>
            <button
              type="button"
              onClick={addBlock}
              className="rounded-lg border border-line px-3 py-2 text-xs font-semibold text-ink/60 hover:border-gold-500 hover:text-gold-600"
            >
              Add
            </button>
          </div>

          {editingBlock ? (
            <form onSubmit={saveSchedule} className="mt-4 space-y-3">
              <label className="space-y-1.5 text-xs font-semibold text-ink/55">
                Schedule block
                <select
                  value={editingId}
                  onChange={(event) => setEditingId(event.target.value)}
                  className="w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:border-gold-500"
                >
                  {classSchedule.map((block) => (
                    <option key={block.id} value={block.id}>
                      {block.group} · {block.day} · {displayTime(block.start)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <label className="space-y-1.5 text-xs font-semibold text-ink/55">
                  Group
                  <select
                    value={editingBlock.group}
                    onChange={(event) => {
                      const group = classGroups.find((item) => item.name === event.target.value);
                      updateBlock({ group: event.target.value, teacher: group?.teacher ?? editingBlock.teacher });
                    }}
                    className="w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-gold-500"
                  >
                    {!classGroups.some((group) => group.name === editingBlock.group) && <option>{editingBlock.group}</option>}
                    {classGroups.map((group) => (
                      <option key={group.id}>{group.name}</option>
                    ))}
                  </select>
                </label>
                <div className="space-y-1.5 text-xs font-semibold text-ink/55">
                  Teacher
                  <p className="rounded-lg border border-line bg-cream/45 px-3 py-2.5 text-sm font-medium text-ink">{editingBlock.teacher}</p>
                </div>
              </div>
              <label className="space-y-1.5 text-xs font-semibold text-ink/55">
                Day
                <select value={editingBlock.day} onChange={(event) => updateBlock({ day: event.target.value as WeekDay })} className="w-full rounded-lg border border-line px-3 py-2.5 text-sm outline-none focus:border-gold-500">
                  {days.map((day) => (
                    <option key={day}>{day}</option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1.5 text-xs font-semibold text-ink/55">
                  Start
                  <input type="time" value={editingBlock.start} onChange={(event) => updateBlock({ start: event.target.value })} className="w-full rounded-lg border border-line px-3 py-2.5 text-sm outline-none focus:border-gold-500" />
                </label>
                <label className="space-y-1.5 text-xs font-semibold text-ink/55">
                  End
                  <input type="time" value={editingBlock.end} onChange={(event) => updateBlock({ end: event.target.value })} className="w-full rounded-lg border border-line px-3 py-2.5 text-sm outline-none focus:border-gold-500" />
                </label>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {scheduleColors.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => updateBlock({ color })}
                    className={`h-9 rounded-lg border ${color} ${editingBlock.color === color ? "ring-2 ring-green-900" : ""}`}
                    aria-label="Choose schedule color"
                  />
                ))}
              </div>
              <div className="flex gap-2">
                <button disabled={busy || !dirty} className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-900 px-4 py-2.5 text-sm font-semibold text-cream hover:bg-green-800 disabled:opacity-50">
                  <Save size={15} /> {busy ? "Saving…" : dirty ? "Save schedule" : "Saved"}
                </button>
                <button type="button" onClick={deleteBlock} className="rounded-lg border border-red-200 px-3 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50">
                  Delete
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={saveSchedule} className="mt-4 space-y-3">
              <p className="rounded-lg border border-line bg-cream/45 p-4 text-sm text-ink/45">No classes yet. Press Add to create the first one.</p>
              {dirty && (
                <button disabled={busy} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-green-900 px-4 py-2.5 text-sm font-semibold text-cream hover:bg-green-800 disabled:opacity-50">
                  <Save size={15} /> {busy ? "Saving…" : "Save schedule"}
                </button>
              )}
            </form>
          )}
        </section>
      </div>

    </div>
  );
}
