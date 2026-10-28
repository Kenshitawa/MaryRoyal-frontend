"use client";

import { useState } from "react";
import Image from "next/image";
import {
  User,
  Briefcase,
  GraduationCap,
  FileText,
  Calendar,
  Clock,
  Activity,
  Lock,
  Download,
  Edit3,
  ShieldCheck,
  ShieldAlert,
  X,
  CalendarCheck,
  Building,
} from "lucide-react";

type DateLike = Date | string;

interface StaffProfileInfo {
  gender?: string | null;
  dateOfBirth?: DateLike | null;
  nationalId?: string | null;
  nationality?: string | null;
  maritalStatus?: string | null;
  alternatePhone?: string | null;
  residenceAddress?: string | null;
  county?: string | null;
  dateJoined?: DateLike | null;
  employmentType?: string | null;
  department?: string | null;
  lineManager?: string | null;
  probationEndDate?: DateLike | null;
  educationHistory?: string | null;
  professionalQualifications?: string | null;
  certificates?: string | null;
  specializations?: string | null;
  yearsOfExperience?: number | null;
  previousEmployers?: string | null;
  kraPin?: string | null;
  nssfNumber?: string | null;
  shaNumber?: string | null;
  bankName?: string | null;
  bankAccountName?: string | null;
  bankAccountNumber?: string | null;
  bankBranch?: string | null;
  emergencyContacts?: { id: string; fullName: string; relationship: string; phone: string; isNextOfKin: boolean }[];
  referees?: { id: string; fullName: string; organization: string; title: string | null; phone: string; email: string | null }[];
  documents?: { id: string; category: string; originalName: string; sizeBytes: number; createdAt: DateLike }[];
  editHistory?: { id: string; field: string; oldValue: string | null; newValue: string | null; createdAt: DateLike; actor: { name: string; role: string } }[];
}

export interface StaffProfileClientData {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  role: string;
  suspended: boolean;
  staffNumber: string | null;
  tscNumber: string | null;
  employmentTitle: string | null;
  qualifications: string | null;
  staffProfile: StaffProfileInfo | null;
  assignments: { grade: string; subject: string }[];
  classTeacherAssignments: { grade: string }[];
}

interface StaffProfileClientProps {
  staff: StaffProfileClientData;
  actor: { id: string; role: string; name: string };
  canEdit: boolean;
  canViewStatutory: boolean;
  canEditStatutory: boolean;
  payroll: { period: string; status: string; netAmount: number }[];
  teachingLogs: { topics: string; reflection: string | null; grade: string; subject: string; status: string; createdAt: DateLike }[];
  attendance: { date: DateLike; status: string; checkInAt: DateLike | null; note: string | null }[];
}

function toDate(value: DateLike): Date {
  return value instanceof Date ? value : new Date(value);
}

