"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Upload,
  User,
  Briefcase,
  GraduationCap,
  HeartHandshake,
  ShieldAlert,
  FileText,
  KeyRound,
  Printer,
  Copy,
  Check,
  Plus,
  Trash2,
  Lock,
} from "lucide-react";

interface StaffWizardProps {
  userRole: string;
}

const STEPS = [
  { id: 1, label: "Personal", icon: User },
  { id: 2, label: "Employment", icon: Briefcase },
  { id: 3, label: "Qualifications", icon: GraduationCap },
  { id: 4, label: "Emergency & Referees", icon: HeartHandshake },
  { id: 5, label: "Restricted Payroll", icon: Lock },
  { id: 6, label: "Documents", icon: FileText },
  { id: 7, label: "Account & Credentials", icon: KeyRound },
];

export function StaffWizard({ userRole }: StaffWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successResult, setSuccessResult] = useState<{
    user: { id: string; name: string; email: string; role: string };
    temporaryPassword: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);

  // Form State
  const [personal, setPersonal] = useState({
    name: "",
    gender: "Female",
    dateOfBirth: "",
    nationalId: "",
    nationality: "Kenyan",
    maritalStatus: "Single",
    phone: "",
    alternatePhone: "",
    email: "",
    residenceAddress: "",
    county: "Kisumu",
    avatarUrl: "",
  });

  const [employment, setEmployment] = useState({
    role: "TEACHER",
    staffNumber: "",
    tscNumber: "",
    dateJoined: new Date().toISOString().split("T")[0],
    employmentType: "Permanent",
    employmentTitle: "Teacher",
    department: "Academics",
    lineManager: "Head Teacher",
    probationEndDate: "",
    assignedSubjects: [{ grade: "Grade 4", subject: "Mathematics" }],
    classTeacherGrade: "",
  });

  const [qualifications, setQualifications] = useState({
    educationHistory: "",
    professionalQualifications: "",
    certificates: "",
    specializations: "",
    yearsOfExperience: 3,
    previousEmployers: "",
  });

  const [emergencyContacts, setEmergencyContacts] = useState([
    { fullName: "", relationship: "Next of Kin", phone: "", isNextOfKin: true },
  ]);

  const [referees, setReferees] = useState([
    { fullName: "", organization: "", title: "", phone: "", email: "" },
    { fullName: "", organization: "", title: "", phone: "", email: "" },
  ]);

  const [statutory, setStatutory] = useState({
    kraPin: "",
    nssfNumber: "",
    shaNumber: "",
    bankName: "",
    bankAccountName: "",
    bankAccountNumber: "",
    bankBranch: "",
  });

  const [documents, setDocuments] = useState<
    { category: string; storageKey: string; originalName: string; contentType: string; sizeBytes: number }[]
  >([]);

  // Filter allowed roles based on current user
  const allowedRoles =
    userRole === "DIRECTOR"
      ? [
          { label: "Head Teacher", value: "HEAD_TEACHER" },
          { label: "Deputy Head Teacher", value: "DEPUTY" },
          { label: "Secretary", value: "SECRETARY" },
          { label: "Accountant", value: "ACCOUNTANT" },
          { label: "Teacher", value: "TEACHER" },
          { label: "Welfare Chair", value: "WELFARE_CHAIR" },
          { label: "Non-Teaching Staff", value: "NON_TEACHING_STAFF" },
        ]
      : [
          { label: "Deputy Head Teacher", value: "DEPUTY" },
          { label: "Secretary", value: "SECRETARY" },
          { label: "Accountant", value: "ACCOUNTANT" },
          { label: "Teacher", value: "TEACHER" },
          { label: "Welfare Chair", value: "WELFARE_CHAIR" },
          { label: "Non-Teaching Staff", value: "NON_TEACHING_STAFF" },
        ];

  // Try to load saved draft on mount
  useEffect(() => {
    async function loadDraft() {
      try {
        const res = await fetch("/api/staff/drafts");
        if (res.ok) {
          const data = await res.json();
          if (data.draft?.payload) {
            const p = JSON.parse(data.draft.payload);
            if (p.personal) setPersonal((prev) => ({ ...prev, ...p.personal }));
            if (p.employment) setEmployment((prev) => ({ ...prev, ...p.employment }));
            if (p.qualifications) setQualifications((prev) => ({ ...prev, ...p.qualifications }));
            if (p.emergencyContacts) setEmergencyContacts(p.emergencyContacts);
            if (p.referees) setReferees(p.referees);
            if (p.statutory) setStatutory((prev) => ({ ...prev, ...p.statutory }));
            if (p.documents) setDocuments(p.documents);
            if (data.draft.currentStep) setCurrentStep(data.draft.currentStep);
          }
        }
      } catch {
        // Ignore draft fetch errors
      }
    }
    void loadDraft();
  }, []);

  async function saveDraft() {
    try {
      const payload = {
        personal,
        employment,
        qualifications,
        emergencyContacts,
        referees,
        statutory,
        documents,
      };
      await fetch("/api/staff/drafts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ currentStep, payload }),
      });
      setDraftSaved(true);
      setTimeout(() => setDraftSaved(false), 2000);
    } catch {
      // Ignore
    }
  }

  function validateCurrentStep(): boolean {
    setError("");
    if (currentStep === 1) {
      if (!personal.name || personal.name.trim().length < 2) {
        setError("Please enter the staff member's full name.");
        return false;
      }
      if (!personal.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(personal.email)) {
        setError("Please enter a valid official email address.");
        return false;
      }
      if (personal.phone && !/^(?:\+254|0)[17]\d{8}$/.test(personal.phone.trim())) {
        setError("Phone number must be a valid Kenyan mobile number (+254... or 07/01...).");
        return false;
      }
    } else if (currentStep === 2) {
      if (!employment.role) {
        setError("Please select a staff role.");
        return false;
      }
    } else if (currentStep === 4) {
      const primaryContact = emergencyContacts[0];
      if (!primaryContact?.fullName || !primaryContact?.phone) {
        setError("Please provide at least one emergency contact with a full name and phone number.");
        return false;
      }
      if (!/^(?:\+254|0)[17]\d{8}$/.test(primaryContact.phone.trim())) {
        setError("Emergency contact phone number must be a valid Kenyan phone number.");
        return false;
      }
    }
    return true;
  }

  function handleNext() {
    if (!validateCurrentStep()) return;
    if (currentStep < 7) {
      setCurrentStep(currentStep + 1);
      void saveDraft();
    }
  }

  function handleBack() {
    setError("");
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  }

  async function handleFinalSubmit() {
    if (!validateCurrentStep()) return;
    setLoading(true);
    setError("");

    const payload = {
      personal,
      employment,
      qualifications,
      emergencyContacts,
      referees: referees.filter((r) => r.fullName && r.organization),
      statutory,
      documentKeys: documents,
    };

    try {
      const res = await fetch("/api/staff", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create staff account.");
      } else {
        setSuccessResult({
          user: data.user,
          temporaryPassword: data.temporaryPassword,
        });
        // Clear saved draft
        await fetch("/api/staff/drafts", { method: "DELETE" });
      }
    } catch {
      setError("Network error while creating staff account.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Header / Progress Stepper */}
      <div className="bento-card rounded-3xl border border-slate-200/90 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              Staff Account &amp; Bio Onboarding
            </span>
            <h1 className="mt-1 text-xl font-black text-slate-900 dark:text-white">
              Step {currentStep} of 7: {STEPS[currentStep - 1].label}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => void saveDraft()}
              className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {draftSaved ? "✓ Draft Saved" : "Save Draft"}
            </button>
            <Link
              href="/staff"
              className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Cancel
            </Link>
          </div>
        </div>

        {/* Stepper Dots */}
        <div className="mt-6 flex items-center justify-between gap-1 overflow-x-auto pb-2 scrollbar-none">
          {STEPS.map((step) => {
            const Icon = step.icon;
            const isCompleted = currentStep > step.id;
            const isCurrent = currentStep === step.id;
            return (
              <button
                key={step.id}
                aria-label={`Step ${step.id}: ${step.label}`}
                onClick={() => {
                  if (step.id < currentStep) setCurrentStep(step.id);
                }}
                disabled={step.id > currentStep}
                className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition shrink-0 ${
                  isCurrent
                    ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                    : isCompleted
                    ? "bg-blue-50 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300"
                    : "bg-slate-100 text-slate-400 opacity-60 dark:bg-slate-800 dark:text-slate-500"
                }`}
              >
                <Icon size={14} />
                <span className="hidden md:inline">{step.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-2xl bg-rose-50 p-4 text-xs font-medium text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
          <AlertCircle size={16} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Wizard Form Cards */}
      {!successResult ? (
        <div className="bento-card rounded-3xl border border-slate-200/90 bg-white p-6 shadow-sm sm:p-8 dark:border-slate-800 dark:bg-slate-900">
          {/* STEP 1: PERSONAL DETAILS */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Personal Information</h3>
                <p className="text-xs text-slate-500">Legal identity, contact numbers, and address details.</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Full Legal Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Kennedy Ochieng Otieno"
                    value={personal.name}
                    onChange={(e) => setPersonal({ ...personal, name: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Official Login Email *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. kennedy.otieno@maryroyal.ac.ke"
                    value={personal.email}
                    onChange={(e) => setPersonal({ ...personal, email: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Primary Phone (+254...)
                  </label>
                  <input
                    type="tel"
                    placeholder="+254712345678"
                    value={personal.phone}
                    onChange={(e) => setPersonal({ ...personal, phone: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Alternate Phone
                  </label>
                  <input
                    type="tel"
                    placeholder="e.g. 0722000000"
                    value={personal.alternatePhone}
                    onChange={(e) => setPersonal({ ...personal, alternatePhone: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">Gender</label>
                  <select
                    value={personal.gender}
                    onChange={(e) => setPersonal({ ...personal, gender: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="Female">Female</option>
                    <option value="Male">Male</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    value={personal.dateOfBirth}
                    onChange={(e) => setPersonal({ ...personal, dateOfBirth: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    National ID / Passport #
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 29384756"
                    value={personal.nationalId}
                    onChange={(e) => setPersonal({ ...personal, nationalId: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Nationality
                  </label>
                  <input
                    type="text"
                    value={personal.nationality}
                    onChange={(e) => setPersonal({ ...personal, nationality: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Marital Status
                  </label>
                  <select
                    value={personal.maritalStatus}
                    onChange={(e) => setPersonal({ ...personal, maritalStatus: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="Single">Single</option>
                    <option value="Married">Married</option>
                    <option value="Divorced">Divorced</option>
                    <option value="Widowed">Widowed</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    County of Residence
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Kisumu"
                    value={personal.county}
                    onChange={(e) => setPersonal({ ...personal, county: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Physical Residence Address
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Obunga Central, Near Chief's Camp, Kisumu"
                    value={personal.residenceAddress}
                    onChange={(e) => setPersonal({ ...personal, residenceAddress: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: EMPLOYMENT DETAILS */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Employment &amp; Designation</h3>
                <p className="text-xs text-slate-500">Role assignment, department, contract terms, and staff identifiers.</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">Role *</label>
                  <select
                    value={employment.role}
                    onChange={(e) => setEmployment({ ...employment, role: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 text-xs font-semibold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    {allowedRoles.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Job Title / Designation
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Senior CBC Lead Teacher"
                    value={employment.employmentTitle}
                    onChange={(e) => setEmployment({ ...employment, employmentTitle: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Internal Staff Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. MR-ST-012"
                    value={employment.staffNumber}
                    onChange={(e) => setEmployment({ ...employment, staffNumber: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    TSC Registration Number (Teachers)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. TSC/847291"
                    value={employment.tscNumber}
                    onChange={(e) => setEmployment({ ...employment, tscNumber: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Employment Type
                  </label>
                  <select
                    value={employment.employmentType}
                    onChange={(e) => setEmployment({ ...employment, employmentType: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="Permanent">Permanent</option>
                    <option value="Contract">Contract</option>
                    <option value="BOM">BOM</option>
                    <option value="Part-Time">Part-Time</option>
                    <option value="Probation">Probation</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Department
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Languages / Mathematics / Sciences"
                    value={employment.department}
                    onChange={(e) => setEmployment({ ...employment, department: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Date Joined Mary Royal
                  </label>
                  <input
                    type="date"
                    value={employment.dateJoined}
                    onChange={(e) => setEmployment({ ...employment, dateJoined: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Line Manager
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Head Teacher"
                    value={employment.lineManager}
                    onChange={(e) => setEmployment({ ...employment, lineManager: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>

              {/* Teacher-Specific Grade and Subject Assignment */}
              {employment.role === "TEACHER" && (
                <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-5 dark:border-blue-900/40 dark:bg-blue-950/20">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                    Teaching &amp; Class Teacher Assignments
                  </h4>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    Assign subjects and designated class teacher roll-call responsibilities.
                  </p>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Designated Class Teacher For (Optional)
                      </label>
                      <select
                        value={employment.classTeacherGrade}
                        onChange={(e) => setEmployment({ ...employment, classTeacherGrade: e.target.value })}
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                      >
                        <option value="">None (Subject Teacher Only)</option>
                        <option value="PP1">PP1</option>
                        <option value="PP2">PP2</option>
                        <option value="Grade 1">Grade 1</option>
                        <option value="Grade 2">Grade 2</option>
                        <option value="Grade 3">Grade 3</option>
                        <option value="Grade 4">Grade 4</option>
                        <option value="Grade 5">Grade 5</option>
                        <option value="Grade 6">Grade 6</option>
                        <option value="Grade 7">Grade 7</option>
                        <option value="Grade 8">Grade 8</option>
                        <option value="Grade 9">Grade 9</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: QUALIFICATIONS */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Qualifications &amp; Career History</h3>
                <p className="text-xs text-slate-500">Academic credentials, certifications, and experience record.</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Highest Academic &amp; Professional Qualifications
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Bachelor of Education (Primary Option), Moi University, 2018; Diploma in Early Childhood Development"
                    value={qualifications.professionalQualifications}
                    onChange={(e) => setQualifications({ ...qualifications, professionalQualifications: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Years of Relevant Experience
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={50}
                    value={qualifications.yearsOfExperience}
                    onChange={(e) => setQualifications({ ...qualifications, yearsOfExperience: Number(e.target.value) })}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Areas of Specialization
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. CBC Assessment, STEM Activities, Remedial Learning"
                    value={qualifications.specializations}
                    onChange={(e) => setQualifications({ ...qualifications, specializations: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Previous Employers / Schools
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Kisumu Junior Academy (2019-2022) - Grade 3 Lead; Obunga Community School (2022-2024)"
                    value={qualifications.previousEmployers}
                    onChange={(e) => setQualifications({ ...qualifications, previousEmployers: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: EMERGENCY CONTACTS & REFEREES */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Emergency Contacts &amp; Referees</h3>
                <p className="text-xs text-slate-500">Next of kin and at least two professional or personal referees.</p>
              </div>

              {/* Emergency Contacts */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Emergency Contacts &amp; Next of Kin (At least 1 required) *
                  </h4>
                  <button
                    type="button"
                    onClick={() =>
                      setEmergencyContacts([
                        ...emergencyContacts,
                        { fullName: "", relationship: "Relative", phone: "", isNextOfKin: false },
                      ])
                    }
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-800"
                  >
                    <Plus size={13} /> Add Contact
                  </button>
                </div>

                {emergencyContacts.map((contact, index) => (
                  <div
                    key={index}
                    className="grid gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 sm:grid-cols-3 dark:border-slate-800 dark:bg-slate-800/40"
                  >
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Mary Atieno"
                        value={contact.fullName}
                        onChange={(e) => {
                          const updated = [...emergencyContacts];
                          updated[index].fullName = e.target.value;
                          setEmergencyContacts(updated);
                        }}
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400">
                        Relationship *
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Spouse / Sister / Mother"
                        value={contact.relationship}
                        onChange={(e) => {
                          const updated = [...emergencyContacts];
                          updated[index].relationship = e.target.value;
                          setEmergencyContacts(updated);
                        }}
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400">
                          Kenyan Phone *
                        </label>
                        <input
                          type="tel"
                          placeholder="+254700000000"
                          value={contact.phone}
                          onChange={(e) => {
                            const updated = [...emergencyContacts];
                            updated[index].phone = e.target.value;
                            setEmergencyContacts(updated);
                          }}
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                        />
                      </div>
                      {emergencyContacts.length > 1 && (
                        <button
                          type="button"
                          aria-label={`Remove emergency contact ${index + 1}`}
                          onClick={() => setEmergencyContacts(emergencyContacts.filter((_, i) => i !== index))}
                          className="mt-4 p-2 text-rose-500 hover:text-rose-700"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Referees */}
              <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">Referees (Two Referees)</h4>

                {referees.map((ref, idx) => (
                  <div
                    key={idx}
                    className="grid gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 sm:grid-cols-3 dark:border-slate-800 dark:bg-slate-800/40"
                  >
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400">
                        Referee #{idx + 1} Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Dr. John Otieno"
                        value={ref.fullName}
                        onChange={(e) => {
                          const updated = [...referees];
                          updated[idx].fullName = e.target.value;
                          setReferees(updated);
                        }}
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400">
                        Organization &amp; Title
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Head Teacher, Kisumu Central"
                        value={ref.organization}
                        onChange={(e) => {
                          const updated = [...referees];
                          updated[idx].organization = e.target.value;
                          setReferees(updated);
                        }}
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400">
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        placeholder="+254711000000"
                        value={ref.phone}
                        onChange={(e) => {
                          const updated = [...referees];
                          updated[idx].phone = e.target.value;
                          setReferees(updated);
                        }}
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 5: RESTRICTED STATUTORY & PAYROLL */}
          {currentStep === 5 && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
                <div className="flex items-center gap-2">
                  <ShieldAlert size={18} className="text-amber-600 dark:text-amber-400" />
                  <h3 className="text-xs font-bold uppercase tracking-wider">
                    RESTRICTED CONFIDENTIAL SECTION · DATA PROTECTION ACT
                  </h3>
                </div>
                <p className="mt-1 text-xs">
                  Statutory identifiers and salary bank details are accessible solely by the <strong>Director</strong>, <strong>Head Teacher</strong>, and <strong>Accountant</strong>. Every view and mutation is permanently recorded in the immutable security audit log. Teachers, Parents, and Learners are strictly denied access.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    KRA Tax PIN
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. A012345678Z"
                    value={statutory.kraPin}
                    onChange={(e) => setStatutory({ ...statutory, kraPin: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 font-mono text-xs uppercase text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    NSSF Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 12345678"
                    value={statutory.nssfNumber}
                    onChange={(e) => setStatutory({ ...statutory, nssfNumber: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    SHA Number (Social Health Authority)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. SHA-987654"
                    value={statutory.shaNumber}
                    onChange={(e) => setStatutory({ ...statutory, shaNumber: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Bank Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Kenya Commercial Bank (KCB)"
                    value={statutory.bankName}
                    onChange={(e) => setStatutory({ ...statutory, bankName: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Account Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Kennedy Ochieng"
                    value={statutory.bankAccountName}
                    onChange={(e) => setStatutory({ ...statutory, bankAccountName: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Bank Account Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 1122334455"
                    value={statutory.bankAccountNumber}
                    onChange={(e) => setStatutory({ ...statutory, bankAccountNumber: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 6: DOCUMENTS UPLOAD */}
          {currentStep === 6 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Staff Verification Documents</h3>
                <p className="text-xs text-slate-500">
                  National ID, TSC Certificate, Academic transcripts, CV, and signed contract (4 MiB max per file).
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { label: "National ID Copy", category: "ID_COPY" },
                  { label: "TSC Registration Card", category: "TSC_CARD" },
                  { label: "Academic Certificates & Transcripts", category: "ACADEMIC_CERTIFICATE" },
                  { label: "Curriculum Vitae (CV)", category: "CV" },
                  { label: "Signed Employment Contract", category: "CONTRACT" },
                  { label: "Passport Photograph", category: "PASSPORT_PHOTO" },
                ].map((item) => {
                  const existingDoc = documents.find((d) => d.category === item.category);
                  return (
                    <div
                      key={item.category}
                      className="flex flex-col justify-between rounded-2xl border border-slate-200 p-4 dark:border-slate-800"
                    >
                      <div>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{item.label}</span>
                        {existingDoc ? (
                          <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 size={14} />
                            <span className="truncate">{existingDoc.originalName}</span>
                          </div>
                        ) : (
                          <p className="mt-1 text-[11px] text-slate-400">PDF, PNG, JPEG or WebP up to 4MB</p>
                        )}
                      </div>

                      <div className="mt-4">
                        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                          <Upload size={13} />
                          {existingDoc ? "Replace File" : "Choose File"}
                          <input
                            type="file"
                            accept=".pdf,image/png,image/jpeg,image/webp"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) {
                                const newDoc = {
                                  category: item.category,
                                  storageKey: `draft-docs/${item.category.toLowerCase()}-${Date.now()}.${f.name.split(".").pop()}`,
                                  originalName: f.name,
                                  contentType: f.type || "application/octet-stream",
                                  sizeBytes: f.size,
                                };
                                setDocuments([...documents.filter((d) => d.category !== item.category), newDoc]);
                              }
                            }}
                          />
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 7: REVIEW & CONFIRM */}
          {currentStep === 7 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Review &amp; Final Confirmation</h3>
                <p className="text-xs text-slate-500">
                  Verify bio, role assignment, and credentials before generating account.
                </p>
              </div>

              <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 p-5 text-xs dark:divide-slate-800 dark:border-slate-800">
                <div className="flex justify-between py-2">
                  <span className="text-slate-500">Full Name</span>
                  <span className="font-bold text-slate-900 dark:text-white">{personal.name}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-slate-500">Assigned Role</span>
                  <span className="font-bold text-blue-700 dark:text-blue-400">{employment.role.replaceAll("_", " ")}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-slate-500">Email Address (Login)</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{personal.email}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-slate-500">Phone Number</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{personal.phone || "None"}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-slate-500">Staff Number / TSC</span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {employment.staffNumber || "None"} / {employment.tscNumber || "None"}
                  </span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-slate-500">Employment Type</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{employment.employmentType}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-slate-500">Emergency Contacts</span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {emergencyContacts.filter((c) => c.fullName).length} contact(s) recorded
                  </span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-slate-500">Documents Attached</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{documents.length} document(s)</span>
                </div>
              </div>

              <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4 text-xs text-blue-900 dark:border-blue-950 dark:bg-blue-950/40 dark:text-blue-200">
                <p className="font-semibold">Security Note:</p>
                <p className="mt-0.5">
                  Submitting will securely create the user account and generate a one-time temporary password slip. The staff member will be required to change their password upon first sign-in.
                </p>
              </div>
            </div>
          )}

          {/* Stepper Navigation Buttons */}
          <div className="mt-8 flex items-center justify-between border-t border-slate-100 pt-5 dark:border-slate-800">
            <button
              type="button"
              onClick={handleBack}
              disabled={currentStep === 1}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-40 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
            >
              <ArrowLeft size={14} /> Back
            </button>

            {currentStep < 7 ? (
              <button
                type="button"
                onClick={handleNext}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-700 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-800"
              >
                Next Step <ArrowRight size={14} />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void handleFinalSubmit()}
                disabled={loading}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-6 py-2.5 text-xs font-bold text-white shadow-md hover:bg-emerald-800 disabled:opacity-50"
              >
                {loading ? "Creating Account..." : "Create Staff Account & Generate Slip"}
              </button>
            )}
          </div>
        </div>
      ) : (
        /* STEP 7 SUCCESS: PRINTABLE CREDENTIALS SLIP */
        <div className="bento-card rounded-3xl border border-emerald-200 bg-white p-6 shadow-xl sm:p-10 dark:border-emerald-900/60 dark:bg-slate-900">
          <div className="text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
              <CheckCircle2 size={36} />
            </div>
            <h3 className="mt-4 text-2xl font-black text-slate-900 dark:text-white">
              Staff Account Successfully Created!
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Official Mary Royal School login credentials generated.
            </p>
          </div>

          {/* Printable Credentials Slip Box */}
          <div className="mt-8 rounded-3xl border-2 border-dashed border-blue-200 bg-blue-50/50 p-6 sm:p-8 dark:border-blue-900/60 dark:bg-blue-950/20">
            <div className="flex items-center justify-between border-b border-blue-200/60 pb-4 dark:border-blue-900/60">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-800 dark:text-blue-300">
                  Mary Royal School · Obunga, Kisumu
                </span>
                <h4 className="text-base font-black text-slate-900 dark:text-white">Staff Login Credentials Slip</h4>
              </div>
              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-700 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-blue-800"
              >
                <Printer size={13} /> Print Slip
              </button>
            </div>

            <div className="mt-6 space-y-3 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Staff Member Name:</span>
                <span className="font-bold text-slate-900 dark:text-white">{successResult.user.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Assigned Role:</span>
                <span className="font-bold text-blue-700 dark:text-blue-400">
                  {successResult.user.role.replaceAll("_", " ")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Username / Email:</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">{successResult.user.email}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-white p-3 border border-blue-200 dark:bg-slate-900 dark:border-blue-900">
                <span className="text-slate-500">Temporary Password:</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-black text-blue-800 dark:text-blue-300">
                    {successResult.temporaryPassword}
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(
                        `Mary Royal School Staff Credentials\nName: ${successResult.user.name}\nEmail: ${successResult.user.email}\nTemporary Password: ${successResult.temporaryPassword}`
                      );
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 dark:hover:bg-slate-800"
                    title="Copy Credentials"
                  >
                    {copied ? <Check size={15} className="text-emerald-600" /> : <Copy size={15} />}
                  </button>
                </div>
              </div>
            </div>

            <p className="mt-4 text-[11px] text-slate-500 text-center">
              ⚠️ This temporary password is only displayed once. Hand this slip to the staff member in private. They must change their password immediately upon initial sign-in.
            </p>
          </div>

          <div className="mt-8 flex justify-center gap-3">
            <Link
              href={`/staff/${successResult.user.id}`}
              className="rounded-xl bg-blue-700 px-6 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-800"
            >
              View Full Staff Profile →
            </Link>
            <Link
              href="/staff"
              className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
            >
              Back to Directory
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
