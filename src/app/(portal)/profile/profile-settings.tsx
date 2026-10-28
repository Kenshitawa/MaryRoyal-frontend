"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  ShieldCheck,
  Upload,
} from "lucide-react";

export default function ProfileSettings({
  name,
  email,
  role,
  initialAvatar,
}: {
  name: string;
  email: string;
  role: string;
  initialAvatar: string | null;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [avatar, setAvatar] = useState(initialAvatar);
  const [photoMessage, setPhotoMessage] = useState("");
  const [photoError, setPhotoError] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [newPasswordVal, setNewPasswordVal] = useState("");

  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setPhotoMessage("");
    setPhotoError("");
    const photo = input.current?.files?.[0];
    if (!photo) {
      setPhotoError("Please select an image file first.");
      setBusy(false);
      return;
    }
    const data = new FormData();
    data.set("photo", photo);
    try {
      const response = await fetch("/api/profile", { method: "POST", body: data });
      const result = await response.json();
      if (response.ok) {
        setAvatar(result.avatarUrl);
        setPhotoMessage("Profile photo updated successfully.");
      } else {
        setPhotoError(result.error ?? "Photo could not be saved.");
      }
    } catch {
      setPhotoError("Network error while uploading photo.");
    } finally {
      setBusy(false);
    }
  }

  async function changePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setPasswordMessage("");
    setPasswordError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/change-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          currentPassword: form.get("currentPassword"),
          password: form.get("password"),
        }),
      });
      const result = await response.json();
      if (response.ok) {
        setPasswordMessage("Password changed. Your session remains secure and active.");
        event.currentTarget.reset();
        setNewPasswordVal("");
      } else {
        setPasswordError(result.error ?? "Incorrect current password or invalid new password.");
      }
    } catch {
      setPasswordError("Network connection failed.");
    } finally {
      setBusy(false);
    }
  }

  const meetsLength = newPasswordVal.length >= 12;

  return (
    <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
      {/* Profile Photo & Info Bento Card */}
      <section className="glass dark:glass-dark rounded-3xl border border-slate-200/80 p-6 shadow-sm sm:p-7 dark:border-slate-800/80 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-4">
            <div className="relative grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-3xl bg-gradient-to-br from-blue-700 to-indigo-700 text-xl font-black text-white shadow-md">
              {avatar ? (
                <Image
                  src={avatar}
                  alt={`${name}'s photo`}
                  fill
                  sizes="80px"
                  className="object-cover"
                  unoptimized
                />
              ) : (
                name
                  .split(/\s+/)
                  .map((p) => p[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase()
              )}
              <span className="absolute bottom-1 right-1 grid h-6 w-6 place-items-center rounded-xl border border-white bg-blue-900 text-white shadow-xs">
                <Camera size={12} />
              </span>
            </div>

            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white">{name}</h2>
              <span className="mt-1 inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-bold text-blue-700 uppercase tracking-wider dark:bg-blue-950/60 dark:text-blue-300">
                {role.replaceAll("_", " ")}
              </span>
            </div>
          </div>

          <div className="mt-5 flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
            <Mail size={14} className="text-slate-400" />
            <span className="font-mono">{email}</span>
          </div>

          {/* Upload Form */}
          <form onSubmit={upload} className="mt-6 border-t border-slate-100 pt-5 dark:border-slate-800">
            <label
              htmlFor="photo"
              className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300"
            >
              Upload Profile Photo
            </label>
            <input
              ref={input}
              id="photo"
              name="photo"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="mt-2 block w-full rounded-2xl border border-slate-200 bg-white/70 p-2 text-xs text-slate-600 file:mr-3 file:rounded-xl file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-blue-800 dark:border-slate-700 dark:bg-slate-900 dark:file:bg-blue-950/60 dark:file:text-blue-300"
            />
            <p className="mt-1.5 text-[11px] text-slate-400">PNG, JPEG or WebP · Max 2 MB.</p>

            <button
              disabled={busy}
              className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl bg-blue-700 px-4 text-xs font-bold text-white shadow-sm transition hover:bg-blue-800 disabled:opacity-50"
            >
              <Upload size={14} />
              {busy ? "Saving…" : "Save New Photo"}
            </button>

            {photoMessage && (
              <div
                role="status"
                className="mt-3 flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400"
              >
                <CheckCircle2 size={13} />
                {photoMessage}
              </div>
            )}
            {photoError && (
              <div
                role="alert"
                className="mt-3 flex items-center gap-1.5 text-xs font-bold text-red-700 dark:text-red-400"
              >
                <AlertCircle size={13} />
                {photoError}
              </div>
            )}
          </form>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-100 bg-slate-50/60 p-3.5 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-400">
          Photo changes are instantly reflected across your reports and leadership reviews.
        </div>
      </section>

      {/* Change Password Bento Card */}
      <section className="glass dark:glass-dark rounded-3xl border border-slate-200/80 p-6 shadow-sm sm:p-7 dark:border-slate-800/80">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400">
            <KeyRound size={18} />
          </span>
          <div>
            <h2 className="text-base font-black text-slate-900 dark:text-white">Change Password</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Update credentials to maintain individual access security.
            </p>
          </div>
        </div>

        <form onSubmit={changePassword} className="mt-6 space-y-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Current Password
            </label>
            <div className="relative mt-1.5">
              <input
                name="currentPassword"
                type={showCurrentPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                minLength={1}
                placeholder="Enter current password"
                className="min-h-11 w-full rounded-2xl border border-slate-200 bg-white/70 pl-4 pr-11 text-xs font-medium text-slate-900 outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
              <button
                type="button"
                aria-label={showCurrentPassword ? "Hide current password" : "Show current password"}
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              New Password (12+ characters)
            </label>
            <div className="relative mt-1.5">
              <input
                name="password"
                type={showNewPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                minLength={12}
                value={newPasswordVal}
                onChange={(e) => setNewPasswordVal(e.target.value)}
                placeholder="Create strong passphrase"
                className="min-h-11 w-full rounded-2xl border border-slate-200 bg-white/70 pl-4 pr-11 text-xs font-medium text-slate-900 outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
              <button
                type="button"
                aria-label={showNewPassword ? "Hide new password" : "Show new password"}
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {newPasswordVal && (
              <div className="mt-2 flex items-center gap-1.5 text-[11px]">
                <span
                  className={
                    meetsLength
                      ? "text-emerald-700 dark:text-emerald-400 font-bold"
                      : "text-amber-700 dark:text-amber-400 font-semibold"
                  }
                >
                  {meetsLength ? "✓ Meets minimum 12 characters" : "Must be at least 12 characters"}
                </span>
              </div>
            )}
          </div>

          <div className="pt-2">
            <button
              disabled={busy}
              className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-blue-700 px-6 text-xs font-bold text-white shadow-md shadow-blue-700/20 transition hover:bg-blue-800 disabled:opacity-50"
            >
              <Lock size={14} />
              {busy ? "Updating…" : "Update Password"}
            </button>
          </div>

          {passwordMessage && (
            <div
              role="status"
              className="mt-3 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs font-semibold text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
            >
              <CheckCircle2 size={15} className="shrink-0" />
              <span>{passwordMessage}</span>
            </div>
          )}
          {passwordError && (
            <div
              role="alert"
              className="mt-3 flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 p-3.5 text-xs font-semibold text-red-900 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
            >
              <AlertCircle size={15} className="shrink-0" />
              <span>{passwordError}</span>
            </div>
          )}
        </form>

        <div className="mt-7 flex items-center gap-3 rounded-2xl border border-blue-200/70 bg-blue-50/50 p-4 text-xs text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-200">
          <ShieldCheck size={18} className="shrink-0 text-blue-700 dark:text-blue-400" />
          <p>
            <strong>Automatic Protection:</strong> Inactive sessions are signed out after 10 minutes
            of idle time to protect school data.
          </p>
        </div>
      </section>
    </div>
  );
}
