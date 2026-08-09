import { useMemo, useState, type FormEvent } from "react";
import { ArrowRight, Clock3, Mail, Phone, Plus, Search, UserRoundPlus, UsersRound } from "lucide-react";
import { type Application, type AppStatus, classGroups as fallbackClassGroups } from "../data/mockData";
import { useAcademy } from "../data/academyStore";

const pipelineStages: { key: AppStatus; label: string; empty: string }[] = [
  { key: "pending", label: "New", empty: "No new families" },
  { key: "teacher_review", label: "Teacher Review", empty: "No teacher decisions pending" },
  { key: "accepted", label: "Accepted", empty: "No accepted applicants" },
];

const nextStatus: Partial<Record<AppStatus, AppStatus>> = {
  pending: "teacher_review",
  teacher_review: "accepted",
};

const actionLabel: Partial<Record<AppStatus, string>> = {
  pending: "Send to teacher review",
  teacher_review: "Mark accepted",
};

function pipelineStatus(status: AppStatus) {
  if (status === "assessment" || status === "interview") return "teacher_review";
  return status;
}

const emptyForm = {
  name: "",
  age: "8",
  parentName: "",
  parentSurname: "",
  email: "",
  phone: "",
  emergencyContact1Name: "",
  emergencyContact1Phone: "",
  emergencyContact1Relation: "",
  emergencyContact2Name: "",
  emergencyContact2Phone: "",
  emergencyContact2Relation: "",
  parentTelegram: "",
  address: "",
  program: fallbackClassGroups[0]?.program ?? "",
  teacher: fallbackClassGroups[0]?.teacher ?? "",
  klass: fallbackClassGroups[0]?.name ?? "",
};

