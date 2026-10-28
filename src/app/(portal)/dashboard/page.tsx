import { cookies } from "next/headers";
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
  Wallet,
  ClipboardCheck,
  CircleDollarSign,
  Clock3,
  TrendingUp,
} from "lucide-react";
import { DirectorGettingStartedChecklist } from "@/components/director-checklist";
import { Card, EmptyState, PageHeader, StatCard } from "@/components/ui/primitives";

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

const kesShort = (value: number) =>
  value >= 1_000_000 ? `Ksh ${(value / 1_000_000).toFixed(1)}M` : value >= 1_000 ? `Ksh ${Math.round(value / 1_000)}K` : `Ksh ${value}`;

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
      { label: "Fees Collected", value: kesShort(collected), note: `${collectionPercent}% of invoiced fees`, iconName: "wallet", tone: "emerald" },
      { label: "Fee Balances", value: kesShort(balance), note: "Outstanding across all terms", iconName: "clock", tone: "amber" },
      { label: "Payroll This Month", value: kesShort(payrollSummary.total), note: `${payrollSummary.staffCount} staff · ${period}`, iconName: "dollar", tone: "blue" },
      { label: "Payroll Pending", value: kesShort(payrollSummary.pending), note: "Net pay awaiting payment", iconName: "clipboard", tone: "rose" },
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
      { label: "Fees Collected", value: kesShort(collected), note: `${billed ? Math.round((collected / billed) * 100) : 0}% of invoices`, iconName: "wallet", tone: "emerald" },
      { label: "Fee Balance", value: kesShort(balances), note: "Confirmed payments only", iconName: "clock", tone: "amber" },
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
      { label: "Fees Invoiced", value: kesShort(totals.invoiced), note: "Total invoiced", iconName: "dollar", tone: "purple" },
      { label: "Payments Received", value: kesShort(totals.paid), note: "Recorded payments", iconName: "wallet", tone: "emerald" },
      { label: "Outstanding", value: kesShort(totals.balance), note: "Remaining fee balances", iconName: "clock", tone: "amber" },
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
      { label: "My Welfare Savings", value: kesShort(totalSavings), note: "Total accumulated savings", iconName: "wallet", tone: "blue" },
      { label: "Max Loan Limit (60%)", value: kesShort(Math.floor(totalSavings * 0.6)), note: "60% of total savings", iconName: "dollar", tone: "emerald" },
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

  
  const quickActions: { label: string; href: string; note: string }[] =
    role === "DIRECTOR"
      ? [
          { label: "Admissions", href: "/admissions", note: "Review and approve new learners" },
          { label: "Finance", href: "/finance", note: "Invoices, payments and balances" },
          { label: "Staff", href: "/staff", note: "Directory, payroll and welfare" },
          { label: "Reports", href: "/reports", note: "Progress and performance" },
        ]
      : role === "HEAD_TEACHER"
        ? [
            { label: "Admissions", href: "/admissions", note: "Approve learners waiting to join" },
            { label: "Assessments", href: "/assessments", note: "Review and release results" },
            { label: "Learners", href: "/learners", note: "School register and profiles" },
            { label: "Reports", href: "/reports", note: "Progress and performance" },
          ]
        : role === "DEPUTY"
          ? [
              { label: "Attendance", href: "/attendance", note: "Mark and review today" },
              { label: "Assessments", href: "/assessments", note: "Exams and rubrics" },
              { label: "Library", href: "/library", note: "Textbooks and loans" },
              { label: "Timetable", href: "/timetable", note: "Published schedule" },
            ]
          : role === "TEACHER"
            ? [
                { label: "Attendance", href: "/attendance", note: "Mark your classes" },
                { label: "Assessments", href: "/assessments", note: "Enter and submit marks" },
                { label: "Assignments", href: "/assignments", note: "Homework and submissions" },
                { label: "Timetable", href: "/timetable", note: "Your week at a glance" },
              ]
            : role === "SECRETARY"
              ? [
                  { label: "Admissions", href: "/admissions", note: "New learner applications" },
                  { label: "Learners", href: "/learners", note: "School register and records" },
                  { label: "Finance", href: "/finance", note: "Fee structure and balances" },
                  { label: "Complaints", href: "/complaints", note: "Parent messages" },
                ]
              : role === "ACCOUNTANT"
                ? [
                    { label: "Finance", href: "/finance", note: "Invoices and payments" },
                    { label: "Receipts", href: "/finance", note: "Find a receipt on any invoice" },
                    { label: "Fee structures", href: "/finance/structures", note: "Term fee schedule" },
                    { label: "Learners", href: "/learners", note: "Learner accounts" },
                  ]
                : [
                    { label: "Welfare", href: "/welfare", note: "Savings, loans and contributions" },
                    { label: "Profile", href: "/profile", note: "Your details and password" },
                  ];

  const metricIcon = (name: string) => {
    switch (name) {
      case "users": return Users;
      case "graduation": return GraduationCap;
      case "calendar": return CalendarCheck;
      case "book": return BookOpen;
      case "wallet": return Wallet;
      case "clock": return Clock3;
      case "dollar": return CircleDollarSign;
      case "clipboard": return ClipboardCheck;
      default: return TrendingUp;
    }
  };

  const metricTone = (tone?: MetricItem["tone"]): "brand" | "success" | "warning" | "danger" | "neutral" =>
    tone === "emerald" ? "success" : tone === "amber" ? "warning" : tone === "rose" ? "danger" : tone === "purple" ? "neutral" : "brand";

  const hasGradeCounts = gradeRows.some((row) => row._count.id > 0);

  return (
    <div className="space-y-3">
      <PageHeader
        title={`Good ${greeting}, ${user.name.split(" ")[0]}`}
        help={roleCopy[role] ?? "Welcome to your Mary Royal School portal."}
        meta={
          <>
            {dateLabel} · {roleTitles[role] ?? role}
          </>
        }
      />

      {role === "DIRECTOR" ? <DirectorGettingStartedChecklist stats={directorStats} /> : null}

      <section aria-label="Key metrics" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {metrics.map((metric) => (
          <StatCard
            key={metric.label}
            label={metric.label}
            value={metric.value}
            note={metric.note}
            icon={metricIcon(metric.iconName)}
            tone={metricTone(metric.tone)}
          />
        ))}
      </section>

      {role === "DIRECTOR" ? (
        <div className="grid gap-3 xl:grid-cols-[1.35fr_.85fr]">
          <Card
            title="Fee collection by class"
            description={`Collected ${kes(feeRows.reduce((sum, row) => sum + row.collected, 0))} · Outstanding ${kes(feeRows.reduce((sum, row) => sum + row.balance, 0))}`}
            action={<Link href="/finance" className="btn btn-secondary btn-sm">Finance</Link>}
          >
            {feeRows.length ? (
              <ul className="space-y-3">
                {feeRows.map((row) => {
                  const percent = row.invoiced ? Math.round((row.collected / row.invoiced) * 100) : 0;
                  return (
                    <li key={row.grade} className="min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-body font-semibold text-ink">{row.grade}</span>
                        <span className="shrink-0 text-caption tabular-nums text-ink-3">{percent}% · {kes(row.balance)} due</span>
                      </div>
                      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-label={`${row.grade} fees collected`} aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
                        <div className="h-full rounded-full bg-brand" style={{ width: `${percent}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState title="No fee invoices yet" description="Invoices will appear here once they are issued." />
            )}
          </Card>

          <Card title="Staff payroll" description={`${payrollSummary.period || "Current month"} · ${payrollSummary.staffCount} staff on this pay run`}>
            <p className="text-caption text-ink-3">Net payroll this month</p>
            <p className="mt-1 text-kpi tabular-nums text-ink">{kes(payrollSummary.total)}</p>
            <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-line-soft pt-3">
              <div>
                <dt className="text-caption text-ink-3">Paid</dt>
                <dd className="text-body font-semibold tabular-nums text-success">{kes(payrollSummary.paid)}</dd>
              </div>
              <div>
                <dt className="text-caption text-ink-3">Pending</dt>
                <dd className="text-body font-semibold tabular-nums text-warning">{kes(payrollSummary.pending)}</dd>
              </div>
            </dl>
            <p className="mt-3 text-caption text-ink-3">{collectionPercent}% of invoiced fees collected this term.</p>
          </Card>
        </div>
      ) : null}

      {role === "TEACHER" ? (
        <div className="grid gap-3 xl:grid-cols-2">
          <Card title="Today's lessons" description={dateLabel}>
            {teacherTodayLessons.length ? (
              <ol className="divide-y divide-line-soft">
                {teacherTodayLessons.map((lesson) => (
                  <li key={lesson.id} className="flex min-h-14 items-center gap-3 py-2.5">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-soft text-label font-semibold text-brand-ink">{lesson.period}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-body font-semibold text-ink">{lesson.subject}</p>
                      <p className="text-caption text-ink-3">{lesson.grade}{lesson.room ? ` · ${lesson.room}` : ""}</p>
                    </div>
                    <span className="shrink-0 text-caption tabular-nums text-ink-3">{lesson.time}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyState title="No lessons scheduled today" description="Your timetable lessons will appear here." action={<Link href="/timetable" className="btn btn-secondary">Open timetable</Link>} />
            )}
          </Card>
          <Card title="My subjects" description={`${assignments.length} grade and subject pairs`}>
            {assignments.length ? (
              <ul className="flex flex-wrap gap-1.5">
                {assignments.map((item) => (
                  <li key={`${item.grade}-${item.subject}`} className="pill pill-blue">{item.grade} · {item.subject}</li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No classes assigned" description="Ask the Head Teacher to assign your classes." />
            )}
          </Card>
        </div>
      ) : null}

      {role !== "TEACHER" && hasGradeCounts ? (
        <Card title="Learners by grade" description="Active learners on the school register">
          <ul className="space-y-3">
            {gradeRows.map((row) => {
              const percent = Math.round((row._count.id / maxGrade) * 100);
              return (
                <li key={row.grade} className="min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-body font-semibold text-ink">{row.grade}</span>
                    <span className="shrink-0 text-caption tabular-nums text-ink-3">{row._count.id} learners</span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2">
                    <div className="h-full rounded-full bg-brand" style={{ width: `${percent}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}

      <Card title="Quick actions">
        <div className="grid gap-1 sm:grid-cols-2">
          {quickActions.map((action) => (
            <Link key={action.href} href={action.href} className="list-row -mx-1 rounded-lg px-1">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body font-semibold text-ink">{action.label}</span>
                <span className="block truncate text-caption text-ink-3">{action.note}</span>
              </span>
              <span aria-hidden="true" className="text-ink-3">›</span>
            </Link>
          ))}
        </div>
      </Card>

      {showActivity ? (
        <Card
          title="Recent school activity"
          action={<Link href="/audit" className="btn btn-quiet btn-sm">View all</Link>}
        >
          {activity.length ? (
            <ul className="divide-y divide-line-soft">
              {activity.map((event) => (
                <li key={event.id} className="flex min-h-14 items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-body text-ink">
                      <span className="font-semibold">{event.actor?.name ?? "System"}</span> {event.action.replaceAll("_", " ").toLowerCase()} {event.entity.toLowerCase()}
                    </p>
                    <p className="text-caption text-ink-3">
                      {new Intl.DateTimeFormat("en-KE", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Nairobi" }).format(event.createdAt)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No recent activity" description="Sensitive actions will be listed here as they happen." />
          )}
        </Card>
      ) : null}
    </div>
  );
}
