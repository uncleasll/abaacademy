import { LockKeyhole, LogIn, ShieldCheck } from "lucide-react";
import { useState, type FormEvent } from "react";
import { ApiError, useAcademy } from "../data/academyStore";

export function LoginPage() {
  const { login } = useAcademy();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(email.trim(), password);
    } catch (error) {
      const status = error instanceof ApiError ? error.status : 0;
      setError(status === 401 || status === 422 ? "Email or password is incorrect." :
        status === 403 ? "This account is inactive. Please contact your administrator." :
        status === 429 ? "Too many failed attempts. Please wait 15 minutes and try again." :
        "The server is unavailable. Please try again shortly.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="grid min-h-dvh bg-cream lg:grid-cols-[0.95fr_1.05fr]">
      <section className="hidden border-r border-line bg-green-900 px-10 py-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10">
            <ShieldCheck size={21} />
          </div>
          <div>
            <p className="font-bold">ABA Academy USA</p>
            <p className="text-sm text-white/55">Secure operations workspace</p>
          </div>
        </div>
        <div className="max-w-xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-gold-300">Staff portal</p>
          <h1 className="mt-4 text-4xl font-bold leading-tight">One protected workspace for academy operations.</h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-white/65">
            Role-based access for IT Admin, Finance, Teacher, and Registration teams with live database actions.
          </p>
        </div>
      </section>

      <section className="flex items-center justify-center px-4 py-8 sm:px-6">
        <div className="w-full max-w-md">
          <div className="mb-7 flex items-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-900 text-white">
              <ShieldCheck size={19} />
            </div>
            <div>
              <p className="font-bold text-ink">ABA Academy USA</p>
              <p className="text-sm text-ink/50">Secure staff portal</p>
            </div>
          </div>

          <div className="rounded-xl border border-line bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-5">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-gold-300/45 text-green-900">
                <LockKeyhole size={19} />
              </div>
              <h1 className="text-2xl font-bold text-ink">Sign in</h1>
              <p className="mt-1 text-sm text-ink/50">Use your academy staff account.</p>
            </div>

            <form className="space-y-4" onSubmit={submit}>
              <label className="block">
                <span className="text-sm font-semibold text-ink">Email</span>
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-line bg-cream px-3 py-2 text-sm font-medium text-ink outline-none focus:border-gold-500"
                  required
                />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-ink">Password</span>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-line bg-cream px-3 py-2 text-sm font-medium text-ink outline-none focus:border-gold-500"
                  required
                />
              </label>
              {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p>}
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-green-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <LogIn size={17} />
                {submitting ? "Signing in..." : "Sign in"}
              </button>
            </form>
          </div>


        </div>
      </section>
    </main>
  );
}
