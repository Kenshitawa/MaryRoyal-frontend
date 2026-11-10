"use client";

import { useState } from "react";
import { Eye, EyeOff, Lock, CheckCircle2, ShieldCheck, Loader2 } from "lucide-react";

export default function ChangePasswordForm({ schoolName }: { schoolName: string }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const hasLength = password.length >= 12;
  const hasUpper = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  const matches = password.length > 0 && password === confirmPassword;

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!hasLength) {
      setError("Password must be at least 12 characters long.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match. Please verify.");
      return;
    }

    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/change-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password })
      });
      if (response.ok) {
        location.href = "/dashboard";
      } else {
        const data = await response.json();
        setError(data.error || "Unable to update password. Choose a password with at least 12 characters.");
      }
    } catch {
      setError("Connection failed. Check your network and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="w-full rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xl shadow-blue-950/5 dark:border-slate-800 dark:bg-slate-900 sm:p-8"
    >
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-[11px] font-bold text-blue-800 dark:bg-blue-950/80 dark:text-blue-300">
          <ShieldCheck size={14} /> Security requirement
        </span>
      </div>

      <h1 className="mt-4 text-2xl font-black tracking-tight text-slate-900 dark:text-white">
        Set your permanent password
      </h1>
      <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
        {schoolName} requires all accounts to set a private password at first sign-in.
      </p>

      <div className="mt-6 space-y-4">
        <div>
          <label htmlFor="new-password" className="block text-xs font-bold text-slate-700 dark:text-slate-300">
            New Password
          </label>
          <div className="relative mt-1.5">
            <input
              name="password"
              id="new-password"
              type={showPassword ? "text" : "password"}
              required
              minLength={12}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 12 characters"
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/60 pl-3.5 pr-11 text-sm font-medium text-slate-900 outline-none transition hover:border-slate-300 focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:border-blue-500"
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <div>
          <label htmlFor="confirm-password" className="block text-xs font-bold text-slate-700 dark:text-slate-300">
            Confirm Password
          </label>
          <div className="relative mt-1.5">
            <input
              name="confirmPassword"
              id="confirm-password"
              type={showPassword ? "text" : "password"}
              required
              minLength={12}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your new password"
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/60 pl-3.5 pr-11 text-sm font-medium text-slate-900 outline-none transition hover:border-slate-300 focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:border-blue-500"
              autoComplete="new-password"
            />
          </div>
        </div>

        {/* Live Password Strength Guidance */}
        <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3.5 text-xs dark:border-slate-800 dark:bg-slate-800/50">
          <p className="font-bold text-slate-700 dark:text-slate-300">Password Checklist:</p>
          <ul className="mt-2 space-y-1.5">
            <li className={`flex items-center gap-2 ${hasLength ? "text-emerald-700 font-semibold dark:text-emerald-400" : "text-slate-400"}`}>
              <CheckCircle2 size={13} className={hasLength ? "text-emerald-600" : "text-slate-300"} />
              At least 12 characters long
            </li>
            <li className={`flex items-center gap-2 ${hasUpper ? "text-emerald-700 font-semibold dark:text-emerald-400" : "text-slate-400"}`}>
              <CheckCircle2 size={13} className={hasUpper ? "text-emerald-600" : "text-slate-300"} />
              Contains uppercase letter (A-Z)
            </li>
            <li className={`flex items-center gap-2 ${hasNumber || hasSpecial ? "text-emerald-700 font-semibold dark:text-emerald-400" : "text-slate-400"}`}>
              <CheckCircle2 size={13} className={hasNumber || hasSpecial ? "text-emerald-600" : "text-slate-300"} />
              Contains a number or symbol
            </li>
            {confirmPassword.length > 0 && (
              <li className={`flex items-center gap-2 ${matches ? "text-emerald-700 font-semibold dark:text-emerald-400" : "text-rose-600 font-semibold"}`}>
                <CheckCircle2 size={13} className={matches ? "text-emerald-600" : "text-rose-400"} />
                {matches ? "Passwords match" : "Passwords do not match"}
              </li>
            )}
          </ul>
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy || !hasLength || (confirmPassword.length > 0 && !matches)}
        className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-700 font-bold text-white shadow-md shadow-blue-700/20 transition hover:bg-blue-800 disabled:opacity-50"
      >
        {busy ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />}
          Update password &amp; continue
      </button>
    </form>
  );
}