export function StaffProfileClient({
  staff,
  actor,
  canEdit,
  canViewStatutory,
  canEditStatutory,
  payroll,
  teachingLogs,
  attendance,
}: StaffProfileClientProps) {
  const [activeTab, setActiveTab] = useState<string>("Biography");
  const [showEditModal, setShowEditModal] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState("");
  const [editSuccess, setEditSuccess] = useState(false);

  // Edit form state
  const [editForm, setEditForm] = useState({
    name: staff.name,
    phone: staff.phone || "",
    staffNumber: staff.staffNumber || "",
    tscNumber: staff.tscNumber || "",
    employmentTitle: staff.employmentTitle || "",
    department: staff.staffProfile?.department || "",
    employmentType: staff.staffProfile?.employmentType || "Permanent",
    residenceAddress: staff.staffProfile?.residenceAddress || "",
    county: staff.staffProfile?.county || "",
    yearsOfExperience: staff.staffProfile?.yearsOfExperience || 0,
    professionalQualifications: staff.staffProfile?.professionalQualifications || "",
    kraPin: staff.staffProfile?.kraPin || "",
    nssfNumber: staff.staffProfile?.nssfNumber || "",
    shaNumber: staff.staffProfile?.shaNumber || "",
    bankName: staff.staffProfile?.bankName || "",
    bankAccountName: staff.staffProfile?.bankAccountName || "",
    bankAccountNumber: staff.staffProfile?.bankAccountNumber || "",
    bankBranch: staff.staffProfile?.bankBranch || "",
  });

  // Document upload state
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docCategory, setDocCategory] = useState("ID_COPY");
  const [docLoading, setDocLoading] = useState(false);
  const [docError, setDocError] = useState("");

  const roleLabel = staff.role
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (c: string) => c.toUpperCase());

  const tabs = [
    { id: "Biography", label: "Biography", icon: User },
    { id: "Employment", label: "Employment", icon: Briefcase },
    { id: "Qualifications", label: "Qualifications", icon: GraduationCap },
    { id: "Documents", label: "Documents", icon: FileText },
    { id: "Classes", label: "Classes & Timetable", icon: Calendar },
    { id: "Attendance", label: "Attendance", icon: Clock },
    { id: "Activity", label: "Edit History", icon: Activity },
    ...(canViewStatutory ? [{ id: "Payroll", label: "Payroll & Statutory", icon: Lock, restricted: true }] : []),
  ];

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    setEditError("");
    setEditLoading(true);

    try {
      const res = await fetch(`/api/staff/${staff.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (!res.ok) {
        setEditError(data.error || "Failed to update profile.");
      } else {
        setEditSuccess(true);
        setTimeout(() => {
          setShowEditModal(false);
          window.location.reload();
        }, 1000);
      }
    } catch {
      setEditError("Network error while updating staff profile.");
    } finally {
      setEditLoading(false);
    }
  }

  async function handleUploadDoc(e: React.FormEvent) {
    e.preventDefault();
    if (!docFile) return;
    setDocError("");
    setDocLoading(true);

    const formData = new FormData();
    formData.append("file", docFile);
    formData.append("category", docCategory);

    try {
      const res = await fetch(`/api/staff/${staff.id}/documents`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setDocError(data.error || "Failed to upload document.");
      } else {
        setDocFile(null);
        window.location.reload();
      }
    } catch {
      setDocError("Network error uploading document.");
    } finally {
      setDocLoading(false);
    }
  }

  const profile = staff.staffProfile;

  return (
    <div className="space-y-6">
      {/* Profile Hero Section */}
      <section className="bento-card relative overflow-hidden rounded-3xl border border-blue-100 bg-gradient-to-br from-[#0c234b] via-blue-900 to-indigo-950 p-6 text-white shadow-xl shadow-blue-950/15 sm:p-8 dark:border-blue-900/50">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-5">
            {staff.avatarUrl ? (
              <Image
                src={staff.avatarUrl}
                width={88}
                height={88}
                unoptimized
                alt={staff.name}
                className="h-20 w-20 rounded-2xl border-2 border-white/30 object-cover shadow-lg"
              />
            ) : (
              <div
                className="grid h-20 w-20 place-items-center rounded-2xl bg-white/15 text-2xl font-black text-white shadow-lg backdrop-blur"
                aria-hidden="true"
              >
                {staff.name
                  .split(/\s+/)
                  .map((p: string) => p[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase()}
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-400/20 px-3 py-1 text-xs font-bold text-blue-200 ring-1 ring-inset ring-blue-300/30">
                  <ShieldCheck size={13} /> {roleLabel}
                </span>
                {staff.suspended && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/20 px-2.5 py-0.5 text-xs font-bold text-rose-200 ring-1 ring-rose-400/30">
                    <ShieldAlert size={12} /> Suspended
                  </span>
                )}
              </div>
              <h1 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">
                {staff.name}
              </h1>
              <p className="mt-1 text-xs text-blue-100 sm:text-sm">
                {staff.employmentTitle || roleLabel} · {staff.email}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {canEdit && (
              <button
                onClick={() => {
                  setShowEditModal(true);
                  setEditError("");
                  setEditSuccess(false);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-xs font-bold text-blue-900 shadow-sm transition hover:bg-blue-50"
              >
                <Edit3 size={13} /> Edit Profile
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Tabs Navigation Bar */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 pb-2 dark:border-slate-800">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3.5 py-2 text-xs font-bold transition shrink-0 ${
                isActive
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              <Icon size={14} className={tab.restricted ? "text-amber-400" : ""} />
              {tab.label}
              {tab.restricted && (
                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-black uppercase text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                  Restricted
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB CONTENT AREAS */}

      {/* 1. BIOGRAPHY */}
      {activeTab === "Biography" && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Identity & Personal Info */}
          <section className="bento-card rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
              <User size={16} className="text-blue-600 dark:text-blue-400" />
              Personal Biography
            </h3>
            <div className="mt-4 divide-y divide-slate-100 text-xs dark:divide-slate-800">
              <div className="flex justify-between py-2.5">
                <span className="text-slate-500">Full Names</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{staff.name}</span>
              </div>
              <div className="flex justify-between py-2.5">
                <span className="text-slate-500">Gender</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{profile?.gender || "Not recorded"}</span>
              </div>
              <div className="flex justify-between py-2.5">
                <span className="text-slate-500">Date of Birth</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                {profile?.dateOfBirth ? toDate(profile.dateOfBirth).toLocaleDateString("en-KE") : "Not recorded"}
                </span>
              </div>
              <div className="flex justify-between py-2.5">
                <span className="text-slate-500">National ID / Passport</span>
                <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">{profile?.nationalId || "Not recorded"}</span>
              </div>
              <div className="flex justify-between py-2.5">
                <span className="text-slate-500">Nationality</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{profile?.nationality || "Kenyan"}</span>
              </div>
              <div className="flex justify-between py-2.5">
                <span className="text-slate-500">Marital Status</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{profile?.maritalStatus || "Not recorded"}</span>
              </div>
              <div className="flex justify-between py-2.5">
                <span className="text-slate-500">Residence Address</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{profile?.residenceAddress || "Obunga, Kisumu"}</span>
              </div>
              <div className="flex justify-between py-2.5">
                <span className="text-slate-500">County</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{profile?.county || "Kisumu"}</span>
              </div>
            </div>
          </section>

          {/* Emergency Contacts & Next of Kin */}
          <section className="bento-card rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
              <CalendarCheck size={16} className="text-emerald-600 dark:text-emerald-400" />
              Emergency Contacts &amp; Next of Kin
            </h3>
            {profile?.emergencyContacts && profile.emergencyContacts.length > 0 ? (
              <div className="mt-4 space-y-3">
                {profile.emergencyContacts.map((contact) => (
                  <div
                    key={contact.id}
                    className="rounded-xl border border-slate-100 bg-slate-50 p-3.5 text-xs dark:border-slate-800 dark:bg-slate-800/40"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 dark:text-white">{contact.fullName}</span>
                      {contact.isNextOfKin && (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          Next of Kin
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-slate-500">
                      Relationship: <span className="font-semibold text-slate-700 dark:text-slate-300">{contact.relationship}</span>
                    </p>
                    <p className="mt-0.5 text-slate-500">
                      Phone: <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">{contact.phone}</span>
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-xs text-slate-500">No emergency contacts logged yet.</p>
            )}

            {/* Referees */}
            <h4 className="mt-6 text-xs font-bold text-slate-800 dark:text-slate-200">Referees</h4>
            {profile?.referees && profile.referees.length > 0 ? (
              <div className="mt-3 space-y-2">
                {profile.referees.map((ref) => (
                  <div key={ref.id} className="rounded-xl border border-slate-100 p-3 text-xs dark:border-slate-800">
                    <p className="font-bold text-slate-900 dark:text-white">{ref.fullName}</p>
                    <p className="text-slate-500 text-[11px]">{ref.title ? `${ref.title} · ` : ""}{ref.organization}</p>
                    <p className="text-slate-500 text-[11px]">Phone: {ref.phone} {ref.email ? `· Email: ${ref.email}` : ""}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-xs text-slate-500">No referees recorded.</p>
            )}
          </section>
        </div>
      )}

      {/* 2. EMPLOYMENT */}
      {activeTab === "Employment" && (
        <section className="bento-card rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
            <Briefcase size={16} className="text-blue-600 dark:text-blue-400" />
            Employment Terms &amp; Record
          </h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 text-xs">
            <div className="space-y-3 divide-y divide-slate-100 dark:divide-slate-800">
              <div className="flex justify-between py-2">
                <span className="text-slate-500">Internal Staff Number</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{staff.staffNumber || "None"}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-slate-500">TSC Registration</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{staff.tscNumber || "None"}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-slate-500">Job Title</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{staff.employmentTitle || roleLabel}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-slate-500">Department</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{profile?.department || "Academics"}</span>
              </div>
            </div>

            <div className="space-y-3 divide-y divide-slate-100 dark:divide-slate-800">
              <div className="flex justify-between py-2">
                <span className="text-slate-500">Employment Type</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{profile?.employmentType || "Permanent"}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-slate-500">Date Joined Mary Royal</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {profile?.dateJoined ? toDate(profile.dateJoined).toLocaleDateString("en-KE") : "Recorded on file"}
                </span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-slate-500">Line Manager</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{profile?.lineManager || "Head Teacher"}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-slate-500">Probation Status</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {profile?.probationEndDate ? `Ends ${toDate(profile.probationEndDate).toLocaleDateString("en-KE")}` : "Confirmed Permanent"}
                </span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 3. QUALIFICATIONS */}
      {activeTab === "Qualifications" && (
        <section className="bento-card rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
            <GraduationCap size={16} className="text-indigo-600 dark:text-indigo-400" />
            Academic &amp; Professional Qualifications
          </h3>

          <div className="mt-4 space-y-4 text-xs">
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/40">
              <h4 className="font-bold text-slate-800 dark:text-slate-200">Professional Qualifications &amp; Degrees</h4>
              <p className="mt-1 text-slate-600 dark:text-slate-300">
                {profile?.professionalQualifications || staff.qualifications || "Standard Primary Teaching Certificate"}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-100 p-4 dark:border-slate-800">
                <h4 className="font-bold text-slate-800 dark:text-slate-200">Years of Experience</h4>
                <p className="mt-1 text-lg font-black text-blue-700 dark:text-blue-400">
                  {profile?.yearsOfExperience ?? 3} Years
                </p>
              </div>

              <div className="rounded-xl border border-slate-100 p-4 dark:border-slate-800">
                <h4 className="font-bold text-slate-800 dark:text-slate-200">Specializations</h4>
                <p className="mt-1 text-slate-600 dark:text-slate-300">
                  {profile?.specializations || "CBC Curriculum Implementation & Remedial Instruction"}
                </p>
              </div>
            </div>

            {profile?.previousEmployers && (
              <div className="rounded-xl border border-slate-100 p-4 dark:border-slate-800">
                <h4 className="font-bold text-slate-800 dark:text-slate-200">Previous Employment Record</h4>
                <p className="mt-1 text-slate-600 dark:text-slate-300">{profile.previousEmployers}</p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* 4. DOCUMENTS */}
      {activeTab === "Documents" && (
        <section className="bento-card rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                <FileText size={16} className="text-blue-600 dark:text-blue-400" />
                Staff Verification Documents
              </h3>
              <p className="text-xs text-slate-500">
                Stored in private encrypted vaults. Accessible only by authorized school leadership and staff owner.
              </p>
            </div>

            {canEdit && (
              <form onSubmit={handleUploadDoc} className="flex flex-wrap items-center gap-2">
                <select
                  value={docCategory}
                  onChange={(e) => setDocCategory(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                >
                  <option value="ID_COPY">National ID Copy</option>
                  <option value="TSC_CARD">TSC Card</option>
                  <option value="ACADEMIC_CERTIFICATE">Academic Certificate</option>
                  <option value="CV">Curriculum Vitae (CV)</option>
                  <option value="CONTRACT">Employment Contract</option>
                  <option value="PASSPORT_PHOTO">Passport Photo</option>
                </select>

                <input
                  type="file"
                  id="staff-doc-input"
                  className="hidden"
                  onChange={(e) => setDocFile(e.target.files?.[0] || null)}
                />

                <label
                  htmlFor="staff-doc-input"
                  className="cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  {docFile ? docFile.name.slice(0, 15) : "Select File"}
                </label>

                <button
                  type="submit"
                  disabled={docLoading || !docFile}
                  className="rounded-xl bg-blue-700 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-blue-800 disabled:opacity-50"
                >
                  {docLoading ? "Uploading..." : "Upload Document"}
                </button>
              </form>
            )}
          </div>

          {docError && (
            <div className="mt-3 text-xs text-rose-600 dark:text-rose-400">{docError}</div>
          )}

          <div className="mt-5 divide-y divide-slate-100 rounded-2xl border border-slate-100 dark:divide-slate-800 dark:border-slate-800">
            {profile?.documents && profile.documents.length > 0 ? (
              profile.documents.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between p-4 text-xs">
                  <div className="flex items-center gap-3">
                    <FileText size={18} className="text-blue-600 dark:text-blue-400 shrink-0" />
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white">{doc.originalName}</p>
                      <p className="text-[11px] text-slate-500">
                        Category: <span className="font-semibold">{doc.category.replaceAll("_", " ")}</span> ·{" "}
                        {(doc.sizeBytes / 1024).toFixed(1)} KB ·{" "}
                        {toDate(doc.createdAt).toLocaleDateString("en-KE")}
                      </p>
                    </div>
                  </div>

                  <a
                    href={`/api/staff/documents/${doc.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-blue-700 shadow-sm hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-900 dark:text-blue-400"
                  >
                    <Download size={13} /> View / Download
                  </a>
                </div>
              ))
            ) : (
              <p className="p-6 text-center text-xs text-slate-500">No documents uploaded yet.</p>
            )}
          </div>
        </section>
      )}

      {/* 5. CLASSES & TIMETABLE */}
      {activeTab === "Classes" && (
        <section className="bento-card rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
            <Calendar size={16} className="text-blue-600 dark:text-blue-400" />
            Class Teacher &amp; Subject Assignments
          </h3>

          {staff.classTeacherAssignments && staff.classTeacherAssignments.length > 0 && (
            <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50/80 p-4 text-xs dark:border-blue-900 dark:bg-blue-950/40">
              <span className="font-bold text-blue-900 dark:text-blue-200">Designated Class Teacher For:</span>
              <div className="mt-2 flex flex-wrap gap-2">
                {staff.classTeacherAssignments.map((cta) => (
                  <span
                    key={cta.grade}
                    className="rounded-lg bg-blue-700 px-3 py-1 text-xs font-bold text-white shadow-sm"
                  >
                    {cta.grade}
                  </span>
                ))}
              </div>
            </div>
          )}

          <h4 className="mt-6 text-xs font-bold text-slate-800 dark:text-slate-200">Subject Allocations</h4>
          {staff.assignments && staff.assignments.length > 0 ? (
            <div className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-100 text-xs dark:divide-slate-800 dark:border-slate-800">
              {staff.assignments.map((item) => (
                <div key={`${item.grade}-${item.subject}`} className="flex items-center justify-between p-3.5">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{item.subject}</span>
                  <span className="rounded-lg bg-slate-100 px-2.5 py-1 font-bold text-slate-800 dark:bg-slate-800 dark:text-slate-200">
                    {item.grade}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-xs text-slate-500">No subject allocations recorded for this staff member.</p>
          )}
        </section>
      )}

      {/* 6. ATTENDANCE */}
      {activeTab === "Attendance" && (
        <section className="bento-card rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
              <Clock size={16} className="text-emerald-600 dark:text-emerald-400" />
              Attendance &amp; Punctuality Register
            </h3>
            <span className="text-xs text-slate-500">{attendance.length} total sign-ins recorded</span>
          </div>

          {attendance.length > 0 ? (
            <div className="mt-4 divide-y divide-slate-100 text-xs dark:divide-slate-800">
              {attendance.map((rec, idx) => (
                <div key={idx} className="flex items-center justify-between py-2.5">
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {toDate(rec.date).toLocaleDateString("en-KE", { dateStyle: "medium" })}
                    {rec.checkInAt ? ` · In at ${toDate(rec.checkInAt).toLocaleTimeString("en-KE", { timeStyle: "short" })}` : ""}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                      rec.status === "PRESENT"
                        ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                        : rec.status === "LATE"
                        ? "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                        : "bg-rose-50 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                    }`}
                  >
                    {rec.status}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-xs text-slate-500">No attendance records logged for this staff member.</p>
          )}
        </section>
      )}

      {/* 7. ACTIVITY & EDIT HISTORY */}
      {activeTab === "Activity" && (
        <section className="bento-card rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
            <Activity size={16} className="text-blue-600 dark:text-blue-400" />
            Profile Mutation Audit Trail
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Immutable timestamped record of every profile modification with old and new values.
          </p>

          {profile?.editHistory && profile.editHistory.length > 0 ? (
            <div className="mt-4 divide-y divide-slate-100 rounded-2xl border border-slate-100 text-xs dark:divide-slate-800 dark:border-slate-800">
              {profile.editHistory.map((h) => (
                <div key={h.id} className="p-3.5 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 dark:text-white capitalize">
                      {h.field.replace(/([A-Z])/g, " $1")}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {toDate(h.createdAt).toLocaleDateString("en-KE", { dateStyle: "medium", timeStyle: "short" })}
                    </span>
                  </div>
                  <p className="text-slate-500 text-[11px]">
                    Changed by: <span className="font-semibold text-slate-700 dark:text-slate-300">{h.actor.name} ({h.actor.role})</span>
                  </p>
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="rounded bg-rose-50 px-2 py-0.5 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 line-through">
                      {h.oldValue || "empty"}
                    </span>
                    <span>→</span>
                    <span className="rounded bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                      {h.newValue || "empty"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-xs text-slate-500">No profile modifications logged yet.</p>
          )}

          <div className="mt-6 border-t border-slate-100 pt-5 dark:border-slate-800">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Teaching day summaries</h4>
            {teachingLogs.length ? (
              <ul className="mt-3 space-y-3">
                {teachingLogs.map((log, index) => (
                  <li key={`${log.createdAt}-${log.grade}-${index}`} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{log.subject} · {log.grade}</p>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{log.topics}</p>
                    {log.reflection && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{log.reflection}</p>}
                    <p className="mt-2 text-xs text-slate-500">{log.status} · {toDate(log.createdAt).toLocaleDateString("en-KE")}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-slate-500">No teaching summaries recorded yet.</p>
            )}
          </div>
        </section>
      )}

      {/* 8. RESTRICTED STATUTORY & PAYROLL */}
      {activeTab === "Payroll" && canViewStatutory && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
            <div className="flex items-center gap-2">
              <ShieldAlert size={18} className="text-amber-600 dark:text-amber-400" />
              <h4 className="text-xs font-bold uppercase tracking-wider">
                Restricted Confidential Section · Statutory &amp; Payroll
              </h4>
            </div>
            <p className="mt-1 text-xs">
              This sensitive financial record is restricted to the <strong>Director</strong>, <strong>Head Teacher</strong>, and <strong>Accountant</strong>. Your access to this view has been recorded in the audit log under the Data Protection Act.
            </p>
          </div>

          {/* Statutory Tax and Bank Details */}
          <section className="bento-card rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
              <Building size={16} className="text-amber-600 dark:text-amber-400" />
              Statutory Numbers &amp; Bank Account
            </h3>

            <div className="mt-4 grid gap-4 sm:grid-cols-2 text-xs">
              <div className="space-y-3 divide-y divide-slate-100 dark:divide-slate-800">
                <div className="flex justify-between py-2">
                  <span className="text-slate-500">KRA Tax PIN</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">{profile?.kraPin || "Not recorded"}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-slate-500">NSSF Number</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">{profile?.nssfNumber || "Not recorded"}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-slate-500">SHA Number (Health)</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">{profile?.shaNumber || "Not recorded"}</span>
                </div>
              </div>

              <div className="space-y-3 divide-y divide-slate-100 dark:divide-slate-800">
                <div className="flex justify-between py-2">
                  <span className="text-slate-500">Bank Name</span>
                  <span className="font-bold text-slate-900 dark:text-white">{profile?.bankName || "Not recorded"}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-slate-500">Account Name</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{profile?.bankAccountName || staff.name}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-slate-500">Bank Account #</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">{profile?.bankAccountNumber || "Not recorded"}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-slate-500">Bank Branch</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{profile?.bankBranch || "Kisumu"}</span>
                </div>
              </div>
            </div>
          </section>

          {/* Payroll Disbursement History */}
          {actor.role === "DIRECTOR" && (
            <section className="bento-card rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                <Lock size={16} className="text-emerald-600 dark:text-emerald-400" />
                Monthly Payroll Disbursements (Director Confidential)
              </h3>
              {payroll.length > 0 ? (
                <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {payroll.map((entry) => (
                    <div key={entry.period} className="flex items-center justify-between py-3">
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white">{entry.period}</span>
                        <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          {entry.status}
                        </span>
                      </div>
                      <span className="font-bold text-emerald-700 dark:text-emerald-400">
                        KES {entry.netAmount.toLocaleString()} net
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-xs text-slate-500">No payroll entries recorded for this staff member.</p>
              )}
            </section>
          )}
        </div>
      )}

      {/* EDIT MODAL */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <button
              type="button"
              aria-label="Close staff profile editor"
              onClick={() => setShowEditModal(false)}
              className="absolute right-5 top-5 grid h-8 w-8 place-items-center rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X size={18} />
            </button>

            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Edit Staff Bio &amp; Profile</h3>
            <p className="text-xs text-slate-500">
              Modifications will be timestamped and audit-logged in the staff member&apos;s history.
            </p>

            {editError && (
              <div className="mt-4 rounded-xl bg-rose-50 p-3 text-xs text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
                {editError}
              </div>
            )}

            {editSuccess && (
              <div className="mt-4 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                ✓ Staff profile updated successfully!
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="mt-6 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300">Full Name</label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300">Phone</label>
                  <input
                    type="tel"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300">Staff Number</label>
                  <input
                    type="text"
                    value={editForm.staffNumber}
                    onChange={(e) => setEditForm({ ...editForm, staffNumber: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300">TSC Number</label>
                  <input
                    type="text"
                    value={editForm.tscNumber}
                    onChange={(e) => setEditForm({ ...editForm, tscNumber: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300">Job Title</label>
                  <input
                    type="text"
                    value={editForm.employmentTitle}
                    onChange={(e) => setEditForm({ ...editForm, employmentTitle: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300">Department</label>
                  <input
                    type="text"
                    value={editForm.department}
                    onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300">Employment Type</label>
                  <select
                    value={editForm.employmentType}
                    onChange={(e) => setEditForm({ ...editForm, employmentType: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 dark:border-slate-700 dark:bg-slate-800"
                  >
                    <option value="Permanent">Permanent</option>
                    <option value="Contract">Contract</option>
                    <option value="BOM">BOM</option>
                    <option value="Part-Time">Part-Time</option>
                    <option value="Probation">Probation</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300">County</label>
                  <input
                    type="text"
                    value={editForm.county}
                    onChange={(e) => setEditForm({ ...editForm, county: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">Physical Address</label>
                  <input
                    type="text"
                    value={editForm.residenceAddress}
                    onChange={(e) => setEditForm({ ...editForm, residenceAddress: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
              </div>

              {/* Statutory details in edit modal if permitted */}
              {canEditStatutory && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
                  <h4 className="text-xs font-bold text-amber-900 dark:text-amber-200">
                    Restricted Statutory &amp; Bank Details
                  </h4>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 text-xs">
                    <div>
                      <label className="block font-semibold">KRA PIN</label>
                      <input
                        type="text"
                        value={editForm.kraPin}
                        onChange={(e) => setEditForm({ ...editForm, kraPin: e.target.value })}
                        className="mt-1 w-full rounded-xl border border-slate-200 p-2 dark:border-slate-700 dark:bg-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold">NSSF Number</label>
                      <input
                        type="text"
                        value={editForm.nssfNumber}
                        onChange={(e) => setEditForm({ ...editForm, nssfNumber: e.target.value })}
                        className="mt-1 w-full rounded-xl border border-slate-200 p-2 dark:border-slate-700 dark:bg-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold">SHA Number</label>
                      <input
                        type="text"
                        value={editForm.shaNumber}
                        onChange={(e) => setEditForm({ ...editForm, shaNumber: e.target.value })}
                        className="mt-1 w-full rounded-xl border border-slate-200 p-2 dark:border-slate-700 dark:bg-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold">Bank Name</label>
                      <input
                        type="text"
                        value={editForm.bankName}
                        onChange={(e) => setEditForm({ ...editForm, bankName: e.target.value })}
                        className="mt-1 w-full rounded-xl border border-slate-200 p-2 dark:border-slate-700 dark:bg-slate-800"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block font-semibold">Bank Account #</label>
                      <input
                        type="text"
                        value={editForm.bankAccountNumber}
                        onChange={(e) => setEditForm({ ...editForm, bankAccountNumber: e.target.value })}
                        className="mt-1 w-full rounded-xl border border-slate-200 p-2 dark:border-slate-700 dark:bg-slate-800"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 dark:border-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="rounded-xl bg-blue-700 px-5 py-2 text-xs font-bold text-white hover:bg-blue-800 disabled:opacity-50"
                >
                  {editLoading ? "Saving Changes..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
