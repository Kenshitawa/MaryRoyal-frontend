"use client";

import { useState } from "react";
import { Eye, EyeOff, LockKeyhole, Mail, LoaderCircle, AlertCircle } from "lucide-react";

export default function LoginForm() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/login", { method: "POST", body: JSON.stringify({ email: form.get("email"), password: form.get("password") }), headers: { "content-type": "application/json" } });
      const result = await response.json();
      if (response.ok) location.href = result.forcePasswordChange ? "/change-password" : "/dashboard";
      else setError(result.error ?? "Unable to sign in. Check your details and try again.");
    } catch { setError("We could not connect. Check your connection and try again."); }
    finally { setBusy(false); }
  }
  return (
    <form onSubmit={submit} className="mt-6 space-y-4" aria-busy={busy}>
      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
        Email address
        <span className="relative mt-1.5 block">
          <Mail size={16} aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            required
            name="email"
            type="email"
            autoComplete="username"
            className="h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50/60 pl-10 pr-4 text-xs font-medium text-slate-900 outline-none transition placeholder:font-normal placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-500 focus:bg-white focus:ring-3 focus:ring-blue-100 dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:focus:ring-blue-900/40"
            placeholder="name@maryroyal.ac.ke"
          />
        </span>
      </label>

      <div>
        <label htmlFor="login-password" className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
          Password
        </label>
        <span className="relative mt-1.5 block">
          <LockKeyhole size={16} aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            id="login-password"
            required
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            className="h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50/60 pl-10 pr-11 text-xs font-medium text-slate-900 outline-none transition placeholder:font-normal placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-500 focus:bg-white focus:ring-3 focus:ring-blue-100 dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:focus:ring-blue-900/40"
            placeholder="Enter your password"
          />
          <button
            type="button"
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            onClick={() => setShowPassword((value) => !value)}
            className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-blue-600 dark:hover:bg-slate-800"
          >
            {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </span>
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          <AlertCircle size={15} className="mt-0.5 shrink-0 text-red-500" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      <button
        disabled={busy}
        className="group flex h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-700 to-blue-600 text-xs font-semibold text-white shadow-md shadow-blue-700/20 transition hover:-translate-y-0.5 hover:from-blue-800 hover:to-blue-700 hover:shadow-blue-700/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:translate-y-0 disabled:cursor-wait disabled:opacity-70 active:translate-y-0"
      >
        {busy ? (
          <>
            <LoaderCircle size={15} className="animate-spin" /> Signing you in…
          </>
        ) : (
          <>
            Sign in securely <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">→</span>
          </>
        )}
      </button>
    </form>
  );
}