function IntakeStat({
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
    <div className={`rounded-lg border p-3 shadow-sm ${styles[tone]}`}>
      <p className={`text-xs font-semibold uppercase ${tone === "dark" ? "text-gold-300" : "text-ink/45"}`}>
        {label}
      </p>
      <div className="mt-2 flex items-end justify-between gap-3">
        <p className="text-2xl font-semibold">{value}</p>
        <p className={`pb-1 text-right text-xs ${tone === "dark" ? "text-cream/65" : "text-ink/50"}`}>{detail}</p>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required = true,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="space-y-1.5 text-xs font-semibold text-ink/55">
      {label}
      <input
        required={required}
        type={type}
        min={type === "number" ? 3 : undefined}
        max={type === "number" ? 18 : undefined}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm font-medium text-ink outline-none placeholder:text-ink/25 focus:border-gold-500"
      />
    </label>
  );
}

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)})${digits.slice(3)}`;
  return `(${digits.slice(0, 3)})${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function ApplicantCard({
  app,
  onAdvance,
  onWaitlist,
  onReject,
}: {
  app: Application;
  onAdvance: (app: Application) => void;
  onWaitlist: (app: Application) => void;
  onReject: (app: Application) => void;
}) {
  const effectiveStatus = pipelineStatus(app.status);
  return (
    <article className="rounded-lg border border-line bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-snug text-ink">{app.name}</p>
          <p className="mt-1 text-xs leading-relaxed text-ink/45">Age {app.age} · {app.program}</p>
        </div>
      </div>
      <p className="mt-3 flex items-start gap-1.5 text-xs font-semibold leading-relaxed text-ink/60">
        <Phone className="mt-0.5 shrink-0" size={12} /> <span>{app.parentName} {app.parentSurname} · {app.phone}</span>
      </p>
      {app.email && (
        <p className="mt-1 flex items-start gap-1.5 text-xs font-semibold leading-relaxed text-ink/50">
          <Mail className="mt-0.5 shrink-0" size={12} /> <span className="break-all">{app.email}</span>
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] font-semibold text-ink/55">
        <span className="rounded-md bg-cream px-2 py-1">{app.teacher}</span>
        <span className="rounded-md bg-cream px-2 py-1">{app.klass}</span>
      </div>
      {effectiveStatus === "teacher_review" && (
        <p className="mt-3 rounded-md bg-amber-50 px-2.5 py-2 text-xs font-semibold text-amber-800">
          Waiting for teacher decision.
        </p>
      )}
      <div className="mt-3 grid gap-2">
        {nextStatus[effectiveStatus] ? (
          <button
            type="button"
            onClick={() => onAdvance(app)}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-green-900 px-3 py-2 text-xs font-semibold text-cream hover:bg-green-800"
          >
            {actionLabel[effectiveStatus]} <ArrowRight size={13} />
          </button>
        ) : null}
        {app.status !== "accepted" && app.status !== "rejected" && (
          <button
            type="button"
            onClick={() => onWaitlist(app)}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-amber-200 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-50"
          >
            <Clock3 size={13} /> Waitlist
          </button>
        )}
        {app.status !== "accepted" && app.status !== "rejected" && (
          <button
            type="button"
            onClick={() => onReject(app)}
            className="rounded-lg border border-line px-3 py-2 text-xs font-semibold text-red-600 hover:border-red-200 hover:bg-red-50"
          >
            Reject
          </button>
        )}
      </div>
    </article>
  );
}

export function ApplicationsPage() {
  const { applications: apps, classGroups, createApplication, students, updateApplicationStatus } = useAcademy();
  const [form, setForm] = useState(emptyForm);
  const [teacherFilter, setTeacherFilter] = useState("All teachers");
  const [groupFilter, setGroupFilter] = useState("All groups");
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("Admissions pipeline is ready.");

  const teachers = useMemo(() => Array.from(new Set(classGroups.map((group) => group.teacher))), [classGroups]);
  const groupOptions = useMemo(
    () => classGroups.filter((group) => group.teacher === form.teacher).map((group) => group.name),
    [classGroups, form.teacher]
  );
  const filteredGroupOptions = useMemo(() => {
    if (teacherFilter === "All teachers") return classGroups.map((group) => group.name);
    return classGroups.filter((group) => group.teacher === teacherFilter).map((group) => group.name);
  }, [classGroups, teacherFilter]);

  const visibleApps = apps.filter((app) => {
    const matchesTeacher = teacherFilter === "All teachers" || app.teacher === teacherFilter;
    const matchesGroup = groupFilter === "All groups" || app.klass === groupFilter;
    const matchesQuery = `${app.name} ${app.parentName} ${app.parentSurname} ${app.phone} ${app.address} ${app.klass}`
      .toLowerCase()
      .includes(query.toLowerCase());
    return matchesTeacher && matchesGroup && matchesQuery;
  });
  const rejectedApps = visibleApps.filter((app) => app.status === "rejected");
  const waitlistApps = visibleApps.filter((app) => app.status === "waitlist");
  const lookupMatches = students.filter((student) =>
    `${student.name} ${student.parentName} ${student.parentPhone} ${student.teacher} ${student.klass}`.toLowerCase().includes(query.toLowerCase())
  );
  const lookupRows = lookupMatches.slice(0, 12);
  const selectedGroup = classGroups.find((group) => group.name === form.klass);
  const activePipelineApps = visibleApps.filter((app) => ["pending", "assessment", "interview", "teacher_review", "accepted"].includes(app.status));
  const updateForm = (patch: Partial<typeof form>) => setForm((prev) => ({ ...prev, ...patch }));

  const handleTeacherChange = (teacher: string) => {
    const firstGroup = classGroups.find((group) => group.teacher === teacher);
    updateForm({
      teacher,
      klass: firstGroup?.name ?? "",
      program: firstGroup?.program ?? form.program,
    });
  };

  const handleGroupChange = (klass: string) => {
    const group = classGroups.find((item) => item.name === klass);
    updateForm({
      klass,
      teacher: group?.teacher ?? form.teacher,
      program: group?.program ?? form.program,
    });
  };

  const handleTeacherFilter = (teacher: string) => {
    setTeacherFilter(teacher);
    setGroupFilter("All groups");
  };

  const advance = (app: Application) => {
    const effectiveStatus = pipelineStatus(app.status);
    if (nextStatus[effectiveStatus]) void updateApplicationStatus(app.id, nextStatus[effectiveStatus]!);
    setNotice(`${app.name}: ${actionLabel[effectiveStatus] ?? "Moved forward"}.`);
  };

  const reject = (app: Application) => {
    void updateApplicationStatus(app.id, "rejected");
    setNotice(`${app.name} marked as rejected.`);
  };
  const waitlist = (app: Application) => {
    void updateApplicationStatus(app.id, "waitlist");
    setNotice(`${app.name} moved to waitlist.`);
  };
  const moveFromWaitlist = (app: Application, status: AppStatus) => {
    void updateApplicationStatus(app.id, status);
    setNotice(`${app.name} moved from waitlist to ${status.replace("_", " ")}.`);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const newApp = await createApplication({
      name: form.name.trim(),
      age: Number(form.age),
      parentName: form.parentName.trim(),
      parentSurname: form.parentSurname.trim(),
      email: form.email.trim(),
      phone: formatPhone(form.phone),
      emergencyContact1Name: form.emergencyContact1Name.trim(),
      emergencyContact1Phone: form.emergencyContact1Phone.trim(),
      emergencyContact1Relation: form.emergencyContact1Relation.trim(),
      emergencyContact2Name: form.emergencyContact2Name.trim(),
      emergencyContact2Phone: form.emergencyContact2Phone.trim(),
      emergencyContact2Relation: form.emergencyContact2Relation.trim(),
      parentTelegram: form.parentTelegram.trim(),
      address: form.address.trim(),
      program: form.program,
      teacher: form.teacher,
      klass: form.klass,
    });
    setNotice(`${newApp.name} registered and assigned to ${newApp.klass}.`);
    setForm(emptyForm);
  };

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-line bg-white shadow-sm">
        <div className="grid gap-5 p-5 xl:grid-cols-[1fr_440px] xl:items-start">
          <div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-md bg-gold-500/15 px-2.5 py-1 text-xs font-semibold uppercase text-gold-600">
                Registration
              </span>
              <span className="rounded-md bg-cream px-2.5 py-1 text-xs font-semibold text-ink/55">
                {activePipelineApps.length} active applicants
              </span>
            </div>
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-ink sm:text-3xl">Admissions pipeline</h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink/55">Register families, route them to teacher review, and track final enrollment.</p>
          </div>
          <div className="rounded-lg border border-line bg-cream/45 p-3 shadow-sm">
            <div className="grid gap-2 md:grid-cols-[1fr_150px_150px] xl:grid-cols-1">
              <label className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/35" size={16} />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search child, parent, phone, group"
                  className="w-full rounded-lg border border-line bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-gold-500"
                />
              </label>
              <select
                value={teacherFilter}
                onChange={(event) => handleTeacherFilter(event.target.value)}
                className="rounded-lg border border-line bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:border-gold-500"
              >
                <option>All teachers</option>
                {teachers.map((teacher) => (
                  <option key={teacher}>{teacher}</option>
                ))}
              </select>
              <select
                value={groupFilter}
                onChange={(event) => setGroupFilter(event.target.value)}
                className="rounded-lg border border-line bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:border-gold-500"
              >
                <option>All groups</option>
                {filteredGroupOptions.map((group) => (
                  <option key={group}>{group}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <IntakeStat label="New" value={String(apps.filter((app) => app.status === "pending").length)} detail="Needs first contact" tone="dark" />
        <IntakeStat label="Teacher review" value={String(apps.filter((app) => pipelineStatus(app.status) === "teacher_review").length)} detail="Waiting on teacher" tone="warn" />
        <IntakeStat label="Waitlist" value={String(apps.filter((app) => app.status === "waitlist").length)} detail="Acknowledgement needed" tone="warn" />
        <IntakeStat label="Accepted" value={String(apps.filter((app) => app.status === "accepted").length)} detail="Ready for enrollment" tone="good" />
      </div>

      <div className="grid gap-5">
        <section className="order-1 rounded-lg border border-line bg-white shadow-sm">
          <div className="border-b border-line px-5 py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-ink">Pipeline board</h2>
                <p className="mt-0.5 text-sm text-ink/45">New families move directly to teacher review.</p>
              </div>
              <p className="rounded-md bg-cream px-3 py-2 text-xs font-semibold text-ink/55">{notice}</p>
            </div>
          </div>
          <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
            {pipelineStages.map((stage) => {
              const stageApps = visibleApps.filter((app) => pipelineStatus(app.status) === stage.key);
              return (
                <div key={stage.key} className="min-w-0 rounded-lg border border-line bg-cream/45">
                  <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-3">
                    <p className="text-sm font-bold leading-snug text-ink">{stage.label}</p>
                    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-ink/50">{stageApps.length}</span>
                  </div>
                  <div className="max-h-[520px] space-y-3 overflow-y-auto p-3">
                    {stageApps.map((app) => (
                      <ApplicantCard
                        key={app.id}
                        app={app}
                        onAdvance={advance}
                        onWaitlist={waitlist}
                        onReject={reject}
                      />
                    ))}
                    {stageApps.length === 0 && (
                      <p className="rounded-lg border border-dashed border-line bg-white/60 px-3 py-8 text-center text-xs font-semibold text-ink/35">
                        {stage.empty}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {waitlistApps.length > 0 && (
            <div className="border-t border-line px-5 py-4">
              <p className="mb-3 text-xs font-semibold uppercase text-ink/40">Waitlist</p>
              <div className="grid gap-3">
                {waitlistApps.map((app) => (
                  <div key={app.id} className="grid min-w-0 gap-3 rounded-lg border border-line bg-white p-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,220px)_auto] lg:items-center">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold text-ink">{app.name}</p>
                        <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">Waitlist</span>
                      </div>
                      <p className="mt-1 truncate text-xs text-ink/45">
                        {app.parentName} {app.parentSurname} · {app.phone}{app.email ? ` · ${app.email}` : ""}
                      </p>
                    </div>
                    <p className="min-w-0 truncate text-sm font-semibold text-ink/55">
                      {app.klass} · {app.teacher}
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2 lg:w-[260px]">
                      <button
                        type="button"
                        onClick={() => moveFromWaitlist(app, "pending")}
                        className="rounded-lg border border-line px-3 py-2 text-xs font-semibold text-ink/60 hover:border-gold-500 hover:text-gold-600"
                      >
                        Move to New
                      </button>
                      <button
                        type="button"
                        onClick={() => moveFromWaitlist(app, "teacher_review")}
                        className="rounded-lg bg-green-900 px-3 py-2 text-xs font-semibold text-cream hover:bg-green-800"
                      >
                        Teacher Review
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {rejectedApps.length > 0 && (
            <div className="border-t border-line px-5 py-4">
              <p className="mb-3 text-xs font-semibold uppercase text-ink/40">Rejected</p>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {rejectedApps.map((app) => (
                  <div key={app.id} className="rounded-lg border border-line bg-white p-3">
                    <p className="text-sm font-semibold text-ink">{app.name}</p>
                    <p className="mt-1 text-xs text-ink/45">{app.parentName} {app.parentSurname} · {app.phone}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <div className="order-2">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="rounded-lg border border-line bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-900 text-cream">
                <UserRoundPlus size={19} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-ink">Family intake</h2>
                <p className="text-sm text-ink/45">Student, parent, placement</p>
              </div>
            </div>

            <form onSubmit={submit} className="space-y-4">
              <div className="rounded-lg border border-line bg-cream/45 p-3">
                <p className="mb-3 text-xs font-semibold uppercase text-ink/45">Student</p>
                <div className="grid gap-3 sm:grid-cols-[1fr_88px]">
                  <Field label="Child full name" value={form.name} onChange={(name) => updateForm({ name })} placeholder="Ali Valiyev" />
                  <Field label="Age" type="number" value={form.age} onChange={(age) => updateForm({ age })} placeholder="8" />
                </div>
                <div className="mt-3">
                  <Field label="Home address" value={form.address} onChange={(address) => updateForm({ address })} placeholder="Brooklyn, NY 11219" />
                </div>
              </div>

              <div className="rounded-lg border border-line bg-cream/45 p-3">
                <p className="mb-3 text-xs font-semibold uppercase text-ink/45">Parent</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="First name" value={form.parentName} onChange={(parentName) => updateForm({ parentName })} placeholder="Parent first name" />
                  <Field label="Last name" value={form.parentSurname} onChange={(parentSurname) => updateForm({ parentSurname })} placeholder="Parent last name" />
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Field label="Phone" value={form.phone} onChange={(phone) => updateForm({ phone: formatPhone(phone) })} placeholder="(718) 555-0199" />
                  <Field label="Email" type="email" value={form.email} onChange={(email) => updateForm({ email })} placeholder="parent@example.com" />
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Field label="Telegram" value={form.parentTelegram} onChange={(parentTelegram) => updateForm({ parentTelegram })} placeholder="@parent" required={false} />
                </div>
              </div>

              <details className="rounded-lg border border-line bg-white p-3">
                <summary className="cursor-pointer text-xs font-semibold uppercase text-ink/45">Emergency contacts</summary>
                <div className="mt-3 space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Contact 1" value={form.emergencyContact1Name} onChange={(emergencyContact1Name) => updateForm({ emergencyContact1Name })} placeholder="Name" required={false} />
                    <Field label="Phone" value={form.emergencyContact1Phone} onChange={(emergencyContact1Phone) => updateForm({ emergencyContact1Phone })} placeholder="Phone" required={false} />
                  </div>
                  <Field label="Relation" value={form.emergencyContact1Relation} onChange={(emergencyContact1Relation) => updateForm({ emergencyContact1Relation })} placeholder="Mother, uncle" required={false} />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Contact 2" value={form.emergencyContact2Name} onChange={(emergencyContact2Name) => updateForm({ emergencyContact2Name })} placeholder="Name" required={false} />
                    <Field label="Phone" value={form.emergencyContact2Phone} onChange={(emergencyContact2Phone) => updateForm({ emergencyContact2Phone })} placeholder="Phone" required={false} />
                  </div>
                  <Field label="Relation" value={form.emergencyContact2Relation} onChange={(emergencyContact2Relation) => updateForm({ emergencyContact2Relation })} placeholder="Aunt, neighbor" required={false} />
                </div>
              </details>

              <div className="rounded-lg border border-line bg-cream/45 p-3">
                <p className="mb-3 text-xs font-semibold uppercase text-ink/45">Placement</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1.5 text-xs font-semibold text-ink/55">
                    Teacher
                    <select
                      value={form.teacher}
                      onChange={(event) => handleTeacherChange(event.target.value)}
                      className="w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm font-medium text-ink outline-none focus:border-gold-500"
                    >
                      {teachers.map((teacher) => (
                        <option key={teacher}>{teacher}</option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1.5 text-xs font-semibold text-ink/55">
                    Group
                    <select
                      value={form.klass}
                      onChange={(event) => handleGroupChange(event.target.value)}
                      className="w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm font-medium text-ink outline-none focus:border-gold-500"
                    >
                      {groupOptions.map((group) => (
                        <option key={group}>{group}</option>
                      ))}
                    </select>
                  </label>
                </div>
                {selectedGroup && (
                  <div className="mt-3 rounded-lg border border-line bg-white p-3 text-sm text-ink/65">
                    <p className="font-semibold text-ink">{selectedGroup.name} · {selectedGroup.schedule}</p>
                    <p className="mt-1">
                      {selectedGroup.enrolled}/{selectedGroup.capacity} seats · {selectedGroup.program}
                    </p>
                  </div>
                )}
              </div>

              <button className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-900 px-4 py-3 text-sm font-semibold text-cream hover:bg-green-800">
                <Plus size={17} /> Register and assign
              </button>
            </form>
          </section>

          <section className="rounded-lg border border-line bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
                  <UsersRound size={18} /> Student lookup
                </h2>
                <p className="mt-0.5 text-sm text-ink/45">Quick parent contacts</p>
              </div>
              <span className="rounded-lg bg-cream px-3 py-2 text-xs font-semibold text-ink/50">
                {lookupRows.length}/{lookupMatches.length}
              </span>
            </div>
            <div className="max-h-80 divide-y divide-line overflow-y-auto">
              {lookupRows.map((student) => (
                <div key={student.id} className="px-5 py-3">
                  <p className="truncate text-sm font-semibold text-ink">{student.name}</p>
                  <p className="mt-1 text-xs text-ink/45">{student.klass} · {student.teacher}</p>
                  <p className="mt-1 text-xs font-semibold text-ink/70">{student.parentName} · {student.parentPhone}</p>
                </div>
              ))}
              {lookupRows.length === 0 && (
                <p className="px-5 py-8 text-center text-sm text-ink/40">No students match this search.</p>
              )}
            </div>
            {lookupMatches.length > lookupRows.length && (
              <p className="border-t border-line px-5 py-3 text-xs font-semibold text-ink/40">
                Showing first {lookupRows.length}. Use search to narrow results.
              </p>
            )}
          </section>
          </div>
        </div>
      </div>
    </div>
  );
}
