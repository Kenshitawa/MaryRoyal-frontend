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
  Printer,
  Plus,
  Trash2,
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

  // Teaching and Class assignments state
  const [teachingAssignments, setTeachingAssignments] = useState<{ grade: string; subject: string }[]>(
    staff.assignments || []
  );
  const [classTeacherGrade, setClassTeacherGrade] = useState<string>(
    staff.classTeacherAssignments?.[0]?.grade || ""
  );
  const [allocGrade, setAllocGrade] = useState<string>("Grade 1");
  const [allocSubject, setAllocSubject] = useState<string>("Mathematics");

  const STANDARD_GRADES = ["PP1", "PP2", ...Array.from({ length: 9 }, (_, i) => `Grade ${i + 1}`)];
  const STANDARD_SUBJECTS = [
    "Mathematics",
    "English",
    "Kiswahili",
    "Integrated Science",
    "Social Studies",
    "CRE",
    "Creative Arts",
    "Agriculture",
    "Environmental Activities",
    "Pre-Technical Studies",
  ];

  function handleAddAssignment() {
    if (teachingAssignments.some((a) => a.grade === allocGrade && a.subject === allocSubject)) return;
    setTeachingAssignments([...teachingAssignments, { grade: allocGrade, subject: allocSubject }]);
  }

  function handleRemoveAssignment(grade: string, subject: string) {
    setTeachingAssignments(teachingAssignments.filter((a) => !(a.grade === grade && a.subject === subject)));
  }

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
    ...(actor.role === "DIRECTOR" ? [{ id: "Activity", label: "Edit History", icon: Activity }] : []),
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
        body: JSON.stringify({
          ...editForm,
          teachingAssignments,
          classTeacherGrade: classTeacherGrade || null,
        }),
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

  function printStaffSlip() {
    const printWindow = window.open("", "_blank", "width=850,height=950");
    if (!printWindow) return;
    const doc = printWindow.document;
    doc.title = `Mary Royal School · Staff Record Slip · ${staff.name}`;
    const style = doc.createElement("style");
    style.textContent = `
      * { box-sizing: border-box; }
      body { margin: 0; padding: 24px; background: #f1f5f9; font: 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #0f172a; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .action-bar { max-width: 800px; margin: 0 auto 16px; display: flex; justify-content: space-between; align-items: center; }
      .action-btn { background: #1d4ed8; color: #fff; border: none; border-radius: 8px; padding: 8px 16px; font-weight: 700; font-size: 13px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
      .action-btn:hover { background: #1e40af; }
      .close-btn { background: #e2e8f0; color: #334155; border: none; border-radius: 8px; padding: 8px 14px; font-weight: 600; font-size: 13px; cursor: pointer; }
      .close-btn:hover { background: #cbd5e1; }
      .slip { max-width: 800px; margin: 0 auto; padding: 36px 40px; background: #fff; border: 1px solid #cbd5e1; border-radius: 16px; box-shadow: 0 4px 16px rgba(15, 23, 42, 0.06); }
      .header { display: flex; align-items: flex-start; justify-content: space-between; border-bottom: 2.5px solid #1d4ed8; padding-bottom: 18px; margin-bottom: 20px; gap: 16px; }
      .brand-box { display: flex; align-items: center; gap: 14px; }
      .brand-logo { width: 70px; height: 70px; object-fit: contain; border-radius: 12px; background: #fff; padding: 4px; border: 1px solid #dbeafe; }
      .brand-text h1 { margin: 0; font-size: 22px; font-weight: 900; color: #1e3a8a; letter-spacing: -0.02em; }
      .brand-text p { margin: 3px 0 0; font-size: 11.5px; color: #475569; }
      .brand-text .motto { color: #1d4ed8; font-weight: 600; font-style: italic; }
      .dossier-meta { text-align: right; }
      .badge-dossier { display: inline-block; padding: 4px 12px; background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; border-radius: 9999px; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; }
      .meta-ref { margin-top: 6px; font-size: 11px; font-family: monospace; font-weight: bold; color: #334155; }
      .meta-date { margin-top: 2px; font-size: 10.5px; color: #64748b; }
      .section-card { margin-bottom: 16px; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; break-inside: avoid; }
      .section-header { background: #f8fafc; padding: 8px 14px; border-bottom: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: space-between; }
      .section-title { font-size: 11.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; color: #1e3a8a; margin: 0; }
      .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px 14px; padding: 12px 14px; }
      .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 14px; padding: 12px 14px; }
      .item { display: flex; flex-direction: column; }
      .item-full { grid-column: 1 / -1; }
      .item-label { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.03em; }
      .item-val { font-size: 12.5px; font-weight: 600; color: #0f172a; margin-top: 2px; word-break: break-word; }
      .item-mono { font-family: monospace; font-weight: 700; color: #1e3a8a; }
      .alloc-badge { display: inline-block; background: #eff6ff; padding: 4px 9px; border-radius: 6px; font-size: 11.5px; margin: 2px 4px 2px 0; border: 1px solid #bfdbfe; color: #1e3a8a; }
      .alloc-badge strong { color: #1d4ed8; }
      .table-clean { width: 100%; border-collapse: collapse; font-size: 12px; }
      .table-clean th { background: #f8fafc; text-align: left; padding: 7px 12px; font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 700; border-bottom: 1px solid #e2e8f0; }
      .table-clean td { padding: 8px 12px; border-bottom: 1px solid #f1f5f9; color: #1e293b; }
      .footer-sign { margin-top: 28px; padding-top: 18px; border-top: 1.5px solid #cbd5e1; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; break-inside: avoid; }
      .sign-box { border-top: 1px solid #94a3b8; padding-top: 6px; text-align: center; font-size: 11px; color: #475569; }
      .sign-title { font-weight: 700; color: #1e293b; }
      .watermark { text-align: center; margin-top: 20px; font-size: 10px; color: #94a3b8; letter-spacing: 0.05em; text-transform: uppercase; }
      @media print {
        body { padding: 0; background: #fff; }
        .action-bar { display: none !important; }
        .slip { border: none !important; box-shadow: none !important; padding: 12px !important; max-width: 100% !important; }
        .no-print { display: none !important; }
      }
    `;
    doc.head.append(style);

    const formatDt = (v?: DateLike | null) => (v ? toDate(v).toLocaleDateString("en-KE", { dateStyle: "medium" }) : "Not recorded");

    const slip = doc.createElement("div");
    slip.className = "slip";
    slip.innerHTML = `
      <div class="action-bar no-print">
        <button class="action-btn" onclick="window.print()">🖨️ Print Record Slip / Save as PDF</button>
        <button class="close-btn" onclick="window.close()">✕ Close</button>
      </div>

      <div class="header">
        <div class="brand-box">
          <img class="brand-logo" src="${window.location.origin}/mary-royal-logo.png" alt="Mary Royal School Crest" />
          <div class="brand-text">
            <h1>Mary Royal School</h1>
            <p>Obunga, Kisumu · Kenya CBE Centre · <span class="motto">&ldquo;Hard work pays&rdquo;</span></p>
            <p>Tel: +254 700 000000 · Official Institutional Personnel Dossier</p>
          </div>
        </div>
        <div class="dossier-meta">
          <span class="badge-dossier">${staff.suspended ? "Suspended Record" : "Active Staff Record"}</span>
          <div class="meta-ref">REF: MRS/STF/${staff.staffNumber || staff.id.slice(-6).toUpperCase()}</div>
          <div class="meta-date">Issued: ${new Date().toLocaleDateString("en-KE", { dateStyle: "long" })}</div>
        </div>
      </div>

      <!-- Section 1: Identification & Personal Info -->
      <div class="section-card">
        <div class="section-header">
          <h2 class="section-title">1. Staff Member Personal Identification</h2>
        </div>
        <div class="grid">
          <div class="item">
            <span class="item-label">Full Legal Name</span>
            <span class="item-val" style="font-size: 14px; font-weight: 800; color: #1e3a8a;">${staff.name}</span>
          </div>
          <div class="item">
            <span class="item-label">Staff Identification No</span>
            <span class="item-val item-mono">${staff.staffNumber || "N/A"}</span>
          </div>
          <div class="item">
            <span class="item-label">TSC Registration No</span>
            <span class="item-val item-mono">${staff.tscNumber || "N/A"}</span>
          </div>
          <div class="item">
            <span class="item-label">National ID / Passport</span>
            <span class="item-val item-mono">${profile?.nationalId || "Not recorded"}</span>
          </div>
          <div class="item">
            <span class="item-label">Date of Birth</span>
            <span class="item-val">${formatDt(profile?.dateOfBirth)}</span>
          </div>
          <div class="item">
            <span class="item-label">Nationality &amp; Status</span>
            <span class="item-val">${profile?.nationality || "Kenyan"} · ${profile?.maritalStatus || "Not specified"}</span>
          </div>
        </div>
      </div>

      <!-- Section 2: Employment & Designation -->
      <div class="section-card">
        <div class="section-header">
          <h2 class="section-title">2. Employment &amp; Institutional Designation</h2>
        </div>
        <div class="grid">
          <div class="item">
            <span class="item-label">Official Designation / Title</span>
            <span class="item-val">${staff.employmentTitle || roleLabel}</span>
          </div>
          <div class="item">
            <span class="item-label">Department</span>
            <span class="item-val">${profile?.department || "General Academic"}</span>
          </div>
          <div class="item">
            <span class="item-label">Employment Type</span>
            <span class="item-val">${profile?.employmentType || "Permanent & Pensionable"}</span>
          </div>
          <div class="item">
            <span class="item-label">Date Joined School</span>
            <span class="item-val">${formatDt(profile?.dateJoined)}</span>
          </div>
          <div class="item">
            <span class="item-label">Reporting Line Manager</span>
            <span class="item-val">${profile?.lineManager || "Head Teacher / Director"}</span>
          </div>
          <div class="item">
            <span class="item-label">Experience</span>
            <span class="item-val">${profile?.yearsOfExperience ? `${profile.yearsOfExperience} Years Experience` : "Not recorded"}</span>
          </div>
        </div>
      </div>

      <!-- Section 3: Contact & Residence -->
      <div class="section-card">
        <div class="section-header">
          <h2 class="section-title">3. Contact &amp; Residential Particulars</h2>
        </div>
        <div class="grid">
          <div class="item">
            <span class="item-label">Official System Email</span>
            <span class="item-val item-mono" style="font-size: 12px;">${staff.email}</span>
          </div>
          <div class="item">
            <span class="item-label">Primary Mobile Phone</span>
            <span class="item-val">${staff.phone || "Not recorded"}</span>
          </div>
          <div class="item">
            <span class="item-label">Alternative Contact Phone</span>
            <span class="item-val">${profile?.alternatePhone || "None recorded"}</span>
          </div>
          <div class="item">
            <span class="item-label">County of Residence</span>
            <span class="item-val">${profile?.county || "Kisumu"}</span>
          </div>
          <div class="item item-full">
            <span class="item-label">Physical Residence Address</span>
            <span class="item-val">${profile?.residenceAddress || "Not recorded"}</span>
          </div>
        </div>
      </div>

      <!-- Section 4: Professional Qualifications & Education -->
      <div class="section-card">
        <div class="section-header">
          <h2 class="section-title">4. Educational History &amp; Professional Certifications</h2>
        </div>
        <div class="grid-2">
          <div class="item">
            <span class="item-label">Highest Academic / Educational History</span>
            <span class="item-val">${profile?.educationHistory || staff.qualifications || "Standard teacher training background"}</span>
          </div>
          <div class="item">
            <span class="item-label">Professional Qualifications</span>
            <span class="item-val">${profile?.professionalQualifications || "Registered & Verified Teacher"}</span>
          </div>
          <div class="item">
            <span class="item-label">Specializations / Learning Areas</span>
            <span class="item-val">${profile?.specializations || "CBC Primary & Junior School Curriculum"}</span>
          </div>
          <div class="item">
            <span class="item-label">Accreditations &amp; Certificates</span>
            <span class="item-val">${profile?.certificates || "Certificates verified by Administration"}</span>
          </div>
        </div>
      </div>

      <!-- Section 5: CBC Teaching & Class Allocation -->
      <div class="section-card">
        <div class="section-header">
          <h2 class="section-title">5. CBC Class Teacher &amp; Subject Teaching Allocations</h2>
        </div>
        <div class="grid-2">
          <div class="item item-full">
            <span class="item-label">Class Teacher Allocation</span>
            <span class="item-val" style="font-size: 13px; font-weight: 700; color: #1e3a8a;">
              ${classTeacherGrade ? `Class Teacher for: ${classTeacherGrade}` : "Not assigned as Class Teacher (Subject Specialist)"}
            </span>
          </div>
          <div class="item item-full">
            <span class="item-label">Assigned Teaching Subjects (${teachingAssignments.length})</span>
            <div style="margin-top: 6px;">
              ${teachingAssignments.length > 0
                ? teachingAssignments.map(a => `<span class="alloc-badge"><strong>${a.grade}</strong>: ${a.subject}</span>`).join("")
                : "<span style='color: #64748b;'>No subjects currently assigned.</span>"}
            </div>
          </div>
        </div>
      </div>

      <!-- Section 6: Emergency Contacts -->
      ${profile?.emergencyContacts && profile.emergencyContacts.length > 0 ? `
      <div class="section-card">
        <div class="section-header">
          <h2 class="section-title">6. Emergency Contacts &amp; Next of Kin</h2>
        </div>
        <table class="table-clean">
          <thead>
            <tr>
              <th>Contact Name</th>
              <th>Relationship</th>
              <th>Phone Number</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${profile.emergencyContacts.map(c => `
              <tr>
                <td style="font-weight: 700;">${c.fullName}</td>
                <td>${c.relationship}</td>
                <td style="font-family: monospace;">${c.phone}</td>
                <td>${c.isNextOfKin ? "<strong style='color:#1d4ed8;'>Primary Next of Kin</strong>" : "Emergency Contact"}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
      ` : ""}

      <!-- Section 7: Statutory & Bank Details (Only when viewer has canViewStatutory) -->
      ${canViewStatutory ? `
      <div class="section-card">
        <div class="section-header" style="background: #eff6ff;">
          <h2 class="section-title" style="color: #1e40af;">7. Statutory Identifiers &amp; Salary Bank Details</h2>
          <span style="font-size: 10px; font-weight: 800; color: #1d4ed8; text-transform: uppercase;">Administrative Copy</span>
        </div>
        <div class="grid">
          <div class="item">
            <span class="item-label">KRA Tax PIN</span>
            <span class="item-val item-mono">${profile?.kraPin || "Not recorded"}</span>
          </div>
          <div class="item">
            <span class="item-label">NSSF Number</span>
            <span class="item-val item-mono">${profile?.nssfNumber || "Not recorded"}</span>
          </div>
          <div class="item">
            <span class="item-label">SHA / Health Insurance Number</span>
            <span class="item-val item-mono">${profile?.shaNumber || "Not recorded"}</span>
          </div>
          <div class="item">
            <span class="item-label">Designated Bank</span>
            <span class="item-val">${profile?.bankName || "Not recorded"}</span>
          </div>
          <div class="item">
            <span class="item-label">Bank Account Name</span>
            <span class="item-val">${profile?.bankAccountName || staff.name}</span>
          </div>
          <div class="item">
            <span class="item-label">Bank Account &amp; Branch</span>
            <span class="item-val item-mono">${profile?.bankAccountNumber ? `${profile.bankAccountNumber} (${profile.bankBranch || "Kisumu"})` : "Not recorded"}</span>
          </div>
        </div>
      </div>
      ` : ""}

      <!-- Section 8: Sign-off & Verification -->
      <div class="footer-sign">
        <div>
          <div style="height: 48px;"></div>
          <div class="sign-box">
            <div class="sign-title">${staff.name}</div>
            <div>Staff Member Signature &amp; Date</div>
          </div>
        </div>
        <div>
          <div style="height: 48px;"></div>
          <div class="sign-box">
            <div class="sign-title">Head Teacher / Director</div>
            <div>Mary Royal School Official Seal &amp; Stamp</div>
          </div>
        </div>
      </div>

      <div class="watermark">
        Mary Royal School · Confidential Official Personnel Slip · Hard Work Pays · Form MRS-HR-01
      </div>
    `;

    doc.body.append(slip);
    setTimeout(() => {
      printWindow.focus();
    }, 250);
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
            <button
              onClick={printStaffSlip}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-white/20"
            >
              <Printer size={13} /> Print Staff Slip
            </button>

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
      {activeTab === "Activity" && actor.role === "DIRECTOR" && (
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
                      {toDate(h.createdAt).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}
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

              {/* Teaching Classes & Class Teacher Assignment */}
              <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-900/40 dark:bg-blue-950/20">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-blue-950 dark:text-blue-200">
                      CBE Class &amp; Subject Allocations
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Assign teaching subjects and Class Teacher role for this staff member.
                    </p>
                  </div>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2 text-xs">
                  <div>
                    <label className="block font-semibold">Class Teacher Assignment</label>
                    <select
                      value={classTeacherGrade}
                      onChange={(e) => setClassTeacherGrade(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 dark:border-slate-700 dark:bg-slate-800"
                    >
                      <option value="">None (Subject Teacher Only)</option>
                      {STANDARD_GRADES.map((g) => (
                        <option key={g} value={g}>
                          Class Teacher: {g}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Assigned subjects */}
                <div className="mt-4">
                  <label className="block font-semibold text-xs text-slate-700 dark:text-slate-300">
                    Teaching Subject Allocations ({teachingAssignments.length})
                  </label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {teachingAssignments.map((a, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-white px-3 py-1 text-xs font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 shadow-xs"
                      >
                        <strong>{a.grade}</strong>: {a.subject}
                        <button
                          type="button"
                          aria-label={`Remove ${a.grade} ${a.subject}`}
                          onClick={() => handleRemoveAssignment(a.grade, a.subject)}
                          className="text-slate-400 hover:text-rose-600 ml-1"
                        >
                          <Trash2 size={12} />
                        </button>
                      </span>
                    ))}
                    {teachingAssignments.length === 0 && (
                      <p className="text-[11px] text-slate-400">No teaching subjects assigned yet.</p>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <select
                      aria-label="Grade level to allocate"
                      value={allocGrade}
                      onChange={(e) => setAllocGrade(e.target.value)}
                      className="rounded-xl border border-slate-200 p-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                    >
                      {STANDARD_GRADES.map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label="Subject to allocate"
                      value={allocSubject}
                      onChange={(e) => setAllocSubject(e.target.value)}
                      className="rounded-xl border border-slate-200 p-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                    >
                      {STANDARD_SUBJECTS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleAddAssignment}
                      className="inline-flex items-center gap-1 rounded-xl bg-blue-700 px-3 py-2 text-xs font-bold text-white hover:bg-blue-800"
                    >
                      <Plus size={13} /> Add Allocation
                    </button>
                  </div>
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
