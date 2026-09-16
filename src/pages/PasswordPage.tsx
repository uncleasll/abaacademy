import { useState, type FormEvent } from "react";
import { useAcademy } from "../data/academyStore";

export function PasswordPage({ required = false, onClose }: { required?: boolean; onClose?: () => void }) {
  const { user, changePassword, logout } = useAcademy();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) return setError("New passwords do not match.");
    if (newPassword === currentPassword) return setError("Choose a different password.");
    setSaving(true);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword(""); setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message.replace(/^\d+ /, "") : "Could not change password. Please try again.");
    } finally { setSaving(false); }
  }
  return <main className="grid min-h-dvh place-items-center bg-cream p-4">
    <section className="w-full max-w-md rounded-xl border border-line bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-bold text-ink">{required ? "Set your own password" : "Change password"}</h1>
      <p className="mt-2 break-all text-sm text-ink/60">{user?.email}</p>
      <p className="mt-2 text-sm text-ink/60">{required ? "Replace your temporary password to access your workspace." : "Changing your password signs out your other sessions."} Use at least 12 characters.</p>
      {success ? <p role="status" className="my-4 text-green-900">Your password has been changed.</p> :
        <form onSubmit={submit} className="mt-5 space-y-4">
          {[
            { label: "Current password", value: currentPassword, set: setCurrentPassword, auto: "current-password", min: 1 },
            { label: "New password", value: newPassword, set: setNewPassword, auto: "new-password", min: 12 },
            { label: "Confirm new password", value: confirmPassword, set: setConfirmPassword, auto: "new-password", min: 12 },
          ].map(field => <label key={field.label} className="block text-sm font-semibold text-ink">{field.label}
            <input type="password" autoComplete={field.auto} required minLength={field.min} maxLength={128}
              value={field.value} onChange={e => field.set(e.target.value)} disabled={saving}
              className="mt-1 w-full rounded-lg border border-line bg-cream px-3 py-2" />
          </label>)}
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <button disabled={saving} className="w-full rounded-lg bg-green-900 px-4 py-3 font-bold text-white disabled:opacity-50">{saving ? "Saving..." : "Save password"}</button>
        </form>}
      <button disabled={saving} type="button" onClick={() => required ? void logout() : onClose?.()} className="mt-4 text-sm font-semibold text-ink">{required ? "Log out" : success ? "Back to workspace" : "Cancel"}</button>
    </section>
  </main>;
}
