import { cookies } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { readSession } from "@/lib/session";
import { canInScope } from "@/lib/permissions";
import {
  Users,
  GraduationCap,
  CalendarCheck,
  BookOpen,
  LogOut,
  Wallet,
  ChevronRight,
  ClipboardCheck,
  CircleDollarSign,
  Clock3,
  Eye,
  ArrowRight,
  TrendingUp,
  CalendarDays,
} from "lucide-react";
import ThemeToggle from "@/components/theme-toggle";
import { getRoleNavigation } from "@/lib/navigation";
import { DirectorGettingStartedChecklist } from "@/components/director-checklist";

const roleTitles: Record<string, string> = {
  DIRECTOR: "Director",
  HEAD_TEACHER: "Head Teacher",
  DEPUTY: "Deputy Head Teacher",
  SECRETARY: "Secretary",
  ACCOUNTANT: "Accountant",
  TEACHER: "Teacher",
  WELFARE_CHAIR: "Welfare Chair",
  NON_TEACHING_STAFF: "Non-Teaching Staff",
};

const roleCopy: Record<string, string> = {
  DIRECTOR: "A clear view of learning, people and school operations.",
  HEAD_TEACHER: "Lead learning, review admissions and support your team.",
  DEPUTY: "Stay on top of attendance, library and the daily rhythm of school.",
  SECRETARY: "Manage learner admissions and school records.",
  ACCOUNTANT: "Manage invoices, payments and school collections.",
  TEACHER: "Your classes, learners and classroom tasks in one place.",
  WELFARE_CHAIR: "Manage staff welfare contributions, savings and loan requests.",
  NON_TEACHING_STAFF: "View your welfare savings, loan applications and contributions.",
};

const kes = (value: number) =>
  new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(value);

type MetricItem = {
  label: string;
  value: string;
  note: string;
  iconName: string;
  tone?: "blue" | "emerald" | "amber" | "purple" | "rose";
};

const toneStyles: Record<string, string> = {
  blue: "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300",
  emerald: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
  amber: "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300",
  purple: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300",
  rose: "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300",
};

// RSC-safe icon renderer — no functions passed to client
function MetricIcon({ name }: { name: string }) {
  switch (name) {
    case "users": return <Users size={20} />;
    case "graduation": return <GraduationCap size={20} />;
    case "calendar": return <CalendarCheck size={20} />;
    case "book": return <BookOpen size={20} />;
    case "wallet": return <Wallet size={20} />;
    case "clock": return <Clock3 size={20} />;
    case "dollar": return <CircleDollarSign size={20} />;
    case "clipboard": return <ClipboardCheck size={20} />;
    default: return <TrendingUp size={20} />;
  }
}

