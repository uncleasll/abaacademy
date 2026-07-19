import { useMemo, useState } from "react";
import { CalendarClock, Check, Clock, Phone, X } from "lucide-react";
import { SectionTitle } from "../components/ui";
import { useAcademy } from "../data/academyStore";

const slots = [
  { id: "s1", time: "9:00 AM", day: "Monday", type: "Assessment" },
  { id: "s2", time: "10:30 AM", day: "Monday", type: "Interview" },
  { id: "s3", time: "9:00 AM", day: "Wednesday", type: "Assessment" },
  { id: "s4", time: "11:00 AM", day: "Wednesday", type: "Interview" },
  { id: "s5", time: "2:00 PM", day: "Thursday", type: "Assessment" },
];

function ScheduleMetric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-xl border border-line bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase text-ink/45">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-ink">{value}</p>
      <p className="mt-2 text-xs text-ink/50">{detail}</p>
    </div>
  );
}

export function SchedulePage() {
  const { applications, meetings, createMeeting, deleteMeeting } = useAcademy();
  const applicants = applications.filter((app) => app.status === "assessment" || app.status === "interview");
  const [selectedApplicantId, setSelectedApplicantId] = useState(applicants[0]?.id ?? "");
  const [notice, setNotice] = useState("Select an applicant and book a meeting slot.");

  const bookedSlotKeys = useMemo(() => meetings.map((meeting) => `${meeting.day}-${meeting.time}`), [meetings]);
  const selectedApplicant = applications.find((app) => app.id === selectedApplicantId);
  const openSlots = slots.filter((slot) => !bookedSlotKeys.includes(`${slot.day}-${slot.time}`));

  const bookSlot = (slot: (typeof slots)[number]) => {
    if (!selectedApplicant) {
      setNotice("Choose an applicant before booking a slot.");
      return;
    }
    const slotKey = `${slot.day}-${slot.time}`;
    if (bookedSlotKeys.includes(slotKey)) {
      setNotice(`${slot.day} ${slot.time} is already booked.`);
      return;
    }
    void createMeeting({ applicantId: selectedApplicant.id, day: slot.day, time: slot.time, type: slot.type });
    setNotice(`${selectedApplicant.name} booked for ${slot.type.toLowerCase()} on ${slot.day} at ${slot.time}.`);
  };

  const cancelMeeting = (id: string, name: string) => {
    void deleteMeeting(id);
    setNotice(`${name}'s meeting was canceled.`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <SectionTitle
          eyebrow="Registration"
          title="Assessment schedule"
          sub="Book intake assessments and interviews without losing track of applicant details."
        />
        <button
          onClick={() => setNotice(`${openSlots.length} open slots available this week.`)}
          className="inline-flex items-center gap-2 rounded-lg bg-green-900 px-4 py-2.5 text-sm font-semibold text-cream hover:bg-green-800"
        >
          <CalendarClock size={16} /> Check availability
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-green-800 bg-green-900 p-4 text-cream shadow-sm">
          <p className="text-xs font-semibold uppercase text-gold-300">Open slots</p>
          <p className="mt-2 text-2xl font-semibold">{openSlots.length}</p>
          <p className="mt-2 text-xs text-cream/65">Available this week</p>
        </div>
        <ScheduleMetric label="Booked meetings" value={String(meetings.length)} detail="Assessments and interviews" />
        <ScheduleMetric label="Applicants ready" value={String(applicants.length)} detail="Waiting for scheduling" />
      </div>

      <div className="grid gap-3 rounded-xl border border-line bg-white p-4 shadow-sm lg:grid-cols-[1fr_280px]">
        <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">{notice}</div>
        <select
          value={selectedApplicantId}
          onChange={(event) => {
            setSelectedApplicantId(event.target.value);
            setNotice("Applicant selected.");
          }}
          className="rounded-lg border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-gold-500"
        >
          {applicants.map((applicant) => (
            <option key={applicant.id} value={applicant.id}>
              {applicant.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
        <section className="rounded-xl border border-line bg-white shadow-sm">
          <div className="border-b border-line px-5 py-4">
            <h3 className="font-display text-lg text-ink">Available slots</h3>
            <p className="mt-0.5 text-sm text-ink/45">Booked slots are disabled automatically.</p>
          </div>
          <div className="grid gap-3 p-5 md:grid-cols-2">
            {slots.map((slot) => {
              const booked = bookedSlotKeys.includes(`${slot.day}-${slot.time}`);
              return (
                <div
                  key={slot.id}
                  className={`rounded-xl border p-4 ${booked ? "border-line bg-cream/50" : "border-line bg-white hover:border-gold-500"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-ink">{slot.day}</p>
                      <p className="mt-1 flex items-center gap-1.5 text-sm text-ink/50">
                        <Clock size={14} /> {slot.time}
                      </p>
                    </div>
                    <span className="rounded-full bg-gold-500/15 px-2.5 py-1 text-xs font-semibold text-gold-600">
                      {slot.type}
                    </span>
                  </div>
                  <button
                    onClick={() => bookSlot(slot)}
                    disabled={booked}
                    className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-green-900 px-3 py-2 text-xs font-semibold text-cream hover:bg-green-800 disabled:cursor-not-allowed disabled:bg-line disabled:text-ink/35"
                  >
                    {booked ? <Check size={14} /> : <CalendarClock size={14} />}
                    {booked ? "Booked" : "Book slot"}
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-xl border border-line bg-white shadow-sm">
          <div className="border-b border-line px-5 py-4">
            <h3 className="font-display text-lg text-ink">Upcoming meetings</h3>
            <p className="mt-0.5 text-sm text-ink/45">Family contact and placement details included.</p>
          </div>
          <div className="divide-y divide-line">
            {meetings.map((meeting) => (
              <div key={meeting.id} className="p-5">
                {(() => {
                  const applicant = applications.find((app) => app.id === meeting.applicantId);
                  if (!applicant) return null;
                  return (
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-ink">{applicant.name}</p>
                    <p className="mt-1 text-sm text-ink/50">
                      {meeting.type} · {meeting.day}, {meeting.time}
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-ink/45">
                      <Phone size={12} /> {applicant.phone}
                    </p>
                    <p className="mt-0.5 text-xs text-ink/35">
                      {applicant.klass} · {applicant.teacher}
                    </p>
                  </div>
                  <button
                    onClick={() => cancelMeeting(meeting.id, applicant.name)}
                    className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:border-red-200 hover:bg-red-50"
                  >
                    <X size={13} /> Cancel
                  </button>
                </div>
                  );
                })()}
              </div>
            ))}
            {meetings.length === 0 && <p className="p-5 text-sm text-ink/40">No meetings scheduled yet.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
