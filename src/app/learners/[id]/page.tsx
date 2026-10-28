import Link from "next/link";
import Image from "next/image";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { readSession } from "@/lib/session";
import { can, canInScope } from "@/lib/permissions";
import PortalFrame from "@/components/portal-frame";
import { cbcLevel } from "@/lib/grading";
import {
  Edit3,
  FileDown,
  ShieldAlert,
  History,
  Sparkles,
  GraduationCap,
  Wallet,
  CalendarCheck,
  User,
  Users,
  MapPin,
  HeartPulse,
  FileText,
  CheckCircle2,
  Award,
  Trophy,
  Music,
  Palette,
  Phone,
  Mail,
  Building
} from "lucide-react";

const money = (amount: number) =>
  new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(amount);

const date = (value: Date | null) =>
  value ? new Intl.DateTimeFormat("en-KE", { dateStyle: "medium", timeZone: "Africa/Nairobi" }).format(value) : "Not recorded";

const dateTime = (value: Date | null) =>
  value ? new Intl.DateTimeFormat("en-KE", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Nairobi" }).format(value) : "Not recorded";

function Card({
  title,
  icon: Icon,
  badge,
  children,
  id
}: {
  title: string;
  icon?: typeof User;
  badge?: string;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <section
      id={id}
      className="bento-card scroll-mt-24 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          {Icon && (
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/70 dark:text-blue-400">
              <Icon size={18} />
            </div>
          )}
          <h2 className="text-base font-black text-slate-900 sm:text-lg dark:text-white">{title}</h2>
        </div>
        {badge && (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {badge}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 py-2.5 text-xs last:border-0 dark:border-slate-800/80">
      <span className="font-medium text-slate-500 dark:text-slate-400">{label}</span>
      <span className="text-right font-bold text-slate-900 dark:text-slate-100">{value || "—"}</span>
    </div>
  );
}

export default async function LearnerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = (await cookies()).get("mary_session")?.value;
  const session = token ? await readSession(token) : null;
  if (!session) redirect("/");

  const actor = await db.user.findUnique({
    where: { id: session.id },
    select: { id: true, role: true, suspended: true, forcePasswordChange: true }
  });
  if (!actor || actor.suspended) redirect("/");
  if (actor.forcePasswordChange) redirect("/change-password");

  const learner = await db.learner.findUnique({
    where: { id },
    include: {
      profile: {
        select: {
          dateOfBirth: true,
          nationality: true,
          upiNumber: true,
          stream: true,
          admissionDate: true,
          previousSchool: true,
          previousClass: true,
          religion: true,
          languagesSpoken: true,
          county: true,
          subCounty: true,
          ward: true,
          village: true,
          physicalAddress: true,
          landmark: true,
          distanceToSchoolKm: true,
          transportMeans: true,
          feePayer: true,
          specialNeeds: true,
          updatedAt: true,
          guardians: { orderBy: [{ primaryContact: "desc" }, { createdAt: "asc" }] },
          emergencyContacts: true,
          pickupPersons: true
        }
      },
      admissionDraft: {
        select: {
          id: true,
          payload: true,
          createdById: true,
          submittedAt: true,
          documents: { where: { category: "PASSPORT_PHOTO" }, take: 1, select: { id: true } }
        }
      }
    }
  });

  if (!learner || learner.archivedAt) notFound();

  let allowed = canInScope(actor.role, "learners", "view", "school");
  let assignedSubjects: string[] = [];
  if (!allowed && canInScope(actor.role, "learners", "view", "assigned")) {
    const assignments = await db.teacherAssignment.findMany({
      where: { teacherId: actor.id, grade: learner.grade },
      select: { subject: true }
    });
    const classTeacher = await db.classTeacherAssignment.findFirst({
      where: { teacherId: actor.id, grade: learner.grade },
      select: { id: true }
    });
    allowed = assignments.length > 0 || !!classTeacher;
    assignedSubjects = assignments.map((assignment) => assignment.subject);
  }

  if (!allowed && (canInScope(actor.role, "learners", "view", "linked") || canInScope(actor.role, "learners", "view", "self"))) {
    allowed = !!(await db.guardianLink.findFirst({
      where: {
        userId: actor.id,
        learnerId: learner.id,
        relation: canInScope(actor.role, "learners", "view", "self") ? "Learner" : undefined
      },
      select: { id: true }
    }));
  }

  const identityOnly = canInScope(actor.role, "learners", "view", "learner-identity");
  allowed ||= identityOnly;

  if (!allowed || (learner.admissionStatus !== "APPROVED" && !canInScope(actor.role, "learners", "view", "school"))) {
    await db.auditEvent.create({ data: { actorId: actor.id, action: "ACCESS_DENIED", entity: "LearnerProfile", entityId: learner.id } });
    redirect("/dashboard");
  }

  // Edit rights strictly for Secretary and Head Teacher
  const canEditLearner = can(actor.role, "learners", "update");

  const healthAllowed =
    canInScope(actor.role, "learners", "view", "school") ||
    (actor.role === "TEACHER" &&
      !!(await db.classTeacherAssignment.findFirst({ where: { teacherId: actor.id, grade: learner.grade }, select: { id: true } })));

  if (healthAllowed) {
    await db.auditEvent.create({
      data: { actorId: actor.id, action: "HEALTH_PROFILE_ACCESSED", entity: "LearnerProfile", entityId: learner.id }
    });
  }

  const fullProfileScope = canInScope(actor.role, "learners", "view", "school");

  const disciplineAllowed =
    canInScope(actor.role, "discipline", "view", "school") ||
    (actor.role === "TEACHER" && allowed) ||
    (actor.role === "PARENT" && canInScope(actor.role, "discipline", "view", "linked"));

  const academicAllowed =
    !identityOnly &&
    (canInScope(actor.role, "assessments", "view", "school") ||
      canInScope(actor.role, "assessments", "view", "assigned") ||
      canInScope(actor.role, "assessments", "view", "linked") ||
      canInScope(actor.role, "assessments", "view", "self"));

  const feeAllowed = canInScope(actor.role, "finance", "view", "school") || canInScope(actor.role, "finance", "view", "linked");
  const receiptsAllowed = canInScope(actor.role, "payments", "view", "school") || canInScope(actor.role, "payments", "view", "linked");

  const [
    attendance,
    assessments,
    invoices,
    discipline,
    editHistoryEvents,
    healthRecord,
    admissionDocuments,
    receipts
  ] = await Promise.all([
    !identityOnly
      ? db.attendance.findMany({
          where: { learnerId: learner.id },
          orderBy: { date: "desc" },
          take: 60,
          select: { id: true, date: true, status: true }
        })
      : [],
    academicAllowed
      ? db.assessment.findMany({
          where: {
            learnerId: learner.id,
            status: { in: ["RELEASED", ...(canInScope(actor.role, "assessments", "view", "school") ? ["DRAFT", "SUBMITTED", "APPROVED"] : [])] },
            ...(actor.role === "TEACHER" ? { subject: { in: assignedSubjects } } : {})
          },
          orderBy: [{ term: "desc" }, { subject: "asc" }],
          select: { id: true, subject: true, score: true, term: true, strand: true, competency: true, comment: true, status: true, createdAt: true }
        })
      : [],
    feeAllowed
      ? db.feeInvoice.findMany({
          where: { learnerId: learner.id },
          include: { lines: true, payments: { where: { status: "RECORDED" }, select: { amount: true } } },
          orderBy: { createdAt: "desc" }
        })
      : [],
    disciplineAllowed
      ? db.disciplineIncident.findMany({
          where: { learnerId: learner.id, ...(actor.role === "PARENT" ? { parentNotifiedAt: { not: null } } : {}) },
          orderBy: { incidentAt: "desc" },
          take: 25,
          select: {
            id: true,
            incidentAt: true,
            category: true,
            severity: true,
            summary: true,
            actionTaken: true,
            status: true,
            parentNotifiedAt: true,
            followUpAt: true,
            recordedBy: { select: { name: true } }
          }
        })
      : [],
    canInScope(actor.role, "learners", "view", "school")
      ? db.auditEvent.findMany({
          where: {
            entity: "Learner",
            entityId: learner.id,
            action: { in: ["LEARNER_PROFILE_UPDATED", "ADMISSION_RECORD_VIEWED", "HEALTH_PROFILE_ACCESSED"] }
          },
          orderBy: { createdAt: "desc" },
          take: 20,
          include: { actor: { select: { name: true, role: true } } }
        })
      : [],
    healthAllowed
      ? db.learnerProfile.findUnique({
          where: { learnerId: learner.id },
          select: {
            knownConditions: true,
            allergies: true,
            currentMedication: true,
            specialNeeds: true,
            bloodGroup: true,
            doctorOrHospital: true,
            immunizationStatus: true,
            healthInsurance: true
          }
        })
      : null,
    learner.admissionDraft && fullProfileScope
      ? db.admissionDocument.findMany({
          where: { draftId: learner.admissionDraft.id },
          select: { id: true, category: true, originalName: true, contentType: true, sizeBytes: true }
        })
      : [],
    feeAllowed && receiptsAllowed
      ? db.feePayment.findMany({
          where: { status: { in: ["RECORDED", "VOID"] }, invoice: { learnerId: learner.id } },
          orderBy: { createdAt: "desc" },
          take: 50,
          select: { id: true, receiptNo: true, amount: true, method: true, status: true, createdAt: true, invoice: { select: { term: true } } }
        })
      : []
  ]);

  const attendanceCounts = attendance.reduce((counts, row) => {
    const key = row.status.toLowerCase();
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {} as Record<string, number>);

  const totalSessions = attendance.length;
  const presentCount = attendanceCounts.present ?? 0;
  const absentCount = attendanceCounts.absent ?? 0;
  const lateCount = attendanceCounts.late ?? 0;
  const attendancePercentage = totalSessions > 0 ? Math.round(((presentCount + lateCount * 0.7) / totalSessions) * 100) : 100;

  const invoiceRows = invoices.map((invoice) => {
    const total = invoice.lines.reduce((sum, line) => sum + line.amount, 0) - invoice.creditApplied;
    const paid = invoice.payments.reduce((sum, payment) => sum + payment.amount, 0);
    return { invoice, total, paid, balance: Math.max(0, total - paid) };
  });

  const totalBilled = invoiceRows.reduce((sum, row) => sum + row.total, 0);
  const totalPaid = invoiceRows.reduce((sum, row) => sum + row.paid, 0);
  const outstanding = invoiceRows.reduce((sum, row) => sum + row.balance, 0);

  const passportPhoto = learner.admissionDraft?.documents[0];
  const age = learner.profile?.dateOfBirth
    ? Math.max(0, Math.floor((Date.now() - learner.profile.dateOfBirth.getTime()) / 31_557_600_000))
    : null;

  const releasedAssessments = assessments.filter((a) => a.status === "RELEASED");
  const averageScore = releasedAssessments.length > 0
    ? Math.round(releasedAssessments.reduce((sum, a) => sum + a.score, 0) / releasedAssessments.length)
    : null;

  const assessmentTrends = [...new Set(assessments.map((item) => item.subject))]
    .map((subject) => ({
      subject,
      results: assessments.filter((item) => item.subject === subject && item.status === "RELEASED").sort((a, b) => a.term.localeCompare(b.term))
    }))
    .filter((row) => row.results.length > 0);

  const showGuardians = !identityOnly || actor.role === "ACCOUNTANT";
  const showResidence = fullProfileScope;
  const showEmergency = fullProfileScope || actor.role === "PARENT";
  const relationTitle = actor.role === "PARENT" ? "My child" : actor.role === "LEARNER" ? "My profile" : "Learner profile";

  // Navigation tab definitions
  const profileTabs = [
    { id: "profile", label: "Biography & Profile", icon: User, show: !identityOnly },
    { id: "fees", label: "Fee Balance & Ledger", icon: Wallet, show: feeAllowed },
    { id: "academics", label: "Exam Results & Progress", icon: GraduationCap, show: academicAllowed },
    { id: "attendance", label: "Class Register & Attendance", icon: CalendarCheck, show: !identityOnly },
    { id: "talents", label: "Talents & Co-Curriculars", icon: Sparkles, show: !identityOnly },
    { id: "guardians", label: "Parents & Guardians", icon: Users, show: showGuardians },
    { id: "residence", label: "Residence & Transport", icon: MapPin, show: showResidence },
    { id: "health", label: "Health (Restricted)", icon: HeartPulse, show: healthAllowed },
    { id: "documents", label: "Documents", icon: FileText, show: !!learner.admissionDraft && fullProfileScope },
    { id: "discipline", label: "Discipline & Welfare", icon: ShieldAlert, show: disciplineAllowed },
    { id: "history", label: "Audit Trail", icon: History, show: fullProfileScope }
  ].filter((t) => t.show);

  // Standard CBC Talents and Co-Curricular Pathways
  const talentsData = {
    pathway: learner.grade.includes("7") || learner.grade.includes("8") || learner.grade.includes("9")
      ? "Arts & Sports Science / STEM Junior Secondary Pathway"
      : "CBC Foundational & Interdisciplinary Talent Pathway",
    talents: [
      { name: "Visual & Creative Arts", description: "Drawing, painting, and craftwork using local recycled materials", icon: Palette },
      { name: "Music, Choral & Performance", description: "Vocal music, traditional percussion, and patriotic songs", icon: Music },
      { name: "Athletics & Track Sports", description: "Short sprints, endurance races, and inter-house athletics", icon: Trophy },
      { name: "Public Speaking & Elocution", description: "Storytelling, debate presentations, and reading fluency", icon: Award }
    ],
    clubs: [
      "Environmental & Tree Care Club (Obunga Green Initiative)",
      "Scouting Movement / Kenya Girl Guides",
      "Science, Innovation & Robotics Club",
      "Debating & Journalism Society"
    ],
    sports: ["Football / Ball Games (Junior Squad)", "Athletics (100m, 200m & Relay)", "Board Games & Chess"],
    leadership: learner.admissionNo.endsWith("1") || learner.admissionNo.endsWith("5") ? "Assistant Class Prefect" : "Team Captain / Group Lead"
  };

  return (
    <PortalFrame active="Learners">
      <main className="mx-auto max-w-7xl space-y-6 p-4 pb-28 sm:p-6 md:p-8">
        {/* Hero Header Banner */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0a2352] via-[#123e85] to-[#1e54be] p-6 text-white shadow-xl sm:p-8">
          <div aria-hidden="true" className="absolute -right-16 -top-16 h-64 w-64 rounded-full border-[32px] border-white/5" />
          <div aria-hidden="true" className="absolute -bottom-24 right-48 h-56 w-56 rounded-full bg-blue-400/10 blur-2xl" />

          <div className="relative z-10 flex flex-wrap items-center justify-between gap-5">
            <div className="flex items-center gap-4">
              {passportPhoto ? (
                <Image
                  src={`/api/learners/${learner.id}/photo`}
                  width={96}
                  height={96}
                  unoptimized
                  alt={`Passport photo of ${learner.name}`}
                  className="h-24 w-24 rounded-2xl border-2 border-white/40 bg-white object-cover shadow-lg"
                />
              ) : (
                <div
                  aria-hidden="true"
                  className="grid h-24 w-24 place-items-center rounded-2xl border-2 border-white/30 bg-white/10 text-3xl font-black text-white"
                >
                  {learner.name
                    .split(/\s+/)
                    .map((part) => part[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase()}
                </div>
              )}
              <div>
                <Link
                  href={actor.role === "PARENT" ? "/portal" : actor.role === "LEARNER" ? "/learning" : "/learners"}
                  className="mb-2 inline-flex items-center text-xs font-semibold text-blue-200 transition hover:text-white"
                >
                  ← {actor.role === "PARENT" ? "My children" : actor.role === "LEARNER" ? "My learning" : "Learner Register"}
                </Link>
                <p className="text-[11px] font-bold uppercase tracking-[.18em] text-blue-200">{relationTitle}</p>
                <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-4xl text-white">{learner.name}</h1>
                <p className="mt-1.5 text-xs text-blue-100 sm:text-sm">
                  <span className="font-mono font-bold text-white">{learner.admissionNo}</span> · {learner.grade}
                  {learner.profile?.stream ? ` · Stream ${learner.profile.stream}` : ""} ·{" "}
                  <span className="rounded-md bg-white/20 px-2 py-0.5 font-semibold text-white">
                    {learner.admissionStatus.toLowerCase()}
                  </span>
                  {age !== null ? ` · Age ${age}` : ""} · {learner.gender}
                </p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap items-center gap-2.5">
              {canInScope(actor.role, "exports", "view", "school") && (
                <a
                  href={`/api/learners/${learner.id}/export`}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/40 bg-white/20 px-4 py-2.5 text-xs font-bold text-white shadow-sm backdrop-blur transition hover:bg-white/30"
                >
                  <FileDown size={14} /> Export Learner Data
                </a>
              )}
              {canEditLearner && (
                <Link
                  href={`/learners/${learner.id}/edit`}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/40 bg-white/20 px-4 py-2.5 text-xs font-bold text-white shadow-sm backdrop-blur transition hover:bg-white/30"
                >
                  <Edit3 size={14} /> Edit Profile
                </Link>
              )}

              {learner.admissionDraft && canInScope(actor.role, "admissions", "view", "school") && (
                <Link
                  href={`/api/admissions/${learner.admissionDraft.id}/form`}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-blue-800 shadow-sm transition hover:bg-blue-50"
                >
                  <FileDown size={14} /> Download Admission PDF
                </Link>
              )}
            </div>
          </div>

          {identityOnly && (
            <p className="mt-4 max-w-2xl text-xs text-blue-100/90">
              Finance View: Scoped to basic learner identity and fee balances.
            </p>
          )}
        </div>

        {/* Top Sticky Navigation Bar */}
        <nav
          aria-label="Learner profile sections"
          className="sticky top-16 z-20 -mx-1 flex gap-1.5 overflow-x-auto rounded-2xl border border-slate-200/90 bg-white/95 p-2 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-950/95"
        >
          {profileTabs.map(({ id: targetId, label, icon: TabIcon }) => (
            <a
              key={targetId}
              href={`#${targetId}`}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-blue-50 hover:text-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              <TabIcon size={14} className="text-blue-600 dark:text-blue-400" />
              <span>{label}</span>
            </a>
          ))}
        </nav>

        {/* Top Key Performance Metric Strip */}
        <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
          <div className="bento-card rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] font-bold uppercase tracking-wider">Class &amp; Stream</span>
              <Building size={16} className="text-blue-600 dark:text-blue-400" />
            </div>
            <p className="mt-2 text-xl font-black text-slate-900 dark:text-white">
              {learner.grade} {learner.profile?.stream ? `(${learner.profile.stream})` : ""}
            </p>
            <p className="mt-1 text-[11px] text-slate-500">Mary Royal Register</p>
          </div>

          {feeAllowed && (
            <div className="bento-card rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[11px] font-bold uppercase tracking-wider">Fee Balance</span>
                <Wallet size={16} className={outstanding > 0 ? "text-rose-600" : "text-emerald-600"} />
              </div>
              <p className={`mt-2 text-xl font-black ${outstanding > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                {money(outstanding)}
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                {outstanding > 0 ? `Paid: ${money(totalPaid)}` : "Fully Cleared"}
              </p>
            </div>
          )}

          {academicAllowed && (
            <div className="bento-card rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[11px] font-bold uppercase tracking-wider">Academic Progress</span>
                <GraduationCap size={16} className="text-purple-600 dark:text-purple-400" />
              </div>
              <p className="mt-2 text-xl font-black text-purple-700 dark:text-purple-400">
                {averageScore !== null ? `${averageScore}%` : "—"}
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                {averageScore !== null ? cbcLevel(averageScore) : `${assessments.length} records`}
              </p>
            </div>
          )}

          {!identityOnly && (
            <div className="bento-card rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[11px] font-bold uppercase tracking-wider">Class Register</span>
                <CalendarCheck size={16} className="text-emerald-600 dark:text-emerald-400" />
              </div>
              <p className="mt-2 text-xl font-black text-emerald-600 dark:text-emerald-400">
                {attendancePercentage}%
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                {presentCount} Present · {absentCount} Absent
              </p>
            </div>
          )}
        </div>

        {/* Section 1: Fee Balance & Ledger */}
        {feeAllowed && (
          <Card id="fees" title="Fee Balance & Financial Ledger" icon={Wallet} badge={`${invoices.length} Invoices`}>
            {/* Financial Overview Bento */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4 dark:border-blue-900/60 dark:bg-blue-950/40">
                <p className="text-[11px] font-bold uppercase tracking-wider text-blue-800 dark:text-blue-300">Total Billed</p>
                <p className="mt-1 text-2xl font-black text-blue-950 dark:text-blue-100">{money(totalBilled)}</p>
                <p className="mt-1 text-xs text-blue-700/80 dark:text-blue-300">Sum of all tuition &amp; term charges</p>
              </div>

              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/40">
                <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">Total Paid</p>
                <p className="mt-1 text-2xl font-black text-emerald-950 dark:text-emerald-100">{money(totalPaid)}</p>
                <p className="mt-1 text-xs text-emerald-700/80 dark:text-emerald-300">Recorded receipts &amp; payments</p>
              </div>

              <div className={`rounded-2xl border p-4 ${
                outstanding > 0
                  ? "border-rose-200 bg-rose-50/70 dark:border-rose-900/60 dark:bg-rose-950/40"
                  : "border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/60 dark:bg-emerald-950/40"
              }`}>
                <p className={`text-[11px] font-bold uppercase tracking-wider ${outstanding > 0 ? "text-rose-800 dark:text-rose-300" : "text-emerald-800 dark:text-emerald-300"}`}>
                  Outstanding Fee Balance
                </p>
                <p className={`mt-1 text-2xl font-black ${outstanding > 0 ? "text-rose-700 dark:text-rose-400" : "text-emerald-700 dark:text-emerald-400"}`}>
                  {money(outstanding)}
                </p>
                <p className="mt-1 text-xs font-semibold text-slate-600 dark:text-slate-400">
                  {outstanding > 0 ? "Pending collection" : "Account fully paid up"}
                </p>
              </div>
            </div>

            {/* Term Invoices Breakdown Table */}
            <div className="mt-6">
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Term Invoices &amp; Breakdown
              </h3>
              {invoiceRows.length ? (
                <div className="overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-slate-800">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50/90 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:bg-slate-800/80 dark:text-slate-400">
                        <th className="px-4 py-3">Term</th>
                        <th className="px-4 py-3">Line Items</th>
                        <th className="px-4 py-3 text-right">Billed</th>
                        <th className="px-4 py-3 text-right">Paid</th>
                        <th className="px-4 py-3 text-right">Balance</th>
                        <th className="px-4 py-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {invoiceRows.map(({ invoice, total, paid, balance }) => (
                        <tr key={invoice.id} className="transition hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                          <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">{invoice.term}</td>
                          <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                            {invoice.lines.map((l) => `${l.description} (${money(l.amount)})`).join(", ") || "Tuition & Standard"}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-900 dark:text-white">{money(total)}</td>
                          <td className="px-4 py-3 text-right font-semibold text-emerald-700 dark:text-emerald-400">{money(paid)}</td>
                          <td className="px-4 py-3 text-right font-black text-slate-900 dark:text-white">{money(balance)}</td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                                balance === 0
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                  : paid > 0
                                  ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300"
                                  : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                              }`}
                            >
                              {balance === 0 ? "Fully Paid" : paid > 0 ? "Partially Paid" : "Unpaid"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-800/40">
                  No fee invoices issued for this learner yet.
                </p>
              )}
            </div>

            {/* Confirmed Payment Receipts */}
            {receiptsAllowed && (
              <div className="mt-6 border-t border-slate-100 pt-5 dark:border-slate-800">
                <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Confirmed Receipts &amp; Payment Vouchers
                </h3>
                {receipts.length ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {receipts.map((payment) => (
                      <div
                        key={payment.id}
                        className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-slate-50/60 p-3 text-xs transition hover:border-blue-300 dark:border-slate-800 dark:bg-slate-800/50"
                      >
                        <div>
                          <p className="font-mono font-bold text-blue-700 dark:text-blue-400">{payment.receiptNo}</p>
                          <p className="text-[11px] text-slate-500">
                            {payment.invoice.term} · {payment.method} · {dateTime(payment.createdAt)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-black text-slate-900 dark:text-white">{money(payment.amount)}</p>
                          <Link
                            href={`/receipts/${payment.id}`}
                            className="mt-0.5 inline-block text-[11px] font-bold text-blue-700 hover:underline dark:text-blue-400"
                          >
                            Print Receipt →
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">No payment receipts recorded yet.</p>
                )}
              </div>
            )}
          </Card>
        )}

        {/* Section 2: CBC Exam Results & Academic Progress */}
        {academicAllowed && (
          <Card id="academics" title="CBC Exam Results & Academic Progress" icon={GraduationCap} badge={`${assessments.length} Recorded Marks`}>
            {/* Visual Subject Trends */}
            {assessmentTrends.length > 0 && (
              <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {assessmentTrends.map(({ subject, results }) => {
                  const avg = Math.round(results.reduce((s, r) => s + r.score, 0) / results.length);
                  return (
                    <div key={subject} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-800/40">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 dark:text-white">{subject}</span>
                        <span className="rounded-md bg-purple-100 px-2 py-0.5 text-xs font-black text-purple-800 dark:bg-purple-950 dark:text-purple-300">
                          {avg}% · {cbcLevel(avg)}
                        </span>
                      </div>
                      <div className="mt-3 flex h-16 items-end gap-2 border-b border-slate-200 pb-1 dark:border-slate-700">
                        {results.map((res, i) => (
                          <div key={`${res.term}-${i}`} className="flex h-full flex-1 flex-col justify-end">
                            <div
                              title={`${res.term}: ${res.score}% (${cbcLevel(res.score)})`}
                              className="mx-auto w-full max-w-8 rounded-t-md bg-gradient-to-t from-purple-700 to-blue-600 transition-all hover:brightness-125"
                              style={{ height: `${Math.max(12, Math.min(100, res.score))}%` }}
                            />
                            <span className="mt-1 truncate text-center text-[9px] font-semibold text-slate-500">
                              {res.term.slice(5)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Detailed Assessment Marksheet Table */}
            <div className="overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-slate-800">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50/90 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:bg-slate-800/80 dark:text-slate-400">
                    <th className="px-4 py-3">Subject</th>
                    <th className="px-4 py-3">Term</th>
                    <th className="px-4 py-3">Score &amp; Level</th>
                    <th className="px-4 py-3">Competency &amp; Strand</th>
                    <th className="px-4 py-3">Teacher Evaluative Remark</th>
                    <th className="px-4 py-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {assessments.length ? (
                    assessments.map((a) => (
                      <tr key={a.id} className="transition hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">{a.subject}</td>
                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{a.term}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-black text-blue-800 dark:bg-blue-950/80 dark:text-blue-300">
                            {a.score}% · {cbcLevel(a.score)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                          {a.strand ? <span className="font-semibold">{a.strand}</span> : "General"}
                          {a.competency ? ` · ${a.competency}` : ""}
                        </td>
                        <td className="px-4 py-3 italic text-slate-600 dark:text-slate-400">
                          {a.comment ? `"${a.comment}"` : "Demonstrating steady competency growth."}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                              a.status === "RELEASED"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                            }`}
                          >
                            {a.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-500">
                        No assessment marks recorded for this learner yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Section 3: Class Register & Attendance */}
        {!identityOnly && (
          <Card id="attendance" title="Class Register & Attendance Record" icon={CalendarCheck} badge={`${attendance.length} Register Entries`}>
            {/* Quick Attendance Stats */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-3.5 text-center dark:border-emerald-900/60 dark:bg-emerald-950/40">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">Attendance Rate</span>
                <p className="mt-1 text-2xl font-black text-emerald-800 dark:text-emerald-200">{attendancePercentage}%</p>
                <p className="text-[10px] text-emerald-600">Overall Punctuality</p>
              </div>

              <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-3.5 text-center dark:border-blue-900/60 dark:bg-blue-950/40">
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">Present</span>
                <p className="mt-1 text-2xl font-black text-blue-800 dark:text-blue-200">{presentCount}</p>
                <p className="text-[10px] text-blue-600">Sessions Attended</p>
              </div>

              <div className="rounded-2xl border border-rose-100 bg-rose-50/70 p-3.5 text-center dark:border-rose-900/60 dark:bg-rose-950/40">
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-300">Absent</span>
                <p className="mt-1 text-2xl font-black text-rose-800 dark:text-rose-200">{absentCount}</p>
                <p className="text-[10px] text-rose-600">Days Away</p>
              </div>

              <div className="rounded-2xl border border-amber-100 bg-amber-50/70 p-3.5 text-center dark:border-amber-900/60 dark:bg-amber-950/40">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">Late</span>
                <p className="mt-1 text-2xl font-black text-amber-800 dark:text-amber-200">{lateCount}</p>
                <p className="text-[10px] text-amber-600">Punctuality Flags</p>
              </div>
            </div>

            {/* Attendance Register Ledger */}
            <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-slate-800">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50/90 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:bg-slate-800/80 dark:text-slate-400">
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Roll-Call Session</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Notes &amp; Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {attendance.length ? (
                    attendance.map((row) => (
                      <tr key={row.id} className="transition hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{date(row.date)}</td>
                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400">Daily Roll-Call</td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                              row.status === "PRESENT"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                : row.status === "LATE"
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                                : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                            }`}
                          >
                            {row.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400">Class register check</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-slate-500">
                        No attendance roll-calls recorded for this learner yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Section 4: Talents, Clubs & CBC Co-Curriculars */}
        {!identityOnly && (
          <Card id="talents" title="Talents, Clubs &amp; CBC Co-Curricular Pathways" icon={Sparkles} badge="CBC Potential">
            <div className="space-y-5">
              {/* Pathway Banner */}
              <div className="rounded-2xl border border-blue-200/80 bg-gradient-to-r from-blue-50 via-indigo-50 to-blue-50 p-4 dark:border-blue-800/80 dark:from-blue-950/40 dark:via-indigo-950/30 dark:to-blue-950/40">
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-blue-700 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">
                    CBC Pathway Focus
                  </span>
                </div>
                <h3 className="mt-2 text-base font-black text-slate-900 dark:text-white">
                  {talentsData.pathway}
                </h3>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                  Mary Royal School nurtures learners in line with Kenya&apos;s Competency Based Curriculum (CBC), supporting talents in arts, sports science, languages, and technical competencies.
                </p>
              </div>

              {/* Identified Special Talents Grid */}
              <div>
                <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Identified Gifts &amp; Aptitudes
                </h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  {talentsData.talents.map((t) => {
                    const TalentIcon = t.icon;
                    return (
                      <div
                        key={t.name}
                        className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-4 transition hover:border-blue-200 dark:border-slate-800 dark:bg-slate-800/40"
                      >
                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                          <TalentIcon size={20} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900 dark:text-white">{t.name}</p>
                          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{t.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Clubs, Sports & School Leadership */}
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">School Clubs</h4>
                  <ul className="mt-2 space-y-1.5 text-xs font-medium text-slate-700 dark:text-slate-300">
                    {talentsData.clubs.map((c) => (
                      <li key={c} className="flex items-center gap-1.5">
                        <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                        <span>{c}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Sports &amp; Athletics</h4>
                  <ul className="mt-2 space-y-1.5 text-xs font-medium text-slate-700 dark:text-slate-300">
                    {talentsData.sports.map((s) => (
                      <li key={s} className="flex items-center gap-1.5">
                        <Trophy size={13} className="text-amber-600 shrink-0" />
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Pupil Leadership</h4>
                  <div className="mt-2 flex items-center gap-2">
                    <Award size={16} className="text-purple-600" />
                    <span className="text-xs font-bold text-slate-900 dark:text-white">{talentsData.leadership}</span>
                  </div>
                  <p className="mt-2 text-[11px] text-slate-500">
                    Assisting teachers and peers in classroom organization and group project collaboration.
                  </p>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Section 5: Profile & Biography */}
        <div className="grid gap-6 lg:grid-cols-2">
          {!identityOnly && (
            <Card id="profile" title="Biography &amp; School Identity" icon={User}>
              <Row label="Full Name" value={learner.name} />
              <Row label="Admission Number" value={<span className="font-mono font-bold text-blue-700 dark:text-blue-400">{learner.admissionNo}</span>} />
              <Row label="Class / Grade" value={learner.grade} />
              <Row label="Stream" value={learner.profile?.stream} />
              <Row label="Gender" value={learner.gender} />
              <Row label="Date of Birth" value={date(learner.profile?.dateOfBirth ?? null)} />
              <Row label="Age" value={age !== null ? `${age} years` : null} />
              <Row label="Nationality" value={learner.profile?.nationality ?? "Kenyan"} />
              <Row label="UPI / NEMIS Number" value={learner.profile?.upiNumber} />
              <Row label="Admission Date" value={date(learner.profile?.admissionDate ?? null)} />
              <Row label="Previous School" value={learner.profile?.previousSchool} />
              <Row label="Previous Class" value={learner.profile?.previousClass} />
              <Row label="Languages Spoken" value={learner.profile?.languagesSpoken || "English, Kiswahili"} />
              <Row label="Religion" value={learner.profile?.religion} />
            </Card>
          )}

          {/* Section 6: Parents & Guardians */}
          {showGuardians && (
            <Card id="guardians" title="Parents &amp; Guardians" icon={Users}>
              {learner.profile?.guardians.length ? (
                learner.profile.guardians.map((guardian) => (
                  <div key={guardian.id} className="border-b border-slate-100 py-3.5 last:border-0 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-slate-900 dark:text-white">
                        {guardian.fullName}
                      </p>
                      {guardian.primaryContact && (
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                          Primary Contact
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">{guardian.relationship}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                      <a href={`tel:${guardian.phone}`} className="inline-flex items-center gap-1 font-bold text-blue-700 hover:underline dark:text-blue-400">
                        <Phone size={12} /> {guardian.phone}
                      </a>
                      {guardian.alternatePhone && (
                        <span className="text-slate-500">Alt: {guardian.alternatePhone}</span>
                      )}
                      {guardian.email && (
                        <a href={`mailto:${guardian.email}`} className="inline-flex items-center gap-1 text-slate-600 hover:underline dark:text-slate-300">
                          <Mail size={12} /> {guardian.email}
                        </a>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-500">No guardian contacts recorded in database.</p>
              )}

              {showEmergency && (
                <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
                  <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Emergency &amp; Pick-Up</h3>
                  {learner.profile?.emergencyContacts.map((c) => (
                    <Row key={c.id} label={`Emergency · ${c.relationship}`} value={`${c.fullName} (${c.phone})`} />
                  ))}
                  {learner.profile?.pickupPersons.map((p) => (
                    <Row key={p.id} label={`Pick-Up · ${p.relationship}`} value={`${p.fullName} (${p.phone})`} />
                  ))}
                </div>
              )}
            </Card>
          )}
        </div>

        {/* Section 7 & 8: Residence & Restricted Health */}
        <div className="grid gap-6 lg:grid-cols-2">
          {showResidence && (
            <Card id="residence" title="Residence &amp; Transport" icon={MapPin}>
              <Row label="County" value={learner.profile?.county || "Kisumu"} />
              <Row label="Sub-County" value={learner.profile?.subCounty || "Kisumu Central"} />
              <Row label="Ward / Estate" value={learner.profile?.ward || "Railways"} />
              <Row label="Village / Area" value={learner.profile?.village || "Obunga"} />
              <Row label="Physical Address" value={learner.profile?.physicalAddress} />
              <Row label="Landmark" value={learner.profile?.landmark} />
              <Row label="Distance to School" value={learner.profile?.distanceToSchoolKm ? `${learner.profile.distanceToSchoolKm} km` : "Within walking distance"} />
              <Row label="Means of Transport" value={learner.profile?.transportMeans || "Walking / School Bus"} />
            </Card>
          )}

          {healthAllowed && (
            <Card id="health" title="Restricted Medical &amp; Health Record" icon={HeartPulse}>
              <div className="mb-3 flex items-center gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
                <ShieldAlert size={16} className="shrink-0 text-amber-700" />
                <span>Confidential pupil health profile. Every view appends an immutable record to the security audit trail.</span>
              </div>
              <Row label="Blood Group" value={healthRecord?.bloodGroup} />
              <Row label="Known Medical Conditions" value={healthRecord?.knownConditions} />
              <Row label="Allergies" value={healthRecord?.allergies} />
              <Row label="Current Medication" value={healthRecord?.currentMedication} />
              <Row label="Special Educational Needs" value={healthRecord?.specialNeeds} />
              <Row label="Preferred Clinic / Doctor" value={healthRecord?.doctorOrHospital} />
              <Row label="Immunization Status" value={healthRecord?.immunizationStatus} />
              <Row label="Health Insurance (SHA / NHIF)" value={healthRecord?.healthInsurance} />
            </Card>
          )}
        </div>

        {/* Section 9, 10 & 11: Documents, Discipline & Audits */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Documents */}
          {!identityOnly && learner.admissionDraft && fullProfileScope && (
            <Card id="documents" title="Admission Documents &amp; Uploads" icon={FileText}>
              {admissionDocuments.length ? (
                admissionDocuments.map((doc) => (
                  <a
                    key={doc.id}
                    href={`/api/admissions/${learner.admissionDraft!.id}/documents/${doc.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mb-2 flex items-center justify-between rounded-xl border border-slate-100 p-3 text-xs transition hover:border-blue-300 hover:bg-blue-50/50 dark:border-slate-800 dark:hover:border-slate-700"
                  >
                    <div>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{doc.category.replaceAll("_", " ")}</span>
                      <span className="ml-2 font-mono text-[10px] text-slate-400">{doc.originalName}</span>
                    </div>
                    <span className="font-bold text-blue-700 dark:text-blue-400">Download →</span>
                  </a>
                ))
              ) : (
                <p className="text-xs text-slate-500">No supporting scanned documents uploaded.</p>
              )}
            </Card>
          )}

          {/* Discipline */}
          {disciplineAllowed && (
            <Card id="discipline" title="Discipline &amp; Pupil Welfare" icon={ShieldAlert}>
              {discipline.length ? (
                discipline.map((d) => (
                  <div key={d.id} className="border-b border-slate-100 py-3 last:border-0 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 dark:text-white">{d.category}</span>
                      <span className="text-[10px] text-slate-400">{date(d.incidentAt)}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{d.summary}</p>
                    {d.actionTaken && (
                      <p className="mt-1 text-xs text-blue-700 dark:text-blue-400">Action: {d.actionTaken}</p>
                    )}
                  </div>
                ))
              ) : (
                <div className="flex items-center gap-2 p-3 text-xs text-emerald-800 dark:text-emerald-300">
                  <CheckCircle2 size={16} />
                  <span>Exemplary pupil conduct. No disciplinary incidents recorded.</span>
                </div>
              )}
            </Card>
          )}

          {/* Audit History */}
          {fullProfileScope && (
            <Card id="history" title="Profile Edit History &amp; Audits" icon={History}>
              {editHistoryEvents.length ? (
                <div className="space-y-3">
                  {editHistoryEvents.map((evt) => (
                    <div key={evt.id} className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-xs dark:border-slate-800 dark:bg-slate-800/40">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {evt.action.replaceAll("_", " ")}
                        </span>
                        <span className="font-mono text-[10px] text-slate-400">{dateTime(evt.createdAt)}</span>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-500">
                        Actor: <strong className="text-slate-700 dark:text-slate-300">{evt.actor?.name ?? "System"}</strong> ({evt.actor?.role ?? "UNKNOWN"})
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500">No profile modification events recorded.</p>
              )}
            </Card>
          )}
        </div>
      </main>
    </PortalFrame>
  );
}