function MetricCard({ label, value, note, iconName, tone = "blue", index }: MetricItem & { index: number }) {
  const altTones = ["blue", "purple", "emerald", "amber"] as const;
  const auto = altTones[index % 4];
  const actualPalette = toneStyles[tone !== "blue" ? tone : auto] ?? toneStyles.blue;

  return (
    <article className="group min-w-0 rounded-2xl border border-slate-200/80 bg-white/95 p-5 shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/90">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</p>
          <p className={`mt-3 font-extrabold tracking-tight text-slate-900 dark:text-white ${value.length > 11 ? "text-xl" : "text-2xl"}`}>
            {value}
          </p>
        </div>
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${actualPalette}`}>
          <MetricIcon name={iconName} />
        </span>
      </div>
      <p className="mt-2 text-[11px] text-slate-400 dark:text-slate-500">{note}</p>
    </article>
  );
}

export default async function Dashboard() {
  const token = (await cookies()).get("mary_session")?.value;
  const session = token ? await readSession(token) : null;
  if (!session) redirect("/");
  const user = await db.user.findUnique({ where: { id: session.id } });
  if (!user || user.suspended) redirect("/");
  if (user.forcePasswordChange) redirect("/change-password");
  if (user.role === "PARENT") redirect("/portal");
  if (user.role === "LEARNER") redirect("/learning");

  const role = user.role;
  const today = new Date(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Africa/Nairobi",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date()) + "T00:00:00.000Z"
  );

  let metrics: MetricItem[] = [];
  let gradeRows: { grade: string; _count: { id: number } }[] = [];
  let activity: {
    id: string;
    action: string;
    entity: string;
    createdAt: Date;
    actor: { name: string } | null;
  }[] = [];
  let assignments: { grade: string; subject: string }[] = [];
  let teacherTodayLessons: { id: string; period: number; time: string; subject: string; grade: string; room?: string }[] = [];
  const todayDayName = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "Africa/Nairobi" }).format(new Date());
  let collectionPercent = 0;
  let feeRows: { grade: string; invoiced: number; collected: number; balance: number }[] = [];
  let payrollSummary = { period: "", total: 0, paid: 0, pending: 0, staffCount: 0 };
  let directorStats = {
    staffCount: 0,
    learnerCount: 0,
    feeStructuresCount: 0,
    examSessionsCount: 0,
    attendanceCount: 0,
    marksCount: 0,
    paymentsCount: 0,
  };

  if (role === "DIRECTOR") {
    const period = new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      timeZone: "Africa/Nairobi",
    }).format(new Date());

    const [
      learners,
      staff,
      attendance,
      released,
      grades,
      invoices,
      payroll,
      examSessions,
      attendanceCount,
      marksCount,
      paymentsCount,
      feeStructuresCount
    ] = await Promise.all([
      db.learner.count({ where: { archivedAt: null } }),
      db.user.count({ where: { suspended: false, role: { notIn: ["PARENT", "LEARNER"] } } }),
      db.attendance.count({ where: { date: today, status: "PRESENT" } }),
      db.assessment.count({ where: { status: "RELEASED" } }),
      db.learner.groupBy({
        by: ["grade"],
        where: { archivedAt: null },
        _count: { id: true },
        orderBy: { grade: "asc" },
      }),
      db.feeInvoice.findMany({
        select: {
          learner: { select: { grade: true } },
          creditApplied: true,
          lines: { select: { amount: true } },
          payments: { where: { status: "RECORDED" }, select: { amount: true } },
        },
        take: 2000,
      }),
      db.payrollEntry.findMany({
        where: { period },
        select: { netAmount: true, status: true },
      }),
      db.examSession.count(),
      db.attendance.count(),
      db.assessment.count({ where: { status: { not: "DRAFT" } } }),
      db.feePayment.count({ where: { status: "RECORDED" } }),
      db.feeStructure.count(),
    ]);

    gradeRows = grades;
    const byGrade = new Map<string, { grade: string; invoiced: number; collected: number; balance: number }>();
    for (const invoice of invoices) {
      const inv = invoice.lines.reduce((sum, line) => sum + line.amount, 0);
      const col = invoice.payments.reduce((sum, p) => sum + p.amount, 0);
      const row = byGrade.get(invoice.learner.grade) ?? { grade: invoice.learner.grade, invoiced: 0, collected: 0, balance: 0 };
      row.invoiced += inv;
      row.collected += col;
      row.balance += Math.max(0, inv - col - invoice.creditApplied);
      byGrade.set(invoice.learner.grade, row);
    }
    feeRows = [...byGrade.values()].sort((a, b) => a.grade.localeCompare(b.grade));

    const invoiced = feeRows.reduce((sum, item) => sum + item.invoiced, 0);
    const collected = feeRows.reduce((sum, item) => sum + item.collected, 0);
    const balance = feeRows.reduce((sum, item) => sum + item.balance, 0);
    collectionPercent = invoiced ? Math.round((collected / invoiced) * 100) : 0;
    payrollSummary = payroll.reduce(
      (sum, item) => ({
        period,
        total: sum.total + item.netAmount,
        paid: sum.paid + (item.status === "PAID" ? item.netAmount : 0),
        pending: sum.pending + (item.status === "PENDING" ? item.netAmount : 0),
        staffCount: sum.staffCount + 1,
      }),
      { period, total: 0, paid: 0, pending: 0, staffCount: 0 }
    );

    directorStats = {
      staffCount: staff,
      learnerCount: learners,
      feeStructuresCount,
      examSessionsCount: examSessions,
      attendanceCount,
      marksCount,
      paymentsCount,
    };

    metrics = [
      { label: "Active Learners", value: String(learners), note: "Across the school", iconName: "users", tone: "blue" },
      { label: "Active Staff", value: String(staff), note: "School team accounts", iconName: "graduation", tone: "purple" },
      { label: "Present Today", value: String(attendance), note: "Learners marked present", iconName: "calendar", tone: "emerald" },
      { label: "Released Results", value: String(released), note: "Ready for families", iconName: "book", tone: "amber" },
      { label: "Fees Collected", value: kes(collected), note: `${collectionPercent}% of invoiced fees`, iconName: "wallet", tone: "emerald" },
      { label: "Fee Balances", value: kes(balance), note: "Outstanding across all terms", iconName: "clock", tone: "amber" },
      { label: "Payroll This Month", value: kes(payrollSummary.total), note: `${payrollSummary.staffCount} staff · ${period}`, iconName: "dollar", tone: "blue" },
      { label: "Payroll Pending", value: kes(payrollSummary.pending), note: "Net pay awaiting payment", iconName: "clipboard", tone: "rose" },
    ];
  } else if (role === "HEAD_TEACHER") {
    const [learners, pending, released, absent, grades, recent, financeInvoices] = await Promise.all([
      db.learner.count({ where: { archivedAt: null } }),
      db.assessment.count({ where: { status: "SUBMITTED" } }),
      db.assessment.count({ where: { status: "RELEASED" } }),
      db.attendance.count({ where: { date: today, status: "ABSENT" } }),
      db.learner.groupBy({ by: ["grade"], where: { archivedAt: null }, _count: { id: true }, orderBy: { grade: "asc" } }),
      db.auditEvent.findMany({ take: 5, orderBy: { createdAt: "desc" }, include: { actor: { select: { name: true } } } }),
      db.feeInvoice.findMany({
        select: {
          lines: { select: { amount: true } },
          creditApplied: true,
          payments: { where: { status: "RECORDED" }, select: { amount: true } },
        },
        take: 2000,
      }),
    ]);
    gradeRows = grades;
    activity = recent;
    const billed = financeInvoices.reduce((sum, inv) => sum + inv.lines.reduce((n, l) => n + l.amount, 0), 0);
    const collected = financeInvoices.reduce((sum, inv) => sum + inv.payments.reduce((n, p) => n + p.amount, 0), 0);
    const balances = financeInvoices.reduce(
      (sum, inv) =>
        sum + Math.max(0, inv.lines.reduce((n, l) => n + l.amount, 0) - inv.payments.reduce((n, p) => n + p.amount, 0) - inv.creditApplied),
      0
    );
    metrics = [
      { label: "Learners", value: String(learners), note: "Active school register", iconName: "users", tone: "blue" },
      { label: "Marks to Review", value: String(pending), note: "Awaiting your decision", iconName: "clipboard", tone: "amber" },
      { label: "Results Released", value: String(released), note: "Visible to families", iconName: "book", tone: "emerald" },
      { label: "Absent Today", value: String(absent), note: "Recorded in attendance", iconName: "calendar", tone: "rose" },
      { label: "Fees Collected", value: kes(collected), note: `${billed ? Math.round((collected / billed) * 100) : 0}% of invoices`, iconName: "wallet", tone: "emerald" },
      { label: "Fee Balance", value: kes(balances), note: "Confirmed payments only", iconName: "clock", tone: "amber" },
    ];
  } else if (role === "DEPUTY") {
    const [learners, records, absent, grades] = await Promise.all([
      db.learner.count({ where: { archivedAt: null } }),
      db.attendance.count({ where: { date: today } }),
      db.attendance.count({ where: { date: today, status: "ABSENT" } }),
      db.learner.groupBy({ by: ["grade"], where: { archivedAt: null }, _count: { id: true }, orderBy: { grade: "asc" } }),
    ]);
    gradeRows = grades;
    metrics = [
      { label: "Learners", value: String(learners), note: "Active school register", iconName: "users", tone: "blue" },
      { label: "Marked Today", value: String(records), note: "Attendance records", iconName: "calendar", tone: "emerald" },
      { label: "Absent Today", value: String(absent), note: "Follow-up list", iconName: "clipboard", tone: "rose" },
      { label: "Grade Levels", value: String(grades.length), note: "Grades with learners", iconName: "graduation", tone: "purple" },
    ];
  } else if (role === "TEACHER") {
    assignments = await db.teacherAssignment.findMany({
      where: { teacherId: user.id },
      select: { grade: true, subject: true },
    });
    const grades = [...new Set(assignments.map((item) => item.grade))];
    const [learners, pending, attendance, publishedTimetable] = await Promise.all([
      db.learner.count({ where: { grade: { in: grades }, archivedAt: null } }),
      db.assessment.count({ where: { enteredById: user.id, status: { in: ["DRAFT", "RETURNED"] } } }),
      db.attendance.count({ where: { date: today, learner: { grade: { in: grades } } } }),
      db.schoolTimetable.findFirst({
        where: { status: "PUBLISHED" },
        orderBy: { createdAt: "desc" },
        select: { scheduleJson: true },
      }),
    ]);
    if (publishedTimetable?.scheduleJson) {
      try {
        const slots = JSON.parse(publishedTimetable.scheduleJson);
        if (Array.isArray(slots)) {
          teacherTodayLessons = slots
            .filter((s: { teacherId?: string; day?: string }) => s.teacherId === user.id && s.day?.toLowerCase() === todayDayName.toLowerCase())
            .sort((a: { period: number }, b: { period: number }) => a.period - b.period);
        }
      } catch {}
    }
    gradeRows = grades.map((grade) => ({ grade, _count: { id: 0 } }));
    metrics = [
      { label: "My Learners", value: String(learners), note: "In your assigned grades", iconName: "users", tone: "blue" },
      { label: "Marks to Finish", value: String(pending), note: "Draft or returned to you", iconName: "book", tone: "amber" },
      { label: "Attendance Today", value: String(attendance), note: "In your assigned grades", iconName: "calendar", tone: "emerald" },
      { label: "My Assignments", value: String(assignments.length), note: "Grade and subject pairs", iconName: "clipboard", tone: "purple" },
    ];
  } else if (role === "SECRETARY") {
    const [learnerCount, pendingAdmissions, completedAdmissions, complaintsCount, recentAdmissions] = await Promise.all([
      db.learner.count({ where: { archivedAt: null, admissionStatus: "APPROVED" } }),
      db.learner.count({ where: { archivedAt: null, admissionStatus: "PENDING" } }),
      db.learner.count({ where: { archivedAt: null, admissionStatus: "APPROVED" } }),
      db.complaint.count(),
      db.learner.findMany({ where: { archivedAt: null }, orderBy: { admissionNo: "desc" }, take: 5, select: { name: true, grade: true, admissionStatus: true } }),
    ]);
    metrics = [
      { label: "Enrolled Learners", value: String(learnerCount), note: "Active on school register", iconName: "users", tone: "blue" },
      { label: "Pending Admission", value: String(pendingAdmissions), note: "Awaiting approval", iconName: "clock", tone: "amber" },
      { label: "Admitted This Year", value: String(completedAdmissions), note: "Approved since Jan 1", iconName: "graduation", tone: "emerald" },
      { label: "Complaints Logged", value: String(complaintsCount), note: "Total on record", iconName: "clipboard", tone: "purple" },
    ];
    void recentAdmissions; // available for future recent-activity panel
  } else if (role === "ACCOUNTANT") {
    // Accountant only
    const invoices = await db.feeInvoice.findMany({
      include: {
        lines: true,
        payments: { where: { status: "RECORDED" }, select: { amount: true } },
      },
      take: 500,
    });
    const totals = invoices.reduce(
      (acc, inv) => {
        const total = inv.lines.reduce((sum, l) => sum + l.amount, 0);
        const paid = inv.payments.reduce((sum, p) => sum + p.amount, 0);
        acc.invoiced += total;
        acc.paid += paid;
        acc.balance += total - paid - inv.creditApplied;
        return acc;
      },
      { invoiced: 0, paid: 0, balance: 0 }
    );
    collectionPercent = totals.invoiced ? Math.round((totals.paid / totals.invoiced) * 100) : 0;
    metrics = [
      { label: "Fee Invoices", value: String(invoices.length), note: "Recent fee invoices", iconName: "book", tone: "blue" },
      { label: "Fees Invoiced", value: kes(totals.invoiced), note: "Total invoiced", iconName: "dollar", tone: "purple" },
      { label: "Payments Received", value: kes(totals.paid), note: "Recorded payments", iconName: "wallet", tone: "emerald" },
      { label: "Outstanding", value: kes(totals.balance), note: "Remaining fee balances", iconName: "clock", tone: "amber" },
    ];
  } else {
    // WELFARE_CHAIR and NON_TEACHING_STAFF
    const member = await db.welfareMember.findUnique({
      where: { userId: user.id },
      include: {
        loans: { orderBy: { createdAt: "desc" } },
      },
    });
    const totalSavings = member?.totalSavings ?? 0;
    const activeLoans = member?.loans.filter((l) => ["DISBURSED", "APPROVED"].includes(l.status)).length ?? 0;
    const pendingLoans = member?.loans.filter((l) => l.status.startsWith("PENDING")).length ?? 0;
    metrics = [
      { label: "My Welfare Savings", value: kes(totalSavings), note: "Total accumulated savings", iconName: "wallet", tone: "blue" },
      { label: "Max Loan Limit (60%)", value: kes(Math.floor(totalSavings * 0.6)), note: "60% of total savings", iconName: "dollar", tone: "emerald" },
      { label: "Active Loans", value: String(activeLoans), note: "Ongoing loans", iconName: "clipboard", tone: "purple" },
      { label: "Pending Approvals", value: String(pendingLoans), note: "Awaiting Head/Director", iconName: "clock", tone: "amber" },
    ];
  }

  if (canInScope(role, "audit", "view", "school")) {
    activity = await db.auditEvent.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      include: { actor: { select: { name: true } } },
    });
  }

  let nav = getRoleNavigation(role);
  if (role === "TEACHER" && !(await db.classTeacherAssignment.findFirst({ where: { teacherId: user.id }, select: { id: true } }))) {
    nav = nav.filter((item) => item.label !== "Attendance");
  }

  const showActivity = canInScope(role, "audit", "view", "school");
  const maxGrade = Math.max(...gradeRows.map((item) => item._count.id), 1);
  const dateLabel = new Intl.DateTimeFormat("en-KE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Africa/Nairobi",
  }).format(new Date());

  const hour = Number(
    new Intl.DateTimeFormat("en-KE", { hour: "numeric", hourCycle: "h23", timeZone: "Africa/Nairobi" }).format(new Date())
  );
  const greeting = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";

  return (
    <div className="min-h-screen min-w-0 lg:flex">
      <a href="#main-content" className="skip-to-content sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-xl focus:bg-blue-800 focus:px-4 focus:py-3 focus:font-semibold focus:text-white focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-blue-300">Skip to main content</a>
      {/* Sidebar */}
      <aside className="school-sidebar sticky top-0 z-30 hidden h-screen w-[264px] shrink-0 flex-col overflow-y-auto border-r border-slate-200/80 bg-[#f1f6ff] px-4 py-6 lg:flex dark:border-slate-800 dark:bg-slate-950">
        <Link href="/dashboard" className="mb-9 flex items-center gap-3 px-2">
          <Image src="/mary-royal-logo.png" alt="Mary Royal School" width={44} height={44} className="rounded-xl" />
          <span>
            <span className="block text-[15px] font-extrabold tracking-tight text-slate-900 dark:text-white">Mary Royal</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">School management</span>
          </span>
        </Link>

        <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[.16em] text-slate-400">Workspace</p>

        <nav aria-label="Desktop navigation" className="space-y-1">
          {nav.map(({ label, href, icon: Icon }) => (
            <Link
              key={label}
              href={href}
              aria-current={label === "Overview" ? "page" : undefined}
              className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition ${
                label === "Overview"
                  ? "bg-blue-700 text-white shadow-sm shadow-blue-700/20"
                  : "text-slate-600 hover:bg-slate-200/60 hover:text-blue-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-blue-400"
              }`}
            >
              <Icon size={17} strokeWidth={1.9} />
              {label}
              {label === "Overview" && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-blue-200" />}
            </Link>
          ))}
        </nav>

        <div className="mt-auto overflow-hidden rounded-2xl bg-gradient-to-br from-blue-800 to-blue-600 p-4 text-white shadow-lg shadow-blue-900/10">
          <div className="mb-3 grid h-9 w-9 place-items-center rounded-xl bg-white/15">
            <GraduationCap size={19} />
          </div>
          <p className="text-sm font-bold">Hard work pays</p>
          <p className="mt-1 text-xs leading-relaxed text-blue-100">Nurturing Excellence Through CBC</p>
          <span className="mt-4 inline-flex rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-semibold">
            OBUNGA · KISUMU
          </span>
        </div>
      </aside>

      {/* Main content area */}
      <div className="w-full min-w-0 flex-1">
        {/* Top header */}
        <header aria-label="Dashboard app bar" className="sticky top-0 z-20 flex h-[72px] min-w-0 items-center justify-between border-b border-slate-200/70 bg-white/90 px-4 backdrop-blur-xl sm:px-7 lg:px-10 dark:border-slate-800/70 dark:bg-slate-950/90">
          <div className="flex items-center gap-3 lg:hidden">
            <Image src="/mary-royal-logo.png" alt="Mary Royal School" width={36} height={36} />
            <span className="font-extrabold tracking-tight dark:text-white">Mary Royal</span>
          </div>

          <div className="hidden items-center gap-2 text-xs text-slate-400 lg:flex">
            <span>Mary Royal School</span>
            <ChevronRight size={14} />
            <span className="font-semibold text-slate-700 dark:text-slate-200">{roleTitles[role] ?? role} workspace</span>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <ThemeToggle compact />

            {role === "DIRECTOR" && (
              <Link
                href="/audit"
                aria-label="Security activity"
                title="Security activity"
                className="grid h-11 w-11 place-items-center rounded-xl text-blue-800 transition hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950"
              >
                <Eye size={17} />
              </Link>
            )}

            <div className="hidden text-right sm:block">
              <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{user.name}</p>
              <p className="mt-0.5 text-[10px] font-medium text-slate-500 dark:text-slate-400">{roleTitles[role] ?? role}</p>
            </div>

            <Link
              href="/profile"
              aria-label="Open profile and security settings"
              className="relative grid h-9 w-9 place-items-center overflow-hidden rounded-full bg-blue-100 text-xs font-bold text-blue-800 ring-1 ring-blue-200 dark:bg-blue-900 dark:text-blue-200"
            >
              {user.avatarUrl ? (
                <Image src={user.avatarUrl} alt="" fill sizes="36px" className="object-cover" unoptimized />
              ) : (
                user.name
                  .split(/\s+/)
                  .map((part) => part[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase()
              )}
            </Link>

            <form action="/api/logout" method="post">
              <button
                aria-label="Sign out"
                className="grid h-11 w-11 place-items-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-blue-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              >
                <LogOut size={17} />
              </button>
            </form>
          </div>
        </header>

        {/* Page content */}
        <main id="main-content" className="mx-auto w-full min-w-0 max-w-[1480px] px-4 pb-28 pt-7 sm:px-7 sm:pt-9 lg:px-10 lg:pb-10">
          {/* Welcome hero */}
          <section className="relative mb-7 overflow-hidden rounded-[28px] bg-gradient-to-r from-[#102653] via-[#173d80] to-[#1d4ed8] px-6 py-7 text-white shadow-xl shadow-blue-950/10 sm:px-8 sm:py-8">
            <div className="relative z-10 max-w-2xl">
              <p className="text-xs font-semibold tracking-wide text-blue-100">
                {dateLabel} <span className="mx-1.5 text-blue-300">·</span> {roleTitles[role] ?? role}
              </p>
              <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-[34px]">
                Good {greeting}, {user.name.split(" ")[0]}
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-blue-100">{roleCopy[role] ?? "Welcome to your Mary Royal School portal."}</p>
            </div>

            {/* Decorative rings */}
            <div aria-hidden="true" className="absolute -right-8 -top-24 h-72 w-72 rounded-full border-[34px] border-white/[.06]" />
            <div aria-hidden="true" className="absolute -bottom-40 right-40 h-64 w-64 rounded-full bg-blue-400/15 blur-3xl" />

            <div className="absolute bottom-5 right-7 hidden items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold text-blue-50 backdrop-blur sm:flex">
              <span className="h-2 w-2 rounded-full bg-emerald-300" />
              Your workspace is up to date
            </div>
          </section>

          {/* Director setup checklist */}
          {role === "DIRECTOR" && (
            <div className="mb-6">
              <DirectorGettingStartedChecklist stats={directorStats} />
            </div>
          )}

          {/* Key metric cards */}
          <section aria-label="Key metrics" className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map((m, index) => (
              <MetricCard key={m.label} {...m} index={index} />
            ))}
          </section>

          {/* Director finance & payroll section */}
          {role === "DIRECTOR" && (
            <section aria-label="School finance and payroll overview" className="mt-5 grid gap-5 xl:grid-cols-[1.35fr_.85fr]">
              {/* Fee collection by class */}
              <article className="bento-card rounded-2xl border border-slate-200/80 bg-white/95 p-5 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/90 sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">School Finances</p>
                    <h2 className="mt-1 text-base font-extrabold text-slate-900 dark:text-white">Fee Collection by Class</h2>
                    <p className="mt-1 text-xs text-slate-500">
                      Collected {kes(feeRows.reduce((s, r) => s + r.collected, 0))} · Outstanding{" "}
                      {kes(feeRows.reduce((s, r) => s + r.balance, 0))}
                    </p>
                  </div>
                  <Link
                    href="/finance"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-2 text-xs font-bold text-blue-800 hover:bg-blue-100 dark:bg-blue-950/60 dark:text-blue-300 dark:hover:bg-blue-950"
                  >
                    Open Finance <ArrowRight size={13} />
                  </Link>
                </div>

                <div className="mb-2 mt-5 flex justify-between text-xs">
                  <span className="font-semibold text-slate-600 dark:text-slate-300">Overall collection rate</span>
                  <span className="font-extrabold text-blue-800 dark:text-blue-300">{collectionPercent}%</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-blue-50 dark:bg-blue-950/50">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-700 to-blue-500 transition-all"
                    style={{ width: `${collectionPercent}%` }}
                  />
                </div>

                {feeRows.length ? (
                  <div className="mt-5 space-y-4">
                    {feeRows.map((row) => (
                      <div key={row.grade}>
                        <div className="mb-1.5 flex justify-between gap-3 text-xs">
                          <span className="font-semibold text-slate-700 dark:text-slate-300">{row.grade}</span>
                          <span className="text-slate-500 dark:text-slate-400">
                            {kes(row.collected)} · {kes(row.balance)} due
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                          <div
                            className="h-full rounded-full bg-blue-600"
                            style={{ width: `${row.invoiced ? Math.min(100, (row.collected / row.invoiced) * 100) : 0}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-5 rounded-xl bg-slate-50 p-4 text-xs text-slate-500 dark:bg-slate-800">
                    No fee invoices recorded yet. Finance figures will appear here as invoices and payments are entered.
                  </p>
                )}
              </article>

              {/* Staff payroll */}
              <article className="bento-card rounded-2xl border border-slate-200/80 bg-white/95 p-5 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/90 sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">People &amp; Payroll</p>
                    <h2 className="mt-1 text-base font-extrabold text-slate-900 dark:text-white">Staff Payroll</h2>
                    <p className="mt-1 text-xs text-slate-500">
                      {payrollSummary.period || "Current month"} · {payrollSummary.staffCount} staff on this pay run
                    </p>
                  </div>
                  <Link
                    href="/finance"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-2 text-xs font-bold text-blue-800 hover:bg-blue-100 dark:bg-blue-950/60 dark:text-blue-300"
                  >
                    View Payroll <ArrowRight size={13} />
                  </Link>
                </div>

                <div className="mt-6 rounded-2xl bg-gradient-to-br from-[#102653] to-[#1d4ed8] p-5 text-white">
                  <p className="text-xs font-semibold text-blue-100">Net payroll this month</p>
                  <p className="mt-2 text-3xl font-extrabold tracking-tight">{kes(payrollSummary.total)}</p>
                  <p className="mt-1 text-xs text-blue-100">
                    Paid {kes(payrollSummary.paid)} · Pending {kes(payrollSummary.pending)}
                  </p>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50">
                    <p className="text-xs font-semibold text-slate-500">Paid</p>
                    <p className="mt-1 text-base font-extrabold text-slate-900 dark:text-white">{kes(payrollSummary.paid)}</p>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50">
                    <p className="text-xs font-semibold text-slate-500">To Pay</p>
                    <p className="mt-1 text-base font-extrabold text-slate-900 dark:text-white">{kes(payrollSummary.pending)}</p>
                  </div>
                </div>
              </article>
            </section>
          )}

          {/* School-at-a-glance and quick actions */}
          <section className="mt-5 grid gap-5 xl:grid-cols-[1.35fr_.85fr]">
            {/* Grade breakdown / role-specific panel */}
            <article className="bento-card rounded-2xl border border-slate-200/80 bg-white/95 p-5 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/90 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white">
                    {role === "SECRETARY"
                      ? "Admissions & Fee Status"
                      : role === "TEACHER"
                      ? "My Teaching Day"
                      : "School at a Glance"}
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    {role === "SECRETARY"
                      ? "Admissions pipeline and read-only fee balance information"
                      : role === "TEACHER"
                      ? "Your assigned classes and classroom actions"
                      : "Learner enrolment across grade levels"}
                  </p>
                </div>
                {role === "TEACHER" ? (
                  <Link
                    href="/teaching-log"
                    className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-3 py-2 text-xs font-bold text-blue-800 hover:bg-blue-100 dark:bg-blue-950/60 dark:text-blue-300"
                  >
                    Teaching log <ArrowRight size={13} />
                  </Link>
                ) : role === "SECRETARY" ? (
                  <Link
                    href="/admissions"
                    className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-3 py-2 text-xs font-bold text-blue-800 hover:bg-blue-100 dark:bg-blue-950/60 dark:text-blue-300"
                  >
                    Admissions <ArrowRight size={13} />
                  </Link>
                ) : (
                  <span className="rounded-full bg-slate-50 px-3 py-1.5 text-[10px] font-semibold text-slate-500 dark:bg-slate-800">
                    {gradeRows.length} grade levels
                  </span>
                )}
              </div>

              {role === "SECRETARY" ? (
                <div className="mt-7">
                  <div className="mb-2 flex justify-between text-xs">
                    <span className="font-semibold text-slate-600 dark:text-slate-300">Collection progress</span>
                    <span className="font-bold text-blue-800 dark:text-blue-300">{collectionPercent}% collected</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-blue-50 dark:bg-blue-950/40">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-500"
                      style={{ width: `${collectionPercent}%` }}
                    />
                  </div>
                  <p className="mt-3 text-xs text-slate-500">
                    {metrics[2]?.value} received · {metrics[3]?.value} outstanding
                  </p>
                </div>
              ) : role === "TEACHER" ? (
                <div className="mt-5 space-y-4">
                  {/* Today's Lessons Card */}
                  <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 dark:border-blue-900/60 dark:bg-blue-950/30">
                    <div className="flex items-center justify-between pb-2 border-b border-blue-200/60 dark:border-blue-900/40">
                      <div className="flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 text-blue-700 dark:text-blue-400" />
                        <span className="text-xs font-bold text-blue-950 dark:text-blue-200">
                          Today&apos;s Lessons ({todayDayName})
                        </span>
                      </div>
                      <Link
                        href="/timetable"
                        className="text-[11px] font-bold text-blue-700 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                      >
                        Full timetable <ArrowRight size={11} />
                      </Link>
                    </div>

                    {teacherTodayLessons.length === 0 ? (
                      <p className="mt-2.5 text-xs text-blue-800 dark:text-blue-300">
                        No lessons scheduled on your timetable for today ({todayDayName}).
                      </p>
                    ) : (
                      <div className="mt-2.5 space-y-2">
                        {teacherTodayLessons.map((l) => (
                          <div
                            key={l.id}
                            className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-slate-900 border border-blue-100 dark:border-blue-900/80 text-xs shadow-sm"
                          >
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded font-bold bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-[10px]">
                                P{l.period}
                              </span>
                              <div>
                                <span className="font-bold text-slate-900 dark:text-white">
                                  {l.subject}
                                </span>
                                <span className="text-[10px] text-slate-500 ml-2">
                                  ({l.grade})
                                </span>
                              </div>
                            </div>
                            <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                              {l.time}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Assigned Classes */}
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                      Assigned Classes
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {gradeRows.length ? (
                        gradeRows.map((item) => (
                          <div
                            key={item.grade}
                            className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-800/40"
                          >
                            <div>
                              <p className="text-sm font-bold text-slate-800 dark:text-white">{item.grade}</p>
                              <p className="mt-1 text-[11px] text-slate-500">
                                {new Set(assignments.filter((a) => a.grade === item.grade).map((a) => a.subject)).size} subjects
                              </p>
                            </div>
                            <Link
                              href="/assessments"
                              aria-label={`Open ${item.grade} assessments`}
                              className="grid h-9 w-9 place-items-center rounded-lg bg-white text-blue-700 shadow-sm dark:bg-slate-700 dark:text-blue-400"
                            >
                              <ChevronRight size={17} />
                            </Link>
                          </div>
                        ))
                      ) : (
                        <p className="col-span-2 rounded-xl bg-slate-50 p-5 text-sm text-slate-500 dark:bg-slate-800">
                          No class assignments are linked to this account yet.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ) : gradeRows.length ? (
                <div className="mt-6 space-y-4">
                  {gradeRows.map((item) => (
                    <div key={item.grade} className="grid grid-cols-[76px_1fr_36px] items-center gap-3">
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                        {item.grade.replace("Grade ", "Gr ")}
                      </span>
                      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-blue-600 to-blue-400"
                          style={{ width: `${Math.max(5, (item._count.id / maxGrade) * 100)}%` }}
                        />
                      </div>
                      <span className="text-right text-xs font-bold text-slate-700 dark:text-slate-300">{item._count.id}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-6 rounded-xl bg-slate-50 p-5 text-sm text-slate-500 dark:bg-slate-800">
                  Your finance summary is ready. Create an invoice or record a payment to get started.
                </div>
              )}
            </article>

            {/* Quick actions */}
            <article className="bento-card rounded-2xl border border-slate-200/80 bg-white/95 p-5 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/90 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white">Quick Actions</h2>
                  <p className="mt-1 text-xs text-slate-500">Jump straight into your work</p>
                </div>
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                  <ClipboardCheck size={18} />
                </span>
              </div>

              <div className="mt-5 space-y-2">
                {nav
                  .filter((item) => item.label !== "Overview")
                  .slice(0, 5)
                  .map(({ label, href, icon: Icon }) => (
                    <Link
                      key={label}
                      href={href}
                      className="group flex items-center gap-3 rounded-xl border border-slate-100 p-3 transition hover:border-blue-100 hover:bg-blue-50/60 dark:border-slate-800 dark:hover:border-blue-900 dark:hover:bg-blue-950/30"
                    >
                      <span className="grid h-9 w-9 place-items-center rounded-lg bg-slate-50 text-slate-600 transition group-hover:bg-white group-hover:text-blue-700 dark:bg-slate-800 dark:text-slate-400 dark:group-hover:bg-slate-700 dark:group-hover:text-blue-400">
                        <Icon size={17} />
                      </span>
                      <span className="flex-1 text-xs font-bold text-slate-700 dark:text-slate-300">{label}</span>
                      <ChevronRight size={15} className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-blue-600 dark:text-slate-600 dark:group-hover:text-blue-400" />
                    </Link>
                  ))}
              </div>
            </article>
          </section>

          {/* Recent school activity (Director / Head Teacher) */}
          {showActivity && (
            <section className="mt-5 rounded-2xl border border-slate-200/80 bg-white/95 p-5 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/90 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white">Recent School Activity</h2>
                  <p className="mt-1 text-xs text-slate-500">Latest changes recorded in the audit trail</p>
                </div>
                <Link href="/audit" className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300">
                  View audit log <ArrowRight size={14} />
                </Link>
              </div>

              <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
                {activity.length ? (
                  activity.map((event) => (
                    <div key={event.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
                      <span className="grid h-8 w-8 place-items-center rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                        <Clock3 size={15} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-bold text-slate-700 dark:text-slate-200">
                          {event.action.replaceAll("_", " ").toLowerCase()}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-400">{event.actor?.name ?? "System"} · {event.entity}</p>
                      </div>
                      <time className="text-[10px] text-slate-400">
                        {new Intl.DateTimeFormat("en-KE", {
                          dateStyle: "medium",
                          timeStyle: "short",
                          timeZone: "Africa/Nairobi",
                        }).format(event.createdAt)}
                      </time>
                    </div>
                  ))
                ) : (
                  <p className="py-5 text-sm text-slate-500">No recent activity recorded.</p>
                )}
              </div>
            </section>
          )}

          <footer className="flex flex-wrap items-center justify-between gap-2 py-7 text-[11px] text-slate-400">
            <span>Mary Royal School · Obunga, Kisumu</span>
            <span>Nurturing Excellence Through CBC</span>
          </footer>
        </main>
      </div>

      {/* Mobile navigation */}
      <nav
        aria-label="Dashboard mobile navigation"
        className="mobile-nav fixed inset-x-0 bottom-0 z-30 flex justify-around border-t border-slate-200/80 bg-white/95 px-2 pb-[max(.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_24px_rgba(15,35,70,.07)] backdrop-blur lg:hidden dark:border-slate-800 dark:bg-slate-950/95"
      >
        {nav.slice(0, 4).map(({ label, href, icon: Icon }) => (
          <Link
            key={label}
            href={href}
            aria-current={label === "Overview" ? "page" : undefined}
            className={`flex min-h-12 min-w-16 flex-1 flex-col items-center justify-center gap-1 rounded-lg text-[10px] font-semibold ${
              label === "Overview" ? "text-blue-700 dark:text-blue-400" : "text-slate-500 dark:text-slate-400"
            }`}
          >
            <Icon size={18} />
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
