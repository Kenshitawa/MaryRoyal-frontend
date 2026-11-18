"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/primitives";
import { LoadingState } from "@/components/ui/loader";
import { Button } from "@/components/base/buttons/button";
import { Chip } from "@/components/base/badges/chip";
import { Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from "@/components/base/table/table";
import { StatCards, type Stat } from "@/components/application/dashboard/stat-cards";
import { RiGroupLine, RiShieldUserLine, RiUserFollowLine, RiUserSearchLine } from "@remixicon/react";
import {
  AlertTriangle,
  Check,
  CircleUserRound,
  Copy,
  KeyRound,
  LockKeyhole,
  Search,
  Sparkles,
  UnlockKeyhole,
  UserPlus,
  UserX,
  X,
} from "lucide-react";

type Account = {
  id: string;
  name: string;
  email: string;
  role: string;
  suspended: boolean;
  suspensionReason: string | null;
  forcePasswordChange: boolean;
  failedLogins: number;
};

type TempCredential = {
  id: string;
  name: string;
  email: string;
  role: string;
  password: string;
};

const roles = [
  "DIRECTOR",
  "HEAD_TEACHER",
  "DEPUTY",
  "SENIOR_TEACHER",
  "SECRETARY",
  "ACCOUNTANT",
  "TEACHER",
  "WELFARE_CHAIR",
  "NON_TEACHING_STAFF",
  "PARENT",
  "LEARNER",
];

export default function AccountDirectory() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [error, setError] = useState("");
  const [temp, setTemp] = useState<TempCredential | null>(null);
  const [copied, setCopied] = useState<"password" | "all" | null>(null);
  const [copyFailed, setCopyFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createStep, setCreateStep] = useState(1);
  const createFormRef = useRef<HTMLFormElement>(null);
  const copyTimer = useRef<number | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  async function load() {
    try {
      const response = await fetch("/api/accounts");
      if (!response.ok) {
        setError("Could not load accounts.");
        setLoading(false);
        return;
      }
      const data = (await response.json()) as { accounts?: unknown };
      const rows = Array.isArray(data.accounts) ? data.accounts : [];
      setAccounts(
        rows.flatMap((row): Account[] => {
          if (!row || typeof row !== "object") return [];
          const a = row as Partial<Account>;
          if (
            typeof a.id !== "string" ||
            typeof a.name !== "string" ||
            typeof a.email !== "string" ||
            typeof a.role !== "string"
          ) return [];
          return [{
            id: a.id,
            name: a.name,
            email: a.email,
            role: a.role,
            suspended: Boolean(a.suspended),
            suspensionReason: typeof a.suspensionReason === "string" ? a.suspensionReason : null,
            forcePasswordChange: Boolean(a.forcePasswordChange),
            failedLogins: typeof a.failedLogins === "number" ? a.failedLogins : 0,
          }];
        }),
      );
    } catch {
      setError("Network error while loading accounts.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    return () => {
      if (copyTimer.current) window.clearTimeout(copyTimer.current);
    };
  }, []);

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (createStep < 3) {
      advanceCreateStep();
      return;
    }
    const form = event.currentTarget;
    setError("");
    setTemp(null);
    setSaving(true);
    const values = Object.fromEntries(new FormData(form));
    try {
      const response = await fetch("/api/accounts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Account could not be created.");
        return;
      }
      showCredential({
        id: data.account.id,
        name: data.account.name ?? String(values.name ?? ""),
        email: data.account.email ?? String(values.email ?? ""),
        role: data.account.role ?? String(values.role ?? ""),
        password: data.temporaryPassword,
      });
      form.reset();
      setShowCreate(false);
      setCreateStep(1);
      await load();
    } catch {
      setError("Could not connect. Try again.");
    } finally {
      setSaving(false);
    }
  }

  function advanceCreateStep() {
    if (createStep === 1) {
      const form = createFormRef.current;
      const name = form?.elements.namedItem("name");
      const email = form?.elements.namedItem("email");
      if (name instanceof HTMLInputElement && !name.checkValidity()) { name.reportValidity(); return; }
      if (email instanceof HTMLInputElement && !email.checkValidity()) { email.reportValidity(); return; }
    }
    setCreateStep(step => Math.min(step + 1, 3));
  }

  async function action(account: Account, actionName: string) {
    if (
      actionName === "delete" &&
      !window.confirm(
        `Permanently delete ${account.name}? Their sign-in and account data will be removed. This cannot be undone.`
      )
    ) return;
    if (
      actionName === "suspend" &&
      !window.confirm(`Suspend ${account.name}? They will lose access immediately.`)
    ) {
      return;
    }
    if (
      actionName === "reset-password" &&
      !window.confirm(
        `Reset ${account.name}’s password? Their current password will stop working.`
      )
    ) {
      return;
    }

    setError("");
    setTemp(null);
    setSaving(true);
    try {
      const response = await fetch("/api/accounts", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: account.id, action: actionName }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Account could not be changed.");
        return;
      }
      if (data.temporaryPassword) {
        showCredential({
          id: account.id,
          name: account.name,
          email: account.email,
          role: account.role,
          password: data.temporaryPassword,
        });
      }
      await load();
    } catch {
      setError("Could not connect. Try again.");
    } finally {
      setSaving(false);
    }
  }

  function showCredential(credential: TempCredential) {
    setTemp(credential);
    setCopied(null);
    setCopyFailed(false);
  }

  function dismissCredential() {
    setTemp(null);
    setCopied(null);
    setCopyFailed(false);
  }

  /**
   * Clipboard writes can be refused (insecure origin, permissions), so fall
   * back to a hidden textarea + execCommand before reporting a failure.
   */
  async function copyText(value: string, kind: "password" | "all") {
    let ok = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        ok = true;
      }
    } catch {
      ok = false;
    }
    if (!ok) {
      try {
        const field = document.createElement("textarea");
        field.value = value;
        field.setAttribute("readonly", "");
        field.style.position = "fixed";
        field.style.opacity = "0";
        document.body.appendChild(field);
        field.select();
        ok = document.execCommand("copy");
        document.body.removeChild(field);
      } catch {
        ok = false;
      }
    }
    setCopyFailed(!ok);
    setCopied(ok ? kind : null);
    if (ok) {
      if (copyTimer.current) window.clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => setCopied(null), 2600);
    }
  }

  function credentialNotice(credential: TempCredential) {
    const roleLabel = credential.role.replaceAll("_", " ").toLowerCase();
    return (
      <div
        role="status"
        aria-live="polite"
        className="mb-3 overflow-hidden rounded-2xl border border-accent-200 bg-accent-50 p-3.5 dark:border-accent-800/70 dark:bg-accent-950/40"
      >
        <div className="flex items-start gap-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent-600 text-white shadow-sm">
            <KeyRound size={15} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-caption-1-semibold text-text-primary">
              Temporary password{credential.role ? ` · ${roleLabel}` : ""}
            </p>
            <p className="mt-0.5 text-body-2-regular text-text-secondary">
              Give this to {credential.name || "the account holder"} securely. They must set a personal
              password at first sign-in.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <code className="select-all break-all rounded-lg border border-accent-200 bg-background-primary-default px-2.5 py-1 font-mono text-caption-1-semibold tracking-wide text-text-primary dark:border-accent-800/70">
                {credential.password}
              </code>
              <button
                type="button"
                onClick={() => void copyText(credential.password, "password")}
                className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-accent-300 bg-background-primary-default px-2.5 text-caption-1-semibold text-accent-800 transition hover:bg-accent-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring dark:border-accent-700 dark:text-accent-200 dark:hover:bg-accent-900/50"
              >
                {copied === "password" ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
                {copied === "password" ? "Copied" : "Copy password"}
              </button>
              <button
                type="button"
                onClick={() =>
                  void copyText(
                    `Mary Royal School portal\nEmail: ${credential.email}\nTemporary password: ${credential.password}`,
                    "all",
                  )
                }
                className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-separator-border bg-background-primary-default px-2.5 text-caption-1-semibold text-text-secondary transition hover:bg-background-secondary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring"
              >
                {copied === "all" ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
                {copied === "all" ? "Copied" : "Copy sign-in details"}
              </button>
            </div>
            {copyFailed ? (
              <p className="mt-1.5 text-caption-1-semibold text-danger" role="alert">
                Could not reach the clipboard. Select the password and copy it manually.
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={dismissCredential}
            aria-label="Dismiss temporary password"
            className="grid size-7 shrink-0 place-items-center rounded-lg text-text-tertiary transition hover:bg-accent-100 hover:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring dark:hover:bg-accent-900/50"
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
        <p className="mt-2 border-t border-accent-200/70 pt-2 font-mono text-caption break-all text-text-tertiary dark:border-accent-800/60">
          {credential.email}
        </p>
      </div>
    );
  }

  // Filtered accounts
  const filteredAccounts = useMemo(() => {
    return accounts.filter((acc) => {
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        acc.name.toLowerCase().includes(q) ||
        acc.email.toLowerCase().includes(q) ||
        acc.role.toLowerCase().includes(q);

      const matchesRole =
        roleFilter === "ALL" ||
        (roleFilter === "STAFF"
          ? ["DIRECTOR", "HEAD_TEACHER", "DEPUTY", "SENIOR_TEACHER", "SECRETARY", "ACCOUNTANT", "TEACHER"].includes(
              acc.role
            )
          : acc.role === roleFilter);

      const isLocked = acc.failedLogins >= 8;
      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "ARCHIVED" && acc.suspensionReason === "ARCHIVED") ||
        (statusFilter === "ACTIVE" && !acc.suspended && !isLocked) ||
        (statusFilter === "SUSPENDED" && acc.suspended && acc.suspensionReason !== "ARCHIVED") ||
        (statusFilter === "LOCKED" && isLocked) ||
        (statusFilter === "MUST_CHANGE" && acc.forcePasswordChange);

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [accounts, search, roleFilter, statusFilter]);

  // Metrics
  const totalCount = accounts.length;
  const activeCount = accounts.filter((a) => !a.suspended && a.failedLogins < 8).length;
  const staffCount = accounts.filter((a) =>
    ["DIRECTOR", "HEAD_TEACHER", "DEPUTY", "SENIOR_TEACHER", "SECRETARY", "ACCOUNTANT", "TEACHER"].includes(a.role)
  ).length;
  const alertCount = accounts.filter((a) => a.suspended || a.failedLogins >= 8).length;
  // The credential notice belongs on the account it was issued for. If the
  // active search/filter hides that card, fall back to showing it above the list.
  const tempVisible = temp ? filteredAccounts.some((account) => account.id === temp.id) : false;

  return (
    <div className="space-y-3">
      <PageHeader
        title="User accounts"
        help="Provision access, monitor security state and review credentials."
        action={
          <button type="button" onClick={() => setShowCreate(!showCreate)} className="btn btn-primary">
            <UserPlus size={16} aria-hidden="true" />
            {showCreate ? "Close" : "Provision account"}
          </button>
        }
      />

      <section aria-label="Account summary"><StatCards columns={4} stats={[
        { label: "Total accounts", value: loading ? "…" : String(totalCount), note: "All roles", icon: RiGroupLine },
        { label: "Active users", value: loading ? "…" : String(activeCount), note: "Can sign in", icon: RiUserFollowLine },
        { label: "Faculty and staff", value: loading ? "…" : String(staffCount), note: "Teachers and leaders", icon: RiShieldUserLine },
        { label: "Needs attention", value: loading ? "…" : String(alertCount), note: "Locked or suspended", icon: RiUserSearchLine },
      ] satisfies Stat[]} /></section>

      {/* Temporary password fallback: only when its account card is filtered out */}
      {temp && !tempVisible ? credentialNotice(temp) : null}

      {/* Error Alert */}
      {error && (
        <div
          role="alert"
          className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-900 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
        >
          <AlertTriangle size={18} className="shrink-0 text-red-600 dark:text-red-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Provision Account Form (Expandable Bento) */}
      {showCreate && (
        <section className="glass dark:glass-dark rounded-3xl border border-blue-200/70 p-6 shadow-md transition-all sm:p-7 dark:border-blue-900/60">
          <div className="mb-5 flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-600 text-white shadow-sm">
              <Sparkles size={18} />
            </span>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Provision New Account
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Create a role-scoped user profile. An initial one-time temporary password will be
                generated.
              </p>
            </div>
          </div>

          <ol aria-label="Account setup steps" className="mb-5 grid grid-cols-3 gap-2">
            {["Identity", "Role", "Staff details"].map((label, index) => (
              <li key={label} aria-current={createStep === index + 1 ? "step" : undefined} className={`rounded-xl border px-3 py-2 text-center text-caption-1-semibold ${createStep === index + 1 ? "border-border-focus-ring bg-background-secondary-default text-text-primary" : "border-separator-border text-text-tertiary"}`}>
                <span className="me-1">{index + 1}.</span>{label}
              </li>
            ))}
          </ol>

          <form ref={createFormRef} onSubmit={create} className="space-y-4">
            <div hidden={createStep !== 1} className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="account-name" className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Full Name <span className="text-blue-600">*</span>
                </label>
                <input
                  required
                  id="account-name"
                  name="name"
                  maxLength={120}
                  placeholder="e.g. Jane Achieng"
                  className="mt-1.5 min-h-11 w-full rounded-2xl border border-slate-200 bg-white/70 px-4 text-sm text-slate-900 shadow-sm transition outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 dark:border-slate-700 dark:bg-slate-900/80 dark:text-white"
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="account-email" className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Email Address <span className="text-blue-600">*</span>
                </label>
                <input
                  required
                  id="account-email"
                  type="email"
                  name="email"
                  placeholder="name@maryroyal.ac.ke"
                  className="mt-1.5 min-h-11 w-full rounded-2xl border border-slate-200 bg-white/70 px-4 text-sm text-slate-900 shadow-sm transition outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 dark:border-slate-700 dark:bg-slate-900/80 dark:text-white"
                />
              </div>
            </div>

            <div hidden={createStep !== 2}>
              <div>
                <label htmlFor="account-role" className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Assigned Role <span className="text-blue-600">*</span>
                </label>
                <select
                  id="account-role"
                  name="role"
                  required
                  className="mt-1.5 min-h-11 w-full rounded-2xl border border-slate-200 bg-white/70 px-4 text-sm text-slate-900 shadow-sm transition outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 dark:border-slate-700 dark:bg-slate-900/80 dark:text-white"
                >
                  {roles.map((r) => (
                    <option key={r} value={r}>
                      {r.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <details hidden={createStep !== 3} className="rounded-2xl border border-separator-border bg-background-secondary-default p-4 transition">
              <summary className="cursor-pointer text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">
                + Staff Details (Optional for Teachers & Faculty)
              </summary>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                    Staff ID
                  </label>
                  <input
                    name="staffNumber"
                    maxLength={40}
                    placeholder="e.g. MRS-024"
                    className="mt-1 min-h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                    TSC Number
                  </label>
                  <input
                    name="tscNumber"
                    maxLength={40}
                    placeholder="e.g. 562910"
                    className="mt-1 min-h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                    Position Title
                  </label>
                  <input
                    name="employmentTitle"
                    maxLength={100}
                    placeholder="e.g. Senior Science Teacher"
                    className="mt-1 min-h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                    Highest Qualifications
                  </label>
                  <input
                    name="qualifications"
                    maxLength={500}
                    placeholder="e.g. B.Ed Science"
                    className="mt-1 min-h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  />
                </div>
              </div>
            </details>

            <div className="flex flex-wrap justify-between gap-3 pt-2">
              <Button type="button" variant="secondary" size="small" onClick={() => { setShowCreate(false); setCreateStep(1); }} className="min-h-11">Cancel</Button>
              <div className="ms-auto flex gap-2">
                {createStep > 1 && <Button type="button" variant="secondary" size="small" onClick={() => setCreateStep(step => Math.max(step - 1, 1))} className="min-h-11">Back</Button>}
                {createStep < 3
                  ? <Button type="button" size="small" onClick={advanceCreateStep} className="min-h-11">Continue</Button>
                  : <Button type="submit" size="small" disabled={saving} className="min-h-11">{saving ? "Creating account…" : "Create account"}</Button>}
              </div>
            </div>
          </form>
        </section>
      )}

      {/* Account Directory Section */}
      <section className="glass dark:glass-dark rounded-3xl border border-slate-200/80 p-6 shadow-sm dark:border-slate-800/80">
        {/* Search & Filter Toolbar */}
        <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 lg:flex-row lg:items-center lg:justify-between dark:border-slate-800">
          <div className="relative max-w-md flex-1">
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email, or role…"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 py-2.5 pl-10 pr-4 text-xs font-medium text-slate-900 transition outline-none focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-600/10 dark:border-slate-700 dark:bg-slate-900/60 dark:text-white dark:focus:bg-slate-900"
            />
          </div>

          {/* Filter Chips */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-2xl border border-slate-200/80 bg-slate-100/70 p-1 dark:border-slate-800 dark:bg-slate-900/60">
              <button
                onClick={() => setRoleFilter("ALL")}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                  roleFilter === "ALL"
                    ? "bg-white text-blue-700 shadow-sm dark:bg-slate-800 dark:text-white"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                All Roles
              </button>
              <button
                onClick={() => setRoleFilter("STAFF")}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                  roleFilter === "STAFF"
                    ? "bg-white text-blue-700 shadow-sm dark:bg-slate-800 dark:text-white"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                Faculty
              </button>
              <button
                onClick={() => setRoleFilter("PARENT")}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                  roleFilter === "PARENT"
                    ? "bg-white text-blue-700 shadow-sm dark:bg-slate-800 dark:text-white"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                Parents
              </button>
              <button
                onClick={() => setRoleFilter("LEARNER")}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                  roleFilter === "LEARNER"
                    ? "bg-white text-blue-700 shadow-sm dark:bg-slate-800 dark:text-white"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                Learners
              </button>
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter accounts by status"
              className="rounded-2xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs font-bold text-slate-700 transition outline-none focus:border-blue-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active Only</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="ARCHIVED">Archived access</option>
              <option value="LOCKED">Locked Out (8+ fails)</option>
              <option value="MUST_CHANGE">Pending Password Change</option>
            </select>
          </div>
        </div>

        {/* Account list */}
      <div className="mt-5">
        {loading ? (
          <LoadingState label="Loading account directory…" hint="Fetching roles, sign-in state and security flags." />
        ) : filteredAccounts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border-button-default p-12 text-center">
            <CircleUserRound className="mx-auto text-foreground-icon-tertiary" size={32} />
            <p className="mt-3 text-body-medium text-text-primary">No matching accounts</p>
            <p className="mt-1 text-body-2-regular text-text-secondary">Try refining your search keyword or role filter.</p>
          </div>
        ) : (
          <>
          <ul className="divide-y divide-separator-border lg:hidden" aria-label="User accounts">
            {filteredAccounts.map((account) => {
              const locked = account.failedLogins >= 8;
              const state = account.suspensionReason === "ARCHIVED" ? "Archived" : account.suspended ? "Suspended" : locked ? "Locked" : account.forcePasswordChange ? "Update needed" : "Active";
              const color = account.suspended || locked ? "rose" : account.forcePasswordChange ? "yellow" : "lime";
              return <li key={account.id} className="space-y-3 py-4">
                {temp?.id === account.id ? credentialNotice(temp) : null}
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-body-medium text-text-primary">{account.name}</p>
                    <p className="truncate text-body-2-regular text-text-secondary" dir="ltr">{account.email}</p>
                  </div>
                  <Chip variant="caption" color="soft">{account.role.replaceAll("_", " ")}</Chip>
                </div>
                <div className="flex items-center gap-2"><Chip variant="caption" color={color}>{state}</Chip>{locked ? <span className="text-caption-1-medium text-text-tertiary">8+ failed sign-ins</span> : null}</div>
                <div className="flex flex-wrap gap-2">
                  {account.suspended && account.suspensionReason !== "ARCHIVED" ? <Button size="small" variant="secondary" disabled={saving} onClick={() => void action(account, "reactivate")}>Reactivate</Button> : !account.suspended ? <Button size="small" variant="secondary" disabled={saving} leadingIcon={LockKeyhole} onClick={() => void action(account, "suspend")}>Suspend</Button> : null}
                  <Button size="small" variant="secondary" disabled={saving} leadingIcon={KeyRound} onClick={() => void action(account, "reset-password")}>Reset key</Button>
                  {locked ? <Button size="small" variant="secondary" disabled={saving} leadingIcon={UnlockKeyhole} onClick={() => void action(account, "unlock")}>Unlock</Button> : null}
                  {account.role !== "DIRECTOR" ? <Button size="small" variant="danger" disabled={saving} leadingIcon={UserX} onClick={() => void action(account, "delete")}>Delete</Button> : null}
                </div>
              </li>;
            })}
          </ul>
          <div className="hidden overflow-x-auto lg:block">
          <Table aria-label="User accounts" selectionMode="none" className="min-w-[820px]">
            <TableHeader>
              <TableColumn id="person" isRowHeader>Account</TableColumn>
              <TableColumn id="role">Role</TableColumn>
              <TableColumn id="status">Access</TableColumn>
              <TableColumn id="actions">Actions</TableColumn>
            </TableHeader>
            <TableBody>
              {filteredAccounts.map((account) => {
                const locked = account.failedLogins >= 8;
                const state = account.suspensionReason === "ARCHIVED" ? "Archived" : account.suspended ? "Suspended" : locked ? "Locked" : account.forcePasswordChange ? "Update needed" : "Active";
                const isStaff = ["DIRECTOR", "HEAD_TEACHER", "DEPUTY", "SENIOR_TEACHER", "SECRETARY", "ACCOUNTANT", "TEACHER"].includes(account.role);
                const color = account.suspended || locked ? "rose" : account.forcePasswordChange ? "yellow" : "lime";
                return (
                  <TableRow key={account.id} id={account.id}>
                    <TableCell>
                      {temp?.id === account.id ? credentialNotice(temp) : null}
                      <div className="min-w-48">
                        <p className="text-body-medium text-text-primary">{isStaff ? <Link href={`/staff/${account.id}`} className="underline-offset-4 hover:underline">{account.name}</Link> : account.name}</p>
                        <p className="text-body-2-regular text-text-secondary" dir="ltr">{account.email}</p>
                      </div>
                    </TableCell>
                    <TableCell><Chip variant="caption" color="soft">{account.role.replaceAll("_", " ")}</Chip></TableCell>
                    <TableCell><Chip variant="caption" color={color}>{state}</Chip>{locked ? <p className="mt-1 text-caption-1-medium text-text-tertiary">8+ failed sign-ins</p> : null}</TableCell>
                    <TableCell><div className="flex max-w-[390px] flex-wrap items-center gap-1.5">
                      {account.suspended && account.suspensionReason !== "ARCHIVED" ? <Button size="small" variant="secondary" disabled={saving} onClick={() => void action(account, "reactivate")}>Reactivate</Button> : !account.suspended ? <Button size="small" variant="secondary" disabled={saving} leadingIcon={LockKeyhole} onClick={() => void action(account, "suspend")}>Suspend</Button> : null}
                      <Button size="small" variant="secondary" disabled={saving} leadingIcon={KeyRound} onClick={() => void action(account, "reset-password")}>Reset key</Button>
                      {locked ? <Button size="small" variant="secondary" disabled={saving} leadingIcon={UnlockKeyhole} onClick={() => void action(account, "unlock")}>Unlock</Button> : null}
                      {account.role !== "DIRECTOR" ? <Button size="small" variant="danger" disabled={saving} leadingIcon={UserX} onClick={() => void action(account, "delete")}>Delete</Button> : null}
                    </div></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          </div>
          </>
        )}
      </div>
      </section>
    </div>
  );
}
