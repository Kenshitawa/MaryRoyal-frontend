"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowUpRight,
  CheckCircle2,
  Clipboard,
  ClipboardCheck,
  KeyRound,
  LoaderCircle,
  UploadCloud,
  X,
} from "lucide-react";

type ProvisionResponse = {
  created: boolean;
  school: { id: string; name: string; slug: string; status: string; logoUrl: string };
  director: { name: string; email: string; username: string | null };
  temporaryPassword: string | null;
};

type ProvisionError = { error?: string; field?: string | null; code?: string };

const inputClass =
  "h-11 w-full rounded-lg border border-slate-200 bg-slate-50/60 px-3 text-sm font-medium text-slate-900 outline-none transition placeholder:font-normal placeholder:text-slate-400 hover:border-slate-300 focus:border-teal-600 focus:bg-white focus:ring-2 focus:ring-teal-100";

const labelClass = "block text-[12px] font-bold text-slate-700";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export default function AddSchoolForm({ rootDomain }: { rootDomain: string | null }) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ProvisionResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [colours, setColours] = useState({
    primaryColour: "#1d4ed8",
    secondaryColour: "#102653",
    accentColour: "#d97706",
  });
  const [idempotencyKey] = useState(() =>
    globalThis.crypto?.randomUUID
      ? globalThis.crypto.randomUUID()
      : `provision-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function chooseFile(next: File | null) {
    if (!next) return;
    const allowed = ["image/png", "image/jpeg", "image/webp"];
    if (next.type && !allowed.includes(next.type)) {
      setError("Use a PNG, JPEG or WebP logo.");
      return;
    }
    if (next.size > 2 * 1024 * 1024) {
      setError("The logo must be 2 MB or smaller.");
      return;
    }
    setError("");
    setFile(next);
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return URL.createObjectURL(next);
    });
  }

  function clearLogo() {
    setFile(null);
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
    const input = document.getElementById("school-logo-input") as HTMLInputElement | null;
    if (input) input.value = "";
  }

  async function copyPassword() {
    if (!result?.temporaryPassword) return;
    try {
      await navigator.clipboard.writeText(result.temporaryPassword);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy automatically. Select the password and copy it manually.");
    }
  }

  function schoolUrl(targetSlug: string) {
    if (rootDomain) return `https://${targetSlug}.${rootDomain}`;
    if (typeof window !== "undefined") {
      return `${window.location.protocol}//${targetSlug}.localhost${window.location.port ? `:${window.location.port}` : ""}`;
    }
    return `http://${targetSlug}.localhost:3000`;
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!file) {
      setError("Choose a school logo to upload.");
      document.getElementById("school-logo-input")?.focus();
      return;
    }

    setBusy(true);
    try {
      const formData = new FormData(event.currentTarget);
      formData.set("logo", file);

      const response = await fetch("/api/super-admin/schools", {
        method: "POST",
        body: formData,
        headers: { "idempotency-key": idempotencyKey },
      });
      const data = (await response.json().catch(() => ({}))) as ProvisionResponse & ProvisionError;

      if (!response.ok) {
        setError(data.error ?? "The school could not be provisioned. Check the details and try again.");
        if (typeof data.field === "string" && /^[a-zA-Z0-9._-]+$/.test(data.field)) {
          requestAnimationFrame(() => {
            document.querySelector<HTMLElement>(`[name="${data.field}"]`)?.focus();
          });
        }
        return;
      }

      setResult(data);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setError("We could not connect. Your details are still here; try submitting again.");
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    const url = schoolUrl(result.school.slug);
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
              <CheckCircle2 size={22} aria-hidden="true" />
            </span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[.14em] text-emerald-700">
                {result.created ? "Provisioning complete" : "Already provisioned"}
              </p>
              <h2 className="mt-1 text-xl font-extrabold tracking-tight text-slate-950">
                {result.school.name} is live
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                {result.created
                  ? "The tenant, defaults, counters and first Director account were created in one transaction."
                  : "This idempotency key was already used. No duplicate school or accounts were created."}
              </p>
            </div>
          </div>
          <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.08em] text-emerald-700">
            {result.school.status}
          </span>
        </div>

        <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <span className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5">
            <Image
              src={result.school.logoUrl}
              alt={`${result.school.name} logo`}
              width={120}
              height={120}
              className="h-full w-full object-contain"
            />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900">{result.school.name}</p>
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="mt-0.5 inline-flex max-w-full items-center gap-1 truncate text-xs font-semibold text-teal-800 hover:underline"
            >
              {url.replace(/^https?:\/\//, "")}
              <ArrowUpRight size={12} aria-hidden="true" />
            </a>
            <p className="mt-1 text-[11px] text-slate-500">School id: {result.school.id}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 p-4">
          <h3 className="text-sm font-bold text-slate-900">First Director account</h3>
          <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-[110px_minmax(0,1fr)]">
            <dt className="font-semibold text-slate-500">Name</dt>
            <dd className="font-semibold text-slate-900">{result.director.name}</dd>
            <dt className="font-semibold text-slate-500">Email</dt>
            <dd className="break-all font-semibold text-slate-900">{result.director.email}</dd>
            {result.director.username && (
              <>
                <dt className="font-semibold text-slate-500">Username</dt>
                <dd className="font-semibold text-slate-900">{result.director.username}</dd>
              </>
            )}
            <dt className="font-semibold text-slate-500">Password</dt>
            <dd>
              {result.temporaryPassword ? (
                <div className="flex flex-wrap items-center gap-2">
                  <code className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[13px] font-bold tracking-wide text-amber-950">
                    {result.temporaryPassword}
                  </code>
                  <button
                    type="button"
                    onClick={copyPassword}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-bold text-slate-700 transition hover:bg-slate-50"
                  >
                    {copied ? <ClipboardCheck size={13} aria-hidden="true" /> : <Clipboard size={13} aria-hidden="true" />}
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
              ) : (
                <span className="text-slate-500">
                  Not shown again. If it was lost, reset the Director password from the school account.
                </span>
              )}
            </dd>
          </dl>
          {result.temporaryPassword && (
            <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-900">
              <KeyRound size={13} className="mr-1 inline" aria-hidden="true" />
              This password is shown only once. It is not stored in plain text or written to logs. The Director
              must change it at first sign-in.
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/super-admin"
            className="inline-flex h-10 items-center rounded-lg bg-teal-800 px-4 text-xs font-bold text-white transition hover:bg-teal-900"
          >
            Back to schools
          </Link>
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
          >
            Open school site <ArrowUpRight size={14} aria-hidden="true" />
          </a>
          <Link
            href="/super-admin/schools/new"
            className="inline-flex h-10 items-center rounded-lg border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
          >
            Add another school
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} aria-busy={busy} className="space-y-7">
      <fieldset className="space-y-4">
        <legend className="text-sm font-extrabold text-slate-950">1. School identity</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={labelClass}>
            School name
            <input
              required
              name="name"
              type="text"
              maxLength={120}
              placeholder="e.g. Riverside Academy"
              className={`${inputClass} mt-1.5`}
              onBlur={(event) => {
                if (!slugTouched && !slug && event.currentTarget.value.trim()) {
                  setSlug(slugify(event.currentTarget.value));
                }
              }}
            />
          </label>
          <label className={labelClass}>
            Subdomain
            <span className="mt-1.5 flex items-stretch">
              <input
                required
                name="slug"
                type="text"
                maxLength={40}
                pattern="[A-Za-z0-9][A-Za-z0-9-]{0,38}[A-Za-z0-9]"
                value={slug}
                onChange={(event) => {
                  setSlugTouched(true);
                  setSlug(event.target.value.toLowerCase());
                }}
                placeholder="riverside"
                className={`${inputClass} rounded-r-none`}
              />
              <span className="inline-flex items-center rounded-r-lg border border-l-0 border-slate-200 bg-slate-100 px-2.5 text-[11px] font-semibold text-slate-500">
                .{rootDomain ?? "localhost"}
              </span>
            </span>
            <span className="mt-1 block text-[10px] font-normal text-slate-400">
              Lowercase letters, numbers and hyphens. Reserved names are blocked.
            </span>
          </label>
          <label className={labelClass}>
            Motto
            <input
              required
              name="motto"
              type="text"
              maxLength={120}
              placeholder="Hard work pays"
              className={`${inputClass} mt-1.5`}
            />
          </label>
          <label className={labelClass}>
            Slogan <span className="font-normal text-slate-400">(optional)</span>
            <input
              name="slogan"
              type="text"
              maxLength={160}
              placeholder="Nurturing Excellence Through CBE"
              className={`${inputClass} mt-1.5`}
            />
          </label>
        </div>
      </fieldset>

      <fieldset className="space-y-4 border-t border-slate-100 pt-6">
        <legend className="text-sm font-extrabold text-slate-950">2. Branding</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          {(
            [
              ["primaryColour", "Primary"],
              ["secondaryColour", "Secondary"],
              ["accentColour", "Accent"],
            ] as const
          ).map(([name, label]) => (
            <div key={name}>
              <label htmlFor={`${name}-picker`} className={labelClass}>
                {label} colour
              </label>
              <div className="mt-1.5 flex items-center gap-2">
                <input
                  id={`${name}-picker`}
                  type="color"
                  value={colours[name]}
                  onChange={(event) => {
                    const value = event.target.value.toLowerCase();
                    setColours((current) => ({ ...current, [name]: value }));
                  }}
                  aria-label={`${label} colour picker`}
                  className="h-11 w-14 shrink-0 cursor-pointer rounded-lg border border-slate-200 bg-white p-1"
                />
                <input
                  required
                  name={name}
                  type="text"
                  value={colours[name]}
                  onChange={(event) => {
                    const value = event.target.value;
                    setColours((current) => ({ ...current, [name]: value }));
                  }}
                  pattern="^#[0-9a-fA-F]{6}$"
                  maxLength={7}
                  aria-label={`${label} colour hex value`}
                  className={inputClass}
                />
              </div>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-slate-500">
          The same template uses these colours for navigation, headings and accents on the school&apos;s own
          subdomain.
        </p>
      </fieldset>

      <fieldset className="space-y-4 border-t border-slate-100 pt-6">
        <legend className="text-sm font-extrabold text-slate-950">3. School contact</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={labelClass}>
            Contact email <span className="font-normal text-slate-400">(optional)</span>
            <input name="contactEmail" type="email" maxLength={254} placeholder="office@school.ac.ke" className={`${inputClass} mt-1.5`} />
          </label>
          <label className={labelClass}>
            Contact phone <span className="font-normal text-slate-400">(optional)</span>
            <input name="contactPhone" type="tel" maxLength={40} placeholder="+254 7…" className={`${inputClass} mt-1.5`} />
          </label>
          <label className={labelClass}>
            P.O. Box <span className="font-normal text-slate-400">(optional)</span>
            <input name="poBox" type="text" maxLength={200} placeholder="P.O. Box 40100, Kisumu" className={`${inputClass} mt-1.5`} />
          </label>
          <label className={labelClass}>
            Physical address <span className="font-normal text-slate-400">(optional)</span>
            <input name="physicalAddress" type="text" maxLength={200} placeholder="Obunga, Kisumu" className={`${inputClass} mt-1.5`} />
          </label>
        </div>
      </fieldset>

      <fieldset className="space-y-4 border-t border-slate-100 pt-6">
        <legend className="text-sm font-extrabold text-slate-950">4. First Director</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={labelClass}>
            Director name
            <input required name="directorName" type="text" maxLength={120} autoComplete="off" className={`${inputClass} mt-1.5`} />
          </label>
          <label className={labelClass}>
            Director email
            <input required name="directorEmail" type="email" maxLength={254} autoComplete="off" className={`${inputClass} mt-1.5`} />
          </label>
          <label className={labelClass}>
            Username <span className="font-normal text-slate-400">(optional)</span>
            <input
              name="directorUsername"
              type="text"
              maxLength={40}
              pattern="[a-z0-9][a-z0-9._-]{2,39}"
              autoComplete="off"
              placeholder="director"
              className={`${inputClass} mt-1.5`}
            />
          </label>
          <label className={labelClass}>
            Phone <span className="font-normal text-slate-400">(optional)</span>
            <input name="directorPhone" type="tel" maxLength={40} autoComplete="off" className={`${inputClass} mt-1.5`} />
          </label>
        </div>
        <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-slate-600">
          A strong temporary password is generated automatically. The Director signs in with email, username
          or phone and must change it immediately.
        </p>
      </fieldset>

      <fieldset className="space-y-3 border-t border-slate-100 pt-6">
        <legend className="text-sm font-extrabold text-slate-950">5. School logo</legend>
        <div
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            chooseFile(event.dataTransfer.files[0] ?? null);
          }}
          className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-3"
        >
          {previewUrl ? (
            <div className="flex items-center gap-3">
              <span
                role="img"
                aria-label="Selected school logo preview"
                className="h-20 w-20 shrink-0 rounded-lg border border-slate-200 bg-white bg-contain bg-center bg-no-repeat p-1"
                style={{ backgroundImage: `url("${previewUrl}")` }}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-slate-800">{file?.name}</p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {file ? formatBytes(file.size) : ""} · will be stored as WebP
                </p>
                <div className="mt-2 flex gap-2">
                  <label
                    htmlFor="school-logo-input"
                    className="cursor-pointer rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50"
                  >
                    Replace
                  </label>
                  <button
                    type="button"
                    onClick={clearLogo}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50"
                  >
                    <X size={12} aria-hidden="true" /> Remove
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <label htmlFor="school-logo-input" className="flex cursor-pointer flex-col items-center gap-2 py-5 text-center">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-white text-teal-700 shadow-sm ring-1 ring-slate-200">
                <UploadCloud size={20} aria-hidden="true" />
              </span>
              <span className="text-xs font-bold text-slate-800">Drop a logo here or choose a file</span>
              <span className="text-[11px] text-slate-500">PNG, JPEG or WebP · 2 MB maximum</span>
            </label>
          )}
          <input
            id="school-logo-input"
            name="logo"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(event) => chooseFile(event.target.files?.[0] ?? null)}
            className="sr-only"
          />
        </div>
      </fieldset>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          <AlertCircle size={17} className="mt-0.5 shrink-0 text-red-500" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-5">
        <button
          disabled={busy}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-teal-800 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-teal-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-wait disabled:opacity-70"
        >
          {busy ? (
            <>
              <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> Provisioning school…
            </>
          ) : (
            "Provision school"
          )}
        </button>
        <p className="text-[11px] text-slate-500">
          Creates one new tenant. Existing schools are never modified.
        </p>
      </div>
    </form>
  );
}
