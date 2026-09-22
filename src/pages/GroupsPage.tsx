import { useState } from 'react';
import { useAcademy } from '../data/academyStore';
import { SectionTitle } from '../components/ui';
import type { ClassGroup } from '../data/mockData';
const field = 'mt-1 w-full rounded-lg border border-line bg-white p-3 text-sm';
export function GroupsPage() {
  const { classGroups, staffUsers, students, saveGroup, transferStudent } = useAcademy();
  const teachers = staffUsers.filter(u => u.role === 'Teacher' && u.status === 'active');
  const [editing, setEditing] = useState<ClassGroup | null>(null);
  const [notice, setNotice] = useState('Each group belongs to one teacher. Enrollment and transfers update teacher rosters automatically.');
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const run = async (action: () => Promise<void>, message: string) => { setBusy(true); try { await action(); setNotice(message); } catch(e) { setNotice(e instanceof Error ? e.message : 'Could not save'); } finally { setBusy(false); } };
  return <div className="space-y-5"><SectionTitle eyebrow="Academy" title="Groups & placement" sub="Configure teacher groups, capacity and schedules. Move a student without losing their payment or attendance history." />
    <p role="status" className="rounded-lg bg-sky-50 p-3 text-sm text-sky-900">{notice}</p>
    <div className="grid gap-5 lg:grid-cols-2"><section className="space-y-3">{classGroups.map(g => <button key={g.id} disabled={busy} onClick={() => setEditing(g)} className="w-full rounded-xl border border-line bg-white p-4 text-left"><p className="font-semibold">{g.name}</p><p className="mt-1 text-sm text-ink/60">{g.teacher} · {g.program} · {g.enrolled}/{g.capacity} students</p><p className="text-xs text-ink/50">{g.schedule || 'Schedule not set'} · Click to edit</p></button>)}</section>
      <form key={editing?.id ?? 'new'} className="space-y-3 rounded-xl border border-line bg-white p-5" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); void run(async () => { await saveGroup(editing?.id ?? null, { name: String(f.get('name')), teacher: String(f.get('teacher')), program: String(f.get('program')), schedule: String(f.get('schedule')), capacity: Number(f.get('capacity')) }); setEditing(null); }, 'Group saved. Linked students and applications updated.'); }}>
        <h2 className="font-bold">{editing ? 'Edit group' : 'Create group'}</h2><p className="text-xs text-ink/50">Changing the teacher moves the whole group to that teacher.</p>
        <label className="block text-sm">Group name<input name="name" className={field} defaultValue={editing?.name} required minLength={2} maxLength={100} /></label>
        <label className="block text-sm">Teacher<select name="teacher" className={field} defaultValue={editing?.teacher} required>{teachers.map(t => <option key={t.id} value={t.teacherAlias}>{t.name}</option>)}</select></label>
        <label className="block text-sm">Program<input name="program" className={field} defaultValue={editing?.program ?? 'General'} required minLength={2} maxLength={100} /></label>
        <label className="block text-sm">Schedule<input name="schedule" className={field} defaultValue={editing?.schedule} maxLength={200} placeholder="Example: Mon/Wed 16:00–18:00" /></label>
        <label className="block text-sm">Capacity<input name="capacity" className={field} type="number" defaultValue={editing?.capacity ?? 30} required min={1} max={200} /></label>
        <div className="flex gap-3"><button disabled={busy || !teachers.length} className="rounded-lg bg-green-900 px-4 py-3 text-cream disabled:opacity-40">{busy ? 'Saving…' : 'Save group'}</button><button type="button" disabled={busy} onClick={() => setEditing(null)}>New group</button></div>
      </form></div>
    <section className="rounded-xl border border-line bg-white p-5"><h2 className="font-bold">Student placement</h2><input aria-label="Search student placement" className={field} placeholder="Student or parent name" value={query} onChange={e => setQuery(e.target.value)} />
      {students.filter(s => `${s.name} ${s.parentName}`.toLowerCase().includes(query.toLowerCase())).map(s => <form key={`${s.id}:${s.klass}`} className="mt-3 flex flex-wrap items-end gap-3 border-b border-line py-3" onSubmit={e => { e.preventDefault(); const groupId = String(new FormData(e.currentTarget).get('groupId')); void run(() => transferStudent(s.id, groupId), `${s.name} moved. Teacher rosters and group counts updated.`); }}><div className="min-w-48 flex-1"><p className="font-semibold">{s.name}</p><p className="text-xs text-ink/50">{s.parentName} · {s.parentPhone}</p></div><label className="text-sm">Assigned group<select name="groupId" className={field} defaultValue={classGroups.find(g => g.name === s.klass)?.id}>{classGroups.map(g => <option key={g.id} value={g.id}>{g.name} · {g.teacher}</option>)}</select></label><button disabled={busy} className="rounded-lg bg-green-900 px-4 py-3 text-sm text-cream">Save placement</button></form>)}
      {!students.length && <p className="mt-4 text-sm text-ink/50">Register and enroll a student first. They will appear here automatically.</p>}
    </section></div>;
}
