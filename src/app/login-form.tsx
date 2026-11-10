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
      const response = await fetch("/api/login", { method: "POST", body: JSON.stringify({ identifier: form.get("identifier"), password: form.get("password") }), headers: { "content-type": "application/json" } });
      const result = await response.json();
      if (response.ok) location.href = result.forcePasswordChange ? "/change-password" : "/dashboard";
      else setError(result.error ?? "Unable to sign in. Check your details and try again.");
    } catch { setError("We could not connect. Check your connection and try again."); }
    finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="mt-7 space-y-5" aria-busy={busy}>
    <label className="block text-[13px] font-bold text-slate-700">Email, username or phone<span className="relative mt-2 block"><Mail size={17} aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"/><input required name="identifier" type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} className="h-[50px] w-full rounded-xl border border-slate-200 bg-slate-50/60 pl-11 pr-4 text-sm font-medium text-slate-900 outline-none transition placeholder:font-normal placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100/70" placeholder="name@school.ac.ke or 07…"/></span></label>
    <div><label htmlFor="login-password" className="block text-[13px] font-bold text-slate-700">Password</label><span className="relative mt-2 block"><LockKeyhole size={17} aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"/><input id="login-password" required name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" className="h-[50px] w-full rounded-xl border border-slate-200 bg-slate-50/60 pl-11 pr-12 text-sm font-medium text-slate-900 outline-none transition placeholder:font-normal placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100/70" placeholder="Enter your password"/><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)} className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-blue-600">{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button></span></div>
    {error && <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><AlertCircle size={17} className="mt-0.5 shrink-0 text-red-500" aria-hidden="true"/><span>{error}</span></div>}
    <button type="submit" disabled={busy} className="group flex h-[50px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-700 to-blue-600 text-sm font-bold text-white shadow-lg shadow-blue-700/20 transition hover:-translate-y-0.5 hover:from-blue-800 hover:to-blue-700 hover:shadow-blue-700/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:translate-y-0 disabled:cursor-wait disabled:opacity-70">{busy ? <><LoaderCircle size={17} className="animate-spin"/> Signing you in…</> : <>Sign in securely <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">→</span></>}</button>
  </form>;
}
