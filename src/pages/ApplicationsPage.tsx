import { useMemo, useState, type FormEvent } from "react";
import { Check, Filter, Phone, Plus, Search, UserRoundPlus } from "lucide-react";
import { SectionTitle } from "../components/ui";
import {
  type AppStatus,
} from "../data/mockData";
import { useAcademy } from "../data/academyStore";
import { classGroups as fallbackClassGroups } from "../data/mockData";

const stages: { key: AppStatus | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "New" },
  { key: "assessment", label: "Assessment" },
  { key: "interview", label: "Interview" },
  { key: "accepted", label: "Accepted" },
  { key: "rejected", label: "Rejected" },
];

const nextStatus: Partial<Record<AppStatus, AppStatus>> = {
  pending: "assessment",
  assessment: "interview",
  interview: "accepted",
};

const emptyForm = {
  name: "",
  age: "8",
  parentName: "",
  parentSurname: "",
  phone: "",
  address: "",
  program: fallbackClassGroups[0]?.program ?? "",
  teacher: fallbackClassGroups[0]?.teacher ?? "",
  klass: fallbackClassGroups[0]?.name ?? "",
};

function IntakeMetric({
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

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
}) {
  return (
    <label className="space-y-1.5 text-xs font-semibold text-ink/55">
      {label}
      <input
        required
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

export function ApplicationsPage() {
  const { applications: apps, classGroups, createApplication, updateApplicationStatus } = useAcademy();
  const [form, setForm] = useState(emptyForm);
  const [stageFilter, setStageFilter] = useState<AppStatus | "all">("all");
  const [teacherFilter, setTeacherFilter] = useState("All teachers");
  const [groupFilter, setGroupFilter] = useState("All groups");
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("Admissions workspace is ready.");
  const [reviewed, setReviewed] = useState<string[]>([]);

  const teachers = useMemo(() => Array.from(new Set(classGroups.map((group) => group.teacher))), []);
  const groupOptions = useMemo(
    () => classGroups.filter((group) => group.teacher === form.teacher).map((group) => group.name),
    [form.teacher]
  );
  const filteredGroupOptions = useMemo(() => {
    if (teacherFilter === "All teachers") return classGroups.map((group) => group.name);
    return classGroups.filter((group) => group.teacher === teacherFilter).map((group) => group.name);
  }, [teacherFilter]);

  const visibleApps = apps.filter((app) => {
    const matchesStage = stageFilter === "all" || app.status === stageFilter;
    const matchesTeacher = teacherFilter === "All teachers" || app.teacher === teacherFilter;
    const matchesGroup = groupFilter === "All groups" || app.klass === groupFilter;
    const matchesQuery = `${app.name} ${app.parentName} ${app.parentSurname} ${app.phone} ${app.address} ${app.klass}`
      .toLowerCase()
      .includes(query.toLowerCase());
    return matchesStage && matchesTeacher && matchesGroup && matchesQuery;
  });

  const selectedGroup = classGroups.find((group) => group.name === form.klass);
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

  const advance = (id: string, name: string) => {
    const app = apps.find((item) => item.id === id);
    if (app && nextStatus[app.status]) void updateApplicationStatus(id, nextStatus[app.status]!);
    setNotice(`${name} moved to the next admissions stage.`);
  };

  const reject = (id: string, name: string) => {
    void updateApplicationStatus(id, "rejected");
    setNotice(`${name} marked as rejected.`);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const newApp = await createApplication({
      name: form.name.trim(),
      age: Number(form.age),
      parentName: form.parentName.trim(),
      parentSurname: form.parentSurname.trim(),
      phone: form.phone.trim(),
      address: form.address.trim(),
      program: form.program,
      teacher: form.teacher,
      klass: form.klass,
    });
    setNotice(`${newApp.name} registered and assigned to ${newApp.klass}.`);
    setForm(emptyForm);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <SectionTitle
          eyebrow="Registration"
          title="Admissions workspace"
          sub="Register families, assign teacher/group placement, and move applicants through the intake pipeline."
        />
        <button
          onClick={() => setNotice("New intake form is ready on the left.")}
          className="inline-flex items-center gap-2 rounded-lg bg-green-900 px-4 py-2.5 text-sm font-semibold text-cream hover:bg-green-800"
        >
          <UserRoundPlus size={16} /> New intake
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <IntakeMetric label="Total applicants" value={String(apps.length)} detail="All active records" tone="dark" />
        <IntakeMetric label="New" value={String(apps.filter((app) => app.status === "pending").length)} detail="Needs first contact" tone="warn" />
        <IntakeMetric label="In process" value={String(apps.filter((app) => app.status === "assessment" || app.status === "interview").length)} detail="Assessment or interview" />
        <IntakeMetric label="Accepted" value={String(apps.filter((app) => app.status === "accepted").length)} detail="Ready for enrollment" tone="good" />
      </div>

      <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">{notice}</div>

      <div className="grid gap-5 xl:grid-cols-[400px_1fr]">
        <section className="rounded-xl border border-line bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-900 text-cream">
              <UserRoundPlus size={19} />
            </div>
            <div>
              <h3 className="font-display text-lg text-ink">Family intake</h3>
              <p className="text-sm text-ink/45">Required student and parent details</p>
            </div>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-[1fr_88px]">
              <Field label="Child full name" value={form.name} onChange={(name) => updateForm({ name })} placeholder="Ali Valiyev" />
              <Field label="Age" type="number" value={form.age} onChange={(age) => updateForm({ age })} placeholder="8" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Parent first name" value={form.parentName} onChange={(parentName) => updateForm({ parentName })} placeholder="Parent first name" />
              <Field label="Parent last name" value={form.parentSurname} onChange={(parentSurname) => updateForm({ parentSurname })} placeholder="Parent last name" />
            </div>
            <Field label="Phone number" value={form.phone} onChange={(phone) => updateForm({ phone })} placeholder="(718) 555-0199" />
            <Field label="Home address" value={form.address} onChange={(address) => updateForm({ address })} placeholder="Brooklyn, NY 11219" />

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
              <div className="rounded-xl border border-line bg-cream/60 p-3 text-sm text-ink/65">
                <p className="font-semibold text-ink">{selectedGroup.name} · {selectedGroup.schedule}</p>
                <p className="mt-1">
                  {selectedGroup.enrolled}/{selectedGroup.capacity} seats · {selectedGroup.program}
                </p>
              </div>
            )}

            <button className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-900 px-4 py-3 text-sm font-semibold text-cream hover:bg-green-800">
              <Plus size={17} /> Register and assign
            </button>
          </form>
        </section>

        <section className="rounded-xl border border-line bg-white shadow-sm">
          <div className="grid gap-3 border-b border-line p-4 lg:grid-cols-[1fr_170px_170px]">
            <label className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/35" size={17} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search child, parent, phone, address"
                className="w-full rounded-lg border border-line bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-gold-500"
              />
            </label>
            <label className="relative">
              <Filter className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/35" size={16} />
              <select
                value={teacherFilter}
                onChange={(event) => handleTeacherFilter(event.target.value)}
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
              onChange={(event) => setGroupFilter(event.target.value)}
              className="w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-gold-500"
            >
              <option>All groups</option>
              {filteredGroupOptions.map((group) => (
                <option key={group}>{group}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap gap-2 border-b border-line px-4 py-3">
            {stages.map((stage) => (
              <button
                key={stage.key}
                onClick={() => setStageFilter(stage.key)}
                className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                  stageFilter === stage.key
                    ? "bg-green-900 text-cream"
                    : "border border-line bg-white text-ink/60 hover:border-gold-500 hover:text-gold-600"
                }`}
              >
                {stage.label}
              </button>
            ))}
          </div>

          <div className="divide-y divide-line">
            {visibleApps.map((app) => (
              <div key={app.id} className="grid gap-4 px-5 py-4 xl:grid-cols-[1fr_190px_180px] xl:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-ink">{app.name}</p>
                    <span className="rounded-full bg-gold-500/15 px-2.5 py-1 text-xs font-semibold text-gold-600">
                      {app.status}
                    </span>
                    {reviewed.includes(app.id) && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                        <Check size={12} /> Reviewed
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-ink/50">
                    Age {app.age} · {app.program} · {app.klass} with {app.teacher}
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-ink/45">
                    <Phone size={12} /> {app.phone} · {app.parentName} {app.parentSurname}
                  </p>
                  <p className="mt-0.5 text-xs text-ink/35">{app.address}</p>
                </div>
                <div className="rounded-xl bg-cream/60 px-3 py-2 text-sm text-ink/60">
                  <p className="font-semibold text-ink">{app.klass}</p>
                  <p className="mt-0.5 text-xs">{app.submitted}</p>
                </div>
                <div className="flex flex-wrap justify-start gap-2 xl:justify-end">
                  <button
                    onClick={() => {
                      setReviewed((prev) => (prev.includes(app.id) ? prev : [...prev, app.id]));
                      setNotice(`${app.name}'s intake reviewed.`);
                    }}
                    className="rounded-lg border border-line px-3 py-2 text-xs font-semibold text-ink/60 hover:border-gold-500 hover:text-gold-600"
                  >
                    Review
                  </button>
                  {nextStatus[app.status] && (
                    <button
                      onClick={() => advance(app.id, app.name)}
                      className="rounded-lg bg-green-900 px-3 py-2 text-xs font-semibold text-cream hover:bg-green-800"
                    >
                      Next stage
                    </button>
                  )}
                  {app.status !== "accepted" && app.status !== "rejected" && (
                    <button
                      onClick={() => reject(app.id, app.name)}
                      className="rounded-lg border border-line px-3 py-2 text-xs font-semibold text-red-600 hover:border-red-200 hover:bg-red-50"
                    >
                      Reject
                    </button>
                  )}
                </div>
              </div>
            ))}
            {visibleApps.length === 0 && (
              <div className="px-5 py-12 text-center text-sm text-ink/40">
                No applicants match this view.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
