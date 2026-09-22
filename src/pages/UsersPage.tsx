import { useState } from 'react';
import { useAcademy } from '../data/academyStore';
import { SectionTitle } from '../components/ui';
import type { StaffUser } from '../data/mockData';

export function UsersPage() {
  const { staffUsers, user, editStaff, resetStaffPassword, updateUserStatus } = useAcademy();
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('The eight approved accounts are ready. Edit staff names and access here; teacher assignments stay linked when a name changes.');
  const run = async (action: () => Promise<unknown>, message: string) => { setBusy(true); try { await action(); setNotice(message); } catch(e) { setNotice(e instanceof Error ? e.message : 'Could not save'); } finally { setBusy(false); } };
  return <div className="space-y-5"><SectionTitle eyebrow="IT Admin" title="Users & access" sub="Manage staff profiles, access and temporary passwords." /><p role="status" className="rounded-lg bg-sky-50 p-3 text-sm text-sky-900">{notice}</p>
    <input aria-label="Search staff" className="w-full rounded-lg border border-line bg-white p-3" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search name, email or role" />
    <div className="grid gap-4 lg:grid-cols-2">{staffUsers.filter(u => `${u.name} ${u.email} ${u.role}`.toLowerCase().includes(query.toLowerCase())).map(u => <StaffCard key={`${u.id}:${u.name}`} staff={u} self={u.id === user?.id} busy={busy} onName={name => run(() => editStaff(u.id, name), 'Staff name updated. Teacher assignments preserved.')} onStatus={() => run(() => updateUserStatus(u.id, u.status === 'active' ? 'inactive' : 'active'), 'Access status updated.')} onPassword={password => run(() => resetStaffPassword(u.id, password), 'Temporary password saved. Previous sessions are revoked; the user must choose a new password after login.')} />)}</div>
  </div>;
}
function StaffCard({ staff, self, busy, onName, onStatus, onPassword }: { staff: StaffUser; self: boolean; busy: boolean; onName: (name: string) => Promise<void>; onStatus: () => Promise<void>; onPassword: (password: string) => Promise<void> }) {
  const [name, setName] = useState(staff.name);
  const [password, setPassword] = useState('');
  return <section className="space-y-3 rounded-xl border border-line bg-white p-5"><div className="flex flex-wrap justify-between gap-2"><h2 className="font-bold">{staff.name}</h2><span className="text-sm text-ink/60">{staff.role} · {staff.status}</span></div><p className="break-all text-sm text-ink/60">{staff.email}</p>
    <form className="flex gap-2" onSubmit={e => { e.preventDefault(); void onName(name); }}><input aria-label={`Name for ${staff.email}`} className="min-w-0 flex-1 rounded-lg border border-line p-2" value={name} onChange={e => setName(e.target.value)} required minLength={2} maxLength={100} disabled={busy} /><button disabled={busy} className="rounded-lg bg-green-900 px-3 py-2 text-sm text-cream">Save name</button></form>
    <p className="text-xs text-ink/45">Login email and assigned role remain fixed to the approved account.</p>
    <button disabled={busy || self} className="rounded-lg border border-line px-3 py-2 text-sm disabled:opacity-40" onClick={() => void onStatus()}>{staff.status === 'active' ? 'Deactivate' : 'Activate'} access</button>
    {!self && <details className="border-t border-line pt-3"><summary className="cursor-pointer text-sm font-semibold">Set temporary password</summary><form className="mt-3 space-y-2" onSubmit={e => { e.preventDefault(); void onPassword(password); }}><p className="text-xs text-ink/60">This replaces the current password and signs the user out. Give them the temporary password below; they must change it on their next login.</p><input aria-label={`Temporary password for ${staff.email}`} type="text" autoComplete="off" className="w-full rounded-lg border border-line p-2 font-mono text-sm" minLength={12} maxLength={128} required value={password} onChange={e => setPassword(e.target.value)} disabled={busy} /><div className="flex flex-wrap gap-2"><button type="button" disabled={busy} className="rounded-lg border border-line px-3 py-2 text-sm" onClick={() => { const bytes = crypto.getRandomValues(new Uint8Array(18)); setPassword(Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')); }}>Generate password</button><button disabled={busy || password.length < 12} className="rounded-lg bg-green-900 px-3 py-2 text-sm text-cream">Save temporary password</button></div></form></details>}
  </section>;
}
