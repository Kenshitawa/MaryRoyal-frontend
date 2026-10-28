"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Users,
  Search,
  Filter,
  UserPlus,
  Download,
  Upload,
  Mail,
  Phone,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  X,
  Copy,
  Check,
} from "lucide-react";

interface StaffMember {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  avatarUrl?: string | null;
  role: string;
  suspended: boolean;
  staffNumber?: string | null;
  tscNumber?: string | null;
  employmentTitle?: string | null;
  qualifications?: string | null;
  createdAt: string | Date;
  staffProfile?: {
    department?: string | null;
    employmentType?: string | null;
  } | null;
}

interface StaffDirectoryClientProps {
  initialStaff: StaffMember[];
  canCreate: boolean;
  canExport: boolean;
  userRole: string;
}

export function StaffDirectoryClient({
  initialStaff,
  canCreate,
  canExport,
}: StaffDirectoryClientProps) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Bulk Import modal state
  const [showImport, setShowImport] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [previewData, setPreviewData] = useState<{
    validCount: number;
    totalCount: number;
    errors: { row: number; field: string; message: string }[];
    preview: Record<string, string | number | null>[];
  } | null>(null);
  const [importResult, setImportResult] = useState<{
    count: number;
    credentials: { name: string; email: string; role: string; temporaryPassword: string }[];
  } | null>(null);
  const [importError, setImportError] = useState("");
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const roles = [
    { label: "All Roles", value: "ALL" },
    { label: "Head Teacher", value: "HEAD_TEACHER" },
    { label: "Deputy", value: "DEPUTY" },
    { label: "Secretary", value: "SECRETARY" },
    { label: "Accountant", value: "ACCOUNTANT" },
    { label: "Teacher", value: "TEACHER" },
    { label: "Welfare Chair", value: "WELFARE_CHAIR" },
    { label: "Non-Teaching", value: "NON_TEACHING_STAFF" },
  ];

  const filteredStaff = initialStaff.filter((member) => {
    if (roleFilter !== "ALL" && member.role !== roleFilter) return false;
    if (statusFilter === "ACTIVE" && member.suspended) return false;
    if (statusFilter === "SUSPENDED" && !member.suspended) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchName = member.name.toLowerCase().includes(q);
      const matchEmail = member.email.toLowerCase().includes(q);
      const matchStaffNo = member.staffNumber?.toLowerCase().includes(q);
      const matchTsc = member.tscNumber?.toLowerCase().includes(q);
      const matchPhone = member.phone?.toLowerCase().includes(q);
      return matchName || matchEmail || matchStaffNo || matchTsc || matchPhone;
    }
    return true;
  });

  async function handlePreviewCSV(file: File) {
    setImportError("");
    setImportLoading(true);
    setPreviewData(null);
    setImportResult(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("action", "preview");

    try {
      const res = await fetch("/api/staff/import", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setImportError(data.error || "Failed to parse CSV file.");
      } else {
        setPreviewData(data);
      }
    } catch {
      setImportError("Network error while verifying CSV file.");
    } finally {
      setImportLoading(false);
    }
  }

  async function handleCommitImport() {
    if (!importFile) return;
    setImportError("");
    setImportLoading(true);

    const formData = new FormData();
    formData.append("file", importFile);
    formData.append("action", "commit");

    try {
      const res = await fetch("/api/staff/import", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setImportError(data.error || "Failed to commit staff import.");
      } else {
        setImportResult(data);
        setPreviewData(null);
      }
    } catch {
      setImportError("Network error while importing staff.");
    } finally {
      setImportLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Controls: Search, Filters, and Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
          <input
            type="text"
            placeholder="Search by name, email, phone, staff or TSC #..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-xs font-medium text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:focus:border-blue-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canExport && (
            <a
              href={`/api/staff/export?role=${roleFilter}&status=${statusFilter}`}
              download
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Download size={14} className="text-slate-500" />
              Export CSV
            </a>
          )}

          {canCreate && (
            <>
              <button
                onClick={() => {
                  setShowImport(true);
                  setImportFile(null);
                  setPreviewData(null);
                  setImportResult(null);
                  setImportError("");
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <Upload size={14} className="text-slate-500" />
                Bulk Import
              </button>

              <Link
                href="/staff/new"
                className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <UserPlus size={15} />
                Add Staff Member
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Role Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {roles.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setRoleFilter(tab.value)}
            className={`whitespace-nowrap rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
              roleFilter === tab.value
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
            }`}
          >
            {tab.label}
          </button>
        ))}

        <div className="ml-auto flex items-center gap-1 shrink-0">
          <button
            onClick={() => setStatusFilter(statusFilter === "ALL" ? "ACTIVE" : statusFilter === "ACTIVE" ? "SUSPENDED" : "ALL")}
            className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
          >
            <Filter size={11} />
            Status: {statusFilter}
          </button>
        </div>
      </div>

      {/* Staff Grid */}
      {filteredStaff.length > 0 ? (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredStaff.map((member) => (
            <Link
              key={member.id}
              href={`/staff/${member.id}`}
              className="bento-card group flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white/95 p-5 shadow-sm backdrop-blur transition hover:-translate-y-1 hover:border-blue-300 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900/90 dark:hover:border-blue-700"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  {member.avatarUrl ? (
                    <Image
                      src={member.avatarUrl}
                      alt={member.name}
                      width={48}
                      height={48}
                      unoptimized
                      className="h-12 w-12 rounded-xl object-cover border border-slate-200 dark:border-slate-700"
                    />
                  ) : (
                    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-blue-50 text-base font-black text-blue-700 dark:bg-blue-950/80 dark:text-blue-300">
                      {member.name
                        .split(/\s+/)
                        .map((p) => p[0])
                        .slice(0, 2)
                        .join("")
                        .toUpperCase()}
                    </div>
                  )}

                  <div className="flex flex-col items-end gap-1">
                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
                      {member.role.replaceAll("_", " ")}
                    </span>
                    {member.suspended && (
                      <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[9px] font-bold uppercase text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
                        Suspended
                      </span>
                    )}
                  </div>
                </div>

                <h2 className="mt-3 truncate text-base font-bold text-slate-900 group-hover:text-blue-700 dark:text-white dark:group-hover:text-blue-400">
                  {member.name}
                </h2>

                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {member.employmentTitle || (member.staffProfile?.department ? `${member.staffProfile.department} Department` : "Staff Member")}
                </p>

                <div className="mt-3 space-y-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <p className="flex items-center gap-1.5 truncate">
                    <Mail size={13} className="shrink-0 text-slate-400" />
                    {member.email}
                  </p>
                  {member.phone && (
                    <p className="flex items-center gap-1.5 truncate">
                      <Phone size={13} className="shrink-0 text-slate-400" />
                      {member.phone}
                    </p>
                  )}
                  {member.staffNumber && (
                    <p className="text-[11px] font-mono text-slate-400">
                      ID: {member.staffNumber} {member.tscNumber ? `· TSC: ${member.tscNumber}` : ""}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-3 text-xs font-semibold text-blue-700 dark:border-slate-800 dark:text-blue-400">
                <span>View Full Profile</span>
                <ArrowRight size={14} className="transition group-hover:translate-x-1" />
              </div>
            </Link>
          ))}
        </section>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900/50">
          <Users size={36} className="mx-auto text-slate-300 dark:text-slate-600" />
          <h3 className="mt-3 text-sm font-bold text-slate-800 dark:text-slate-200">No staff members found</h3>
          <p className="mt-1 text-xs text-slate-500">
            {search ? `No staff matched "${search}". Try adjusting your filters.` : "Get started by adding staff members."}
          </p>
        </div>
      )}

      {/* Bulk Import Modal */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <button
              onClick={() => setShowImport(false)}
              className="absolute right-5 top-5 grid h-8 w-8 place-items-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400">
                <FileSpreadsheet size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Bulk Staff CSV Import</h3>
                <p className="text-xs text-slate-500">Upload faculty and staff records from an Excel or CSV spreadsheet</p>
              </div>
            </div>

            {importError && (
              <div className="mt-4 flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-xs text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
                <AlertCircle size={15} className="shrink-0" />
                <span>{importError}</span>
              </div>
            )}

            {!importResult ? (
              <div className="mt-6 space-y-4">
                {/* Step 1: Template */}
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/40">
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">1. Download Template</h4>
                  <p className="mt-1 text-xs text-slate-500">
                    Use our standardized CSV template with preconfigured columns for staff bio, statutory details, and contact numbers.
                  </p>
                  <a
                    href="/api/staff/template"
                    download
                    className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-blue-700 shadow-sm hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-900 dark:text-blue-400"
                  >
                    <Download size={13} />
                    Download CSV Template
                  </a>
                </div>

                {/* Step 2: Upload */}
                <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center dark:border-slate-800">
                  <input
                    type="file"
                    id="csv-upload-input"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        setImportFile(f);
                        void handlePreviewCSV(f);
                      }
                    }}
                  />
                  <label
                    htmlFor="csv-upload-input"
                    className="cursor-pointer flex flex-col items-center justify-center gap-2"
                  >
                    <Upload size={28} className="text-blue-600 dark:text-blue-400" />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {importFile ? importFile.name : "Choose CSV File or drag and drop here"}
                    </span>
                    <span className="text-[11px] text-slate-400">Supported format: .csv (up to 4MB)</span>
                  </label>
                </div>

                {/* Step 3: Preview */}
                {previewData && (
                  <div className="space-y-3 rounded-2xl border border-blue-100 bg-blue-50/50 p-4 dark:border-blue-900/40 dark:bg-blue-950/20">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">Validation Summary</span>
                      <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                        {previewData.validCount} of {previewData.totalCount} records valid
                      </span>
                    </div>

                    {previewData.errors.length > 0 && (
                      <div className="max-h-32 overflow-y-auto space-y-1 rounded-xl bg-white p-2 text-[11px] dark:bg-slate-900">
                        {previewData.errors.map((err, idx) => (
                          <p key={idx} className="text-rose-600 dark:text-rose-400">
                            Row {err.row}: <span className="font-semibold">{err.field}</span> — {err.message}
                          </p>
                        ))}
                      </div>
                    )}

                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        onClick={() => {
                          setPreviewData(null);
                          setImportFile(null);
                        }}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
                      >
                        Reset
                      </button>
                      <button
                        onClick={() => void handleCommitImport()}
                        disabled={importLoading || previewData.errors.length > 0}
                        className="rounded-xl bg-blue-700 px-4 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-blue-800 disabled:opacity-50"
                      >
                        {importLoading ? "Importing..." : `Commit & Import ${previewData.validCount} Staff`}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Success / Credentials Slip */
              <div className="mt-6 space-y-4">
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={18} className="text-emerald-600 dark:text-emerald-400" />
                    <h4 className="text-sm font-bold">Successfully imported {importResult.count} staff accounts!</h4>
                  </div>
                  <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">
                    One-time credentials generated below. Please print or securely distribute credentials slips. Staff will be forced to change password at first sign-in.
                  </p>
                </div>

                <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white text-xs dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
                  {importResult.credentials.map((cred, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3">
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white">{cred.name}</p>
                        <p className="text-slate-500 text-[11px]">{cred.email} · {cred.role}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold bg-slate-100 px-2 py-1 rounded-lg text-slate-800 dark:bg-slate-800 dark:text-slate-200">
                          {cred.temporaryPassword}
                        </span>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(`${cred.email} : ${cred.temporaryPassword}`);
                            setCopiedIndex(idx);
                            setTimeout(() => setCopiedIndex(null), 2000);
                          }}
                          className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 dark:hover:bg-slate-800"
                        >
                          {copiedIndex === idx ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => {
                      setShowImport(false);
                      window.location.reload();
                    }}
                    className="rounded-xl bg-blue-700 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-800"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
