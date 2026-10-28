"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Save, ArrowLeft, Loader2, CheckCircle2 } from "lucide-react";

interface LearnerEditFormProps {
  learner: {
    id: string;
    admissionNo: string;
    name: string;
    grade: string;
    gender: string;
    admissionStatus: string;
    profile: {
      stream?: string | null;
      upiNumber?: string | null;
      dateOfBirth?: string | null;
      nationality?: string | null;
      religion?: string | null;
      languagesSpoken?: string | null;
      county?: string | null;
      subCounty?: string | null;
      ward?: string | null;
      village?: string | null;
      physicalAddress?: string | null;
      knownConditions?: string | null;
      allergies?: string | null;
      currentMedication?: string | null;
      specialNeeds?: string | null;
      bloodGroup?: string | null;
      doctorOrHospital?: string | null;
      healthInsurance?: string | null;
    } | null;
  };
}

export default function LearnerEditForm({ learner }: LearnerEditFormProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    name: learner.name,
    grade: learner.grade,
    gender: learner.gender,
    admissionStatus: learner.admissionStatus,
    stream: learner.profile?.stream ?? "",
    upiNumber: learner.profile?.upiNumber ?? "",
    dateOfBirth: learner.profile?.dateOfBirth ? learner.profile.dateOfBirth.slice(0, 10) : "",
    nationality: learner.profile?.nationality ?? "Kenyan",
    religion: learner.profile?.religion ?? "",
    languagesSpoken: learner.profile?.languagesSpoken ?? "",
    county: learner.profile?.county ?? "Kisumu",
    subCounty: learner.profile?.subCounty ?? "Kisumu Central",
    ward: learner.profile?.ward ?? "Railways",
    village: learner.profile?.village ?? "Obunga",
    physicalAddress: learner.profile?.physicalAddress ?? "",
    knownConditions: learner.profile?.knownConditions ?? "",
    allergies: learner.profile?.allergies ?? "",
    currentMedication: learner.profile?.currentMedication ?? "",
    specialNeeds: learner.profile?.specialNeeds ?? "",
    bloodGroup: learner.profile?.bloodGroup ?? "",
    doctorOrHospital: learner.profile?.doctorOrHospital ?? "",
    healthInsurance: learner.profile?.healthInsurance ?? ""
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setSuccess(false);

    try {
      const res = await fetch(`/api/learners/${learner.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to update learner profile.");
      } else {
        setSuccess(true);
        setTimeout(() => {
          router.push(`/learners/${learner.id}`);
          router.refresh();
        }, 1200);
      }
    } catch {
      setError("Network error while saving learner profile.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5 dark:border-slate-800">
        <div>
          <Link
            href={`/learners/${learner.id}`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:text-blue-900 dark:text-blue-400"
          >
            <ArrowLeft size={14} /> Back to Profile
          </Link>
          <h1 className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
            Edit Learner Profile · {learner.name}
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Admission No: <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{learner.admissionNo}</span> (Secretary & Head Teacher access only)
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/learners/${learner.id}`}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-700/20 transition hover:bg-blue-800 disabled:opacity-50"
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            Save Profile
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-bold text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
          {error}
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-bold text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
          <CheckCircle2 size={16} /> Changes saved successfully! Redirecting to profile…
        </div>
      )}

      {/* Section 1: Core Bio */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-base font-extrabold text-slate-900 dark:text-white">1. Core Biography</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">Full Name *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-medium dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">Class / Grade *</label>
            <input
              type="text"
              required
              value={formData.grade}
              onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
              className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-medium dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">Stream</label>
            <input
              type="text"
              placeholder="e.g. Blue, East"
              value={formData.stream}
              onChange={(e) => setFormData({ ...formData, stream: e.target.value })}
              className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-medium dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">Gender *</label>
            <select
              value={formData.gender}
              onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
              className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-medium dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">Status</label>
            <select
              value={formData.admissionStatus}
              onChange={(e) => setFormData({ ...formData, admissionStatus: e.target.value })}
              className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-medium dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="APPROVED">Active / Approved</option>
              <option value="PENDING">Pending Admission</option>
              <option value="TRANSFERRED">Transferred</option>
              <option value="WITHDRAWN">Withdrawn</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">UPI / NEMIS Number</label>
            <input
              type="text"
              placeholder="e.g. N12345678"
              value={formData.upiNumber}
              onChange={(e) => setFormData({ ...formData, upiNumber: e.target.value })}
              className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-medium dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">Date of Birth</label>
            <input
              type="date"
              value={formData.dateOfBirth}
              onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
              className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-medium dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">Nationality</label>
            <input
              type="text"
              value={formData.nationality}
              onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
              className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-medium dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">Religion</label>
            <input
              type="text"
              value={formData.religion}
              onChange={(e) => setFormData({ ...formData, religion: e.target.value })}
              className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-medium dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
        </div>
      </section>

      {/* Section 2: Residence & Location */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-base font-extrabold text-slate-900 dark:text-white">2. Residence & Location</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">County</label>
            <input
              type="text"
              value={formData.county}
              onChange={(e) => setFormData({ ...formData, county: e.target.value })}
              className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-medium dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">Sub-County</label>
            <input
              type="text"
              value={formData.subCounty}
              onChange={(e) => setFormData({ ...formData, subCounty: e.target.value })}
              className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-medium dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">Ward / Estate</label>
            <input
              type="text"
              value={formData.ward}
              onChange={(e) => setFormData({ ...formData, ward: e.target.value })}
              className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-medium dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">Village / Area</label>
            <input
              type="text"
              value={formData.village}
              onChange={(e) => setFormData({ ...formData, village: e.target.value })}
              className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-medium dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">Physical Address & Landmarks</label>
            <input
              type="text"
              value={formData.physicalAddress}
              onChange={(e) => setFormData({ ...formData, physicalAddress: e.target.value })}
              className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-medium dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
        </div>
      </section>

      {/* Section 3: Health & Special Needs */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-base font-extrabold text-slate-900 dark:text-white">3. Health & Special Needs (Restricted)</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">Blood Group</label>
            <input
              type="text"
              placeholder="e.g. O+, A-, B+"
              value={formData.bloodGroup}
              onChange={(e) => setFormData({ ...formData, bloodGroup: e.target.value })}
              className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-medium dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">Known Conditions</label>
            <input
              type="text"
              placeholder="e.g. Asthma"
              value={formData.knownConditions}
              onChange={(e) => setFormData({ ...formData, knownConditions: e.target.value })}
              className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-medium dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">Allergies</label>
            <input
              type="text"
              placeholder="e.g. Peanuts, Penicillin"
              value={formData.allergies}
              onChange={(e) => setFormData({ ...formData, allergies: e.target.value })}
              className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-medium dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">Current Medication</label>
            <input
              type="text"
              value={formData.currentMedication}
              onChange={(e) => setFormData({ ...formData, currentMedication: e.target.value })}
              className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-medium dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">Special Needs / Disabilities</label>
            <input
              type="text"
              value={formData.specialNeeds}
              onChange={(e) => setFormData({ ...formData, specialNeeds: e.target.value })}
              className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-medium dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">Preferred Hospital / Clinic</label>
            <input
              type="text"
              placeholder="e.g. Jaramogi Oginga Odinga TRH"
              value={formData.doctorOrHospital}
              onChange={(e) => setFormData({ ...formData, doctorOrHospital: e.target.value })}
              className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-medium dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
        </div>
      </section>

      <div className="flex justify-end gap-3 pt-4">
        <Link
          href={`/learners/${learner.id}`}
          className="rounded-xl border border-slate-200 px-5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-6 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-700/20 transition hover:bg-blue-800 disabled:opacity-50"
        >
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          Save Profile
        </button>
      </div>
    </form>
  );
}
