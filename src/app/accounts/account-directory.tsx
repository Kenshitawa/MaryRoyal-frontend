"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Check,
  CircleUserRound,
  Copy,
  KeyRound,
  LockKeyhole,
  Search,
  Shield,
  ShieldAlert,
  Sparkles,
  UnlockKeyhole,
  UserCheck,
  UserPlus,
  Users,
  UserX,
} from "lucide-react";

type Account = {
  id: string;
  name: string;
  email: string;
  role: string;
  suspended: boolean;
  forcePasswordChange: boolean;
  failedLogins: number;
};

const roles = [
  "DIRECTOR",
  "HEAD_TEACHER",
  "DEPUTY",
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
  const [temp, setTemp] = useState("");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

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
      const data = await response.json();
      setAccounts(data.accounts);
    } catch {
      setError("Network error while loading accounts.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setError("");
    setTemp("");
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
      setTemp(`${data.account.email} · ${data.temporaryPassword}`);
      form.reset();
      setShowCreate(false);
      await load();
    } catch {
      setError("Could not connect. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function action(account: Account, actionName: string) {
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
    setTemp("");
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
        setTemp(`${account.email} · ${data.temporaryPassword}`);
      }
      await load();
    } catch {
      setError("Could not connect. Try again.");
    } finally {
      setSaving(false);
    }
  }

  function copyTempPassword() {
    if (!temp) return;
    navigator.clipboard.writeText(temp);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
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
          ? ["DIRECTOR", "HEAD_TEACHER", "DEPUTY", "SECRETARY", "ACCOUNTANT", "TEACHER"].includes(
              acc.role
            )
          : acc.role === roleFilter);

      const isLocked = acc.failedLogins >= 8;
      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "ACTIVE" && !acc.suspended && !isLocked) ||
        (statusFilter === "SUSPENDED" && acc.suspended) ||
        (statusFilter === "LOCKED" && isLocked) ||
        (statusFilter === "MUST_CHANGE" && acc.forcePasswordChange);

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [accounts, search, roleFilter, statusFilter]);

  // Metrics
  const totalCount = accounts.length;
  const activeCount = accounts.filter((a) => !a.suspended && a.failedLogins < 8).length;
  const staffCount = accounts.filter((a) =>
    ["DIRECTOR", "HEAD_TEACHER", "DEPUTY", "SECRETARY", "ACCOUNTANT", "TEACHER"].includes(a.role)
  ).length;
  const alertCount = accounts.filter((a) => a.suspended || a.failedLogins >= 8).length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50/80 px-2.5 py-0.5 text-xs font-semibold text-blue-800 dark:border-blue-800/60 dark:bg-blue-950/40 dark:text-blue-300">
              <Shield size={12} />
              Identity & Access
            </span>
          </div>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl dark:text-white">
            User Accounts
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Provision user access, monitor security state, and audit system credentials.
          </p>
        </div>

        <button
          onClick={() => setShowCreate(!showCreate)}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-700 to-indigo-700 px-5 text-sm font-bold text-white shadow-lg shadow-blue-700/20 transition-all hover:brightness-110 active:scale-95"
        >
          <UserPlus size={16} />
          {showCreate ? "Close Provisioning" : "Provision Account"}
        </button>
      </div>

      {/* KPI Bento Grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="glass dark:glass-dark rounded-3xl border border-slate-200/80 p-5 shadow-sm dark:border-slate-800/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Accounts
            </span>
            <div className="rounded-xl bg-blue-50 p-2 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400">
              <Users size={16} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              {loading ? "…" : totalCount}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">All registered roles</p>
        </div>

        <div className="glass dark:glass-dark rounded-3xl border border-slate-200/80 p-5 shadow-sm dark:border-slate-800/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Active Users
            </span>
            <div className="rounded-xl bg-emerald-50 p-2 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
              <UserCheck size={16} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-700 dark:text-emerald-400">
              {loading ? "…" : activeCount}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Can log in without issue</p>
        </div>

        <div className="glass dark:glass-dark rounded-3xl border border-slate-200/80 p-5 shadow-sm dark:border-slate-800/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Faculty & Staff
            </span>
            <div className="rounded-xl bg-indigo-50 p-2 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-400">
              <Shield size={16} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-indigo-700 dark:text-indigo-400">
              {loading ? "…" : staffCount}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Teachers & leaders</p>
        </div>

        <div className="glass dark:glass-dark rounded-3xl border border-slate-200/80 p-5 shadow-sm dark:border-slate-800/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Attention Required
            </span>
            <div className="rounded-xl bg-amber-50 p-2 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400">
              <UserX size={16} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-amber-700 dark:text-amber-400">
              {loading ? "…" : alertCount}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Locked or suspended</p>
        </div>
      </div>

      {/* Temporary Password Notification Banner */}
      {temp && (
        <div
          role="status"
          className="relative overflow-hidden rounded-3xl border border-emerald-300/80 bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 p-6 shadow-sm dark:border-emerald-800/80 dark:from-emerald-950/50 dark:via-teal-950/30 dark:to-emerald-950/50"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-emerald-600 text-white shadow-md shadow-emerald-600/30">
                <Check size={22} />
              </span>
              <div>
                <h3 className="font-bold text-emerald-950 dark:text-emerald-200">
                  Temporary Password Generated
                </h3>
                <p className="mt-1 font-mono text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                  {temp}
                </p>
                <p className="mt-1.5 text-xs text-emerald-700 dark:text-emerald-400">
                  Share this credential securely with the user. They must set a personal password upon
                  first sign in.
                </p>
              </div>
            </div>
            <button
              onClick={copyTempPassword}
              className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-xs font-bold text-emerald-900 shadow-sm transition hover:bg-emerald-100 dark:bg-emerald-900 dark:text-emerald-100 dark:hover:bg-emerald-800"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? "Copied to Clipboard!" : "Copy Credential"}
            </button>
          </div>
        </div>
      )}

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

          <form onSubmit={create} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
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

              <div>
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

              <div>
                <label htmlFor="account-role" className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Assigned Role <span className="text-blue-600">*</span>
                </label>
                <select
                  id="account-role"
                  name="role"
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

            <details className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 transition dark:border-slate-800 dark:bg-slate-900/50">
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

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-700 px-6 text-xs font-bold text-white shadow-md shadow-blue-700/20 transition hover:bg-blue-800 disabled:opacity-50"
              >
                <UserPlus size={15} />
                {saving ? "Creating…" : "Save Account"}
              </button>
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
              <option value="LOCKED">Locked Out (8+ fails)</option>
              <option value="MUST_CHANGE">Pending Password Change</option>
            </select>
          </div>
        </div>

        {/* Account Cards Grid */}
        <div className="mt-5">
          {loading ? (
            <div className="py-16 text-center">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
              <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Loading directory…</p>
            </div>
          ) : filteredAccounts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 p-12 text-center dark:border-slate-800">
              <CircleUserRound className="mx-auto text-slate-400" size={32} />
              <p className="mt-3 text-sm font-bold text-slate-900 dark:text-white">
                No matching accounts
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Try refining your search keyword or active role filter.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {filteredAccounts.map((account) => {
                const locked = account.failedLogins >= 8;
                const state = account.suspended
                  ? "Suspended"
                  : locked
                  ? "Locked"
                  : account.forcePasswordChange
                  ? "Update Needed"
                  : "Active";

                const isStaff = [
                  "DIRECTOR",
                  "HEAD_TEACHER",
                  "DEPUTY",
                  "SECRETARY",
                  "ACCOUNTANT",
                  "TEACHER",
                ].includes(account.role);

                return (
                  <article
                    key={account.id}
                    className={`group relative flex min-w-0 flex-col justify-between rounded-2xl border p-4 transition-all hover:shadow-md ${
                      account.suspended || locked
                        ? "border-red-200 bg-red-50/20 dark:border-red-900/40 dark:bg-red-950/20"
                        : "border-slate-200/80 bg-white/70 hover:border-blue-200 dark:border-slate-800 dark:bg-slate-900/50 dark:hover:border-slate-700"
                    }`}
                  >
                    <div>
                      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <span
                            className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl font-bold ${
                              account.suspended || locked
                                ? "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400"
                                : "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400"
                            }`}
                          >
                            {account.name.charAt(0).toUpperCase()}
                          </span>
                          <div className="min-w-0">
                            <h3 className="truncate text-sm font-black text-slate-900 dark:text-white">
                              {isStaff ? (
                                <Link
                                  href={`/staff/${account.id}`}
                                  className="transition hover:text-blue-600 hover:underline dark:hover:text-blue-400"
                                >
                                  {account.name}
                                </Link>
                              ) : (
                                account.name
                              )}
                            </h3>
                            <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                              {account.email}
                            </p>
                          </div>
                        </div>

                        <span className="max-w-full break-words rounded-full bg-slate-100 px-2.5 py-1 text-center text-[10px] font-bold tracking-wider text-slate-600 uppercase dark:bg-slate-800 dark:text-slate-300 sm:max-w-[45%]">
                          {account.role.replaceAll("_", " ")}
                        </span>
                      </div>

                      <div className="mt-3.5 flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${
                            account.suspended || locked
                              ? "border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
                              : account.forcePasswordChange
                              ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300"
                              : "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
                          }`}
                        >
                          {account.suspended || locked ? (
                            <ShieldAlert size={12} />
                          ) : account.forcePasswordChange ? (
                            <KeyRound size={12} />
                          ) : (
                            <Check size={12} />
                          )}
                          {state}
                        </span>

                        {locked && (
                          <span className="text-[10px] font-semibold text-red-600 dark:text-red-400">
                            8+ failed logins
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 dark:border-slate-800/80">
                      {account.suspended ? (
                        <button
                          disabled={saving}
                          onClick={() => void action(account, "reactivate")}
                          className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 transition hover:bg-emerald-100 dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:text-emerald-300"
                        >
                          Reactivate
                        </button>
                      ) : (
                        <button
                          disabled={saving}
                          onClick={() => void action(account, "suspend")}
                          className="inline-flex items-center gap-1 rounded-xl border border-red-200 bg-red-50/70 px-3 py-1.5 text-xs font-bold text-red-700 transition hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300"
                        >
                          <LockKeyhole size={12} />
                          Suspend
                        </button>
                      )}

                      <button
                        disabled={saving}
                        onClick={() => void action(account, "reset-password")}
                        className="inline-flex items-center gap-1 rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-1.5 text-xs font-bold text-amber-900 transition hover:bg-amber-100 dark:border-amber-900/60 dark:bg-amber-950/50 dark:text-amber-300"
                      >
                        <KeyRound size={12} />
                        Reset Key
                      </button>

                      {locked && (
                        <button
                          disabled={saving}
                          onClick={() => void action(account, "unlock")}
                          className="inline-flex items-center gap-1 rounded-xl border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-800 transition hover:bg-blue-100 dark:border-blue-900/60 dark:bg-blue-950/50 dark:text-blue-300"
                        >
                          <UnlockKeyhole size={12} />
                          Unlock
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
