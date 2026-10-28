"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Copy,
  GraduationCap,
  KeyRound,
  Plus,
  Printer,
  Search,
  UserCheck,
  Users,
  ChevronRight,
} from "lucide-react";
import { LearnerLink } from "@/components/learner-link";

type Learner = {
  id: string;
  admissionNo: string;
  name: string;
  grade: string;
  gender?: string;
  admissionStatus?: string;
  hasLearnerLogin?: boolean;
};

type Credentials = {
  name: string;
  admissionNo: string;
  email: string;
  temporaryPassword: string;
  suspended: boolean;
};

export default function LearnerDirectory({
  canCreate,
  canApprove = false,
  identityOnly = false,
}: {
  canCreate: boolean;
  canApprove?: boolean;
  identityOnly?: boolean;
}) {
  const [rows, setRows] = useState<Learner[]>([]);
  const [search, setSearch] = useState("");
  const [gradeFilter, setGradeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (query: string) => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/learners?take=100${query ? `&q=${encodeURIComponent(query)}` : ""}`
      );
      if (!response.ok) {
        throw new Error(
          response.status === 403
            ? "Your account does not have access to the learner directory."
            : "Could not load learners."
        );
      }
      const data = await response.json();
      setRows(data.learners);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load learners.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void load(search), 220);
    return () => clearTimeout(timer);
  }, [search, load]);

  async function createLogin(learner: Learner) {
    setSaving(true);
    setError("");
    setNotice("");
    setCredentials(null);
    try {
      const response = await fetch(`/api/learners/${learner.id}/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not create learner login.");
      setCredentials({
        name: learner.name,
        admissionNo: learner.admissionNo,
        email: data.account.email,
        temporaryPassword: data.temporaryPassword,
        suspended: data.account.suspended,
      });
      setNotice(`Learner portal credentials generated for ${learner.name}.`);
      setRows((current) =>
        current.map((row) => (row.id === learner.id ? { ...row, hasLearnerLogin: true } : row))
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create learner login.");
    } finally {
      setSaving(false);
    }
  }

  async function approve(learner: Learner) {
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/learners/${learner.id}/workflow`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Admission could not be approved.");
      setNotice(`${learner.name}'s admission was endorsed and approved.`);
      await load(search);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Admission could not be approved.");
    } finally {
      setSaving(false);
    }
  }

  function copyCredentials() {
    if (!credentials) return;
    navigator.clipboard.writeText(
      `Learner: ${credentials.name} (${credentials.admissionNo})\nEmail: ${credentials.email}\nTemp Password: ${credentials.temporaryPassword}`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function printCredentials() {
    if (!credentials) return;
    const printWindow = window.open("", "_blank", "width=700,height=760");
    if (!printWindow) {
      setError("Allow pop-up windows to print the learner credential slip.");
      return;
    }
    const doc = printWindow.document;
    doc.title = "Mary Royal School · Learner credentials";
    const style = doc.createElement("style");
    style.textContent =
      "body{margin:0;padding:40px;background:#f1f5f9;font:16px Arial,sans-serif;color:#10233f}.slip{max-width:560px;margin:0 auto;padding:36px;background:#fff;border:1px solid #dbeafe;border-radius:20px}.brand{display:flex;align-items:center;gap:14px;border-bottom:2px solid #1d4ed8;padding-bottom:20px}.brand img{width:56px;height:56px;object-fit:contain}.brand h1{font-size:20px;margin:0}.brand p{margin:5px 0 0;color:#475569}.label{margin:24px 0 4px;color:#475569;font-size:12px;text-transform:uppercase;letter-spacing:1px}.value{font-size:18px;font-weight:bold;overflow-wrap:anywhere}.pass{padding:14px;background:#eff6ff;border-radius:12px;font:700 20px monospace;overflow-wrap:anywhere}.note{margin-top:26px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:12px;color:#475569}@media print{body{padding:0;background:#fff}.slip{border:1px solid #94a3b8;box-shadow:none}}";
    doc.head.append(style);
    const slip = doc.createElement("main");
    slip.className = "slip";
    const brand = doc.createElement("header");
    brand.className = "brand";
    const logo = doc.createElement("img");
    logo.src = "/mary-royal-logo.png";
    logo.alt = "Mary Royal School";
    const identity = doc.createElement("div");
    const school = doc.createElement("h1");
    school.textContent = "Mary Royal School";
    const motto = doc.createElement("p");
    motto.textContent = "Hard work pays · Obunga, Kisumu";
    identity.append(school, motto);
    brand.append(logo, identity);
    slip.append(brand);
    const heading = doc.createElement("h2");
    heading.textContent = "Learner sign-in details";
    heading.style.marginTop = "26px";
    slip.append(heading);
    for (const [label, value] of [
      ["Learner", credentials.name],
      ["Admission number", credentials.admissionNo],
      ["Sign-in email", credentials.email],
      ["Temporary password", credentials.temporaryPassword],
    ]) {
      const key = doc.createElement("p");
      key.className = "label";
      key.textContent = label;
      const detail = doc.createElement("p");
      detail.className = label === "Temporary password" ? "pass" : "value";
      detail.textContent = value;
      slip.append(key, detail);
    }
    const note = doc.createElement("p");
    note.className = "note";
    note.textContent = `${
      credentials.suspended
        ? "This login is suspended until the Head Teacher approves the admission. "
        : ""
    }The learner must change the temporary password at first sign-in. Keep these details private.`;
    slip.append(note);
    doc.body.replaceChildren(slip);
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 300);
  }

  // Filtered rows
  const filteredRows = useMemo(() => {
    return rows.filter((l) => {
      const matchesGrade = gradeFilter === "ALL" || l.grade === gradeFilter;
      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "APPROVED" && l.admissionStatus === "APPROVED") ||
        (statusFilter === "PENDING" && l.admissionStatus === "PENDING");
      return matchesGrade && matchesStatus;
    });
  }, [rows, gradeFilter, statusFilter]);

  // Unique grades in results
  const grades = useMemo(() => {
    return Array.from(new Set(rows.map((r) => r.grade))).sort();
  }, [rows]);

  const approvedCount = rows.filter((r) => r.admissionStatus === "APPROVED").length;
  const pendingCount = rows.filter((r) => r.admissionStatus === "PENDING").length;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50/80 px-2.5 py-0.5 text-xs font-semibold text-blue-800 dark:border-blue-800/60 dark:bg-blue-950/40 dark:text-blue-300">
              <GraduationCap size={12} />
              Enrolment &amp; Register
            </span>
          </div>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl dark:text-white">
            School Learner Register
          </h1>
          <p className="mt-1 text-xs text-slate-500 sm:text-sm dark:text-slate-400">
            {identityOnly
              ? "Official learner identity records and fee balances."
              : "Search learners, review profiles, verify admission status, and provision digital credentials."}
          </p>
        </div>

        {canCreate && (
          <Link
            href="/admissions/new"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-700 to-indigo-700 px-5 text-xs font-bold text-white shadow-md shadow-blue-700/20 transition hover:brightness-110 active:scale-95"
          >
            <Plus size={15} />
            + Full admission
          </Link>
        )}
      </div>

      {/* KPI Bento Grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="glass dark:glass-dark rounded-3xl border border-slate-200/80 p-5 shadow-sm dark:border-slate-800/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Enrolled Pupils
            </span>
            <div className="rounded-xl bg-blue-50 p-2 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400">
              <Users size={16} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              {busy ? "…" : rows.length}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Across all grades</p>
        </div>

        <div className="glass dark:glass-dark rounded-3xl border border-slate-200/80 p-5 shadow-sm dark:border-slate-800/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Approved
            </span>
            <div className="rounded-xl bg-emerald-50 p-2 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
              <UserCheck size={16} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-700 dark:text-emerald-400">
              {busy ? "…" : approvedCount}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Fully enrolled pupils</p>
        </div>

        <div className="glass dark:glass-dark rounded-3xl border border-slate-200/80 p-5 shadow-sm dark:border-slate-800/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Pending Approval
            </span>
            <div className="rounded-xl bg-amber-50 p-2 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400">
              <Clock size={16} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-amber-700 dark:text-amber-400">
              {busy ? "…" : pendingCount}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Awaiting Head Teacher</p>
        </div>

        <div className="glass dark:glass-dark rounded-3xl border border-slate-200/80 p-5 shadow-sm dark:border-slate-800/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Grade Bands
            </span>
            <div className="rounded-xl bg-purple-50 p-2 text-purple-700 dark:bg-purple-950/60 dark:text-purple-400">
              <GraduationCap size={16} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-purple-700 dark:text-purple-400">
              {grades.length}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Classes represented</p>
        </div>
      </div>

      {notice && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50/90 p-4 text-xs font-semibold text-emerald-900 shadow-sm dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
        >
          <CheckCircle2 size={16} className="shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-900 shadow-sm dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
        >
          <AlertCircle size={16} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Generated Credentials Banner */}
      {credentials && (
        <section
          className="relative overflow-hidden rounded-3xl border border-blue-300 bg-gradient-to-r from-blue-50 via-indigo-50 to-blue-50 p-6 shadow-sm dark:border-blue-800 dark:from-blue-950/50 dark:via-indigo-950/30 dark:to-blue-950/50"
          aria-label="New learner credentials"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-800 dark:text-blue-300">
                Temporary Student Credential Slip
              </span>
              <h2 className="mt-1 text-lg font-black text-slate-900 dark:text-white">
                {credentials.name} · {credentials.admissionNo}
              </h2>
              <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                Email: <span className="font-mono font-bold">{credentials.email}</span>
              </p>
              <p className="mt-2 inline-block rounded-xl bg-white px-3 py-1.5 font-mono text-sm font-black text-blue-900 shadow-xs dark:bg-slate-900 dark:text-white">
                Password: {credentials.temporaryPassword}
              </p>
              <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                {credentials.suspended
                  ? "The account will activate upon official Head Teacher admission approval."
                  : "The student must change this password on first sign-in."}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={copyCredentials}
                type="button"
                className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-white px-3.5 py-2 text-xs font-bold text-blue-900 shadow-xs hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              >
                <Copy size={13} />
                {copied ? "Copied!" : "Copy Slip"}
              </button>

              <button
                onClick={printCredentials}
                type="button"
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-700 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-800"
              >
                <Printer size={13} />
                Print Sign-In Slip
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Main Register Section */}
      <section className="glass dark:glass-dark rounded-3xl border border-slate-200/80 p-6 shadow-sm dark:border-slate-800/80">
        {/* Filters Toolbar */}
        <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 lg:flex-row lg:items-center lg:justify-between dark:border-slate-800">
          <div className="relative max-w-md flex-1">
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, admission number, or grade…"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 py-2.5 pl-10 pr-4 text-xs font-medium text-slate-900 outline-none focus:border-blue-600 focus:bg-white dark:border-slate-700 dark:bg-slate-900/60 dark:text-white"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Grade Filter */}
            {grades.length > 0 && (
              <select
                value={gradeFilter}
                onChange={(e) => setGradeFilter(e.target.value)}
                aria-label="Filter learners by class"
                className="rounded-2xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs font-bold text-slate-700 outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
              >
                <option value="ALL">All Classes ({rows.length})</option>
                {grades.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            )}

            {!identityOnly && (
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Filter learners by admission status"
                className="rounded-2xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs font-bold text-slate-700 outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
              >
                <option value="ALL">All Statuses</option>
                <option value="APPROVED">Approved Only</option>
                <option value="PENDING">Pending Approval</option>
              </select>
            )}
          </div>
        </div>

        {/* Learner Register Table */}
        <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-slate-800">
          <table className="w-full min-w-[760px] text-left text-xs">
            <thead>
              <tr className="bg-slate-50/80 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:bg-slate-900/80 dark:text-slate-400">
                <th className="px-5 py-3.5">Admission No.</th>
                <th className="px-5 py-3.5">Learner Name</th>
                <th className="px-5 py-3.5">Class / Grade</th>
                {!identityOnly && (
                  <>
                    <th className="px-5 py-3.5">Gender</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5">Portal Access</th>
                    {canApprove && <th className="px-5 py-3.5">Actions</th>}
                    <th className="px-5 py-3.5 text-right">Profile</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {busy ? (
                <tr>
                  <td
                    colSpan={identityOnly ? 3 : canApprove ? 8 : 7}
                    className="p-12 text-center text-slate-500"
                  >
                    <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                    <p className="mt-2 text-xs">Loading learner records…</p>
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={identityOnly ? 3 : canApprove ? 8 : 7}
                    className="p-12 text-center text-slate-500"
                  >
                    No learners found matching the search criteria.
                  </td>
                </tr>
              ) : (
                filteredRows.map((learner) => {
                  const isApproved = learner.admissionStatus === "APPROVED";
                  return (
                    <tr
                      key={learner.id}
                      className="transition-colors hover:bg-slate-50/60 dark:hover:bg-slate-900/40"
                    >
                      <td className="whitespace-nowrap px-5 py-4 font-mono font-bold text-blue-700 dark:text-blue-400">
                        <LearnerLink
                          id={learner.id}
                          admissionNo={learner.admissionNo}
                          showAdmissionNo={true}
                        />
                      </td>

                      <td className="px-5 py-4 font-black text-slate-900 dark:text-white">
                        <LearnerLink id={learner.id} name={learner.name} showAdmissionNo={false} />
                      </td>

                      <td className="px-5 py-4">
                        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          {learner.grade}
                        </span>
                      </td>

                      {!identityOnly && (
                        <>
                          <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                            {learner.gender ?? "—"}
                          </td>

                          <td className="px-5 py-4">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                                isApproved
                                  ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                                  : "bg-amber-50 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300"
                              }`}
                            >
                              {isApproved ? <CheckCircle2 size={11} /> : <Clock size={11} />}
                              {learner.admissionStatus}
                            </span>
                          </td>

                          <td className="px-5 py-4">
                            {learner.hasLearnerLogin ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                                <CheckCircle2 size={12} />
                                Active
                              </span>
                            ) : canCreate ? (
                              <button
                                disabled={saving}
                                onClick={() => void createLogin(learner)}
                                className="inline-flex min-h-8 items-center gap-1 rounded-xl border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-800 transition hover:bg-blue-100 disabled:opacity-50 dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-300"
                              >
                                <KeyRound size={11} />
                                Create Login
                              </button>
                            ) : (
                              <span className="text-[11px] text-slate-400">Not provisioned</span>
                            )}
                          </td>

                          {canApprove && (
                            <td className="px-5 py-4">
                              {learner.admissionStatus === "PENDING" && (
                                <button
                                  disabled={saving}
                                  onClick={() => void approve(learner)}
                                  className="inline-flex min-h-8 items-center gap-1 rounded-xl bg-blue-700 px-3 text-xs font-bold text-white shadow-xs transition hover:bg-blue-800 disabled:opacity-50"
                                >
                                  <CheckCircle2 size={12} />
                                  Approve
                                </button>
                              )}
                            </td>
                          )}

                          <td className="px-5 py-4 text-right">
                            <Link
                              href={`/learners/${learner.id}`}
                              className="inline-flex min-h-8 items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-blue-700 shadow-xs transition hover:border-blue-400 hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-900 dark:text-blue-400 dark:hover:bg-slate-800"
                            >
                              <span>View Profile</span>
                              <ChevronRight size={13} />
                            </Link>
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
