import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { readSession } from "@/lib/session";
import { canInScope } from "@/lib/permissions";
import PortalFrame from "@/components/portal-frame";
import { Users, BookOpenCheck, ReceiptText, FileBarChart2 } from "lucide-react";
import ReportsVisualizer, {
  FinanceData,
  AssessmentData,
  LearnerGradeData,
} from "./reports-visualizer";

export default async function ReportsPage() {
  const token = (await cookies()).get("mary_session")?.value;
  const session = token ? await readSession(token) : null;
  if (!session) redirect("/");

  const user = await db.user.findUnique({
    where: { id: session.id },
    select: { role: true, suspended: true, forcePasswordChange: true },
  });
  if (!user || user.suspended) redirect("/");
  if (user.forcePasswordChange) redirect("/change-password");
  if (!canInScope(user.role, "exports", "view", "school")) redirect("/dashboard");

  const [learnersCount, gradeGroups, assessmentsCount, assessmentsList, invoicesList, welfareTrend] =
    await Promise.all([
      db.learner.count({ where: { archivedAt: null } }),
      db.learner.groupBy({
        by: ["grade"],
        where: { archivedAt: null },
        _count: { id: true },
        orderBy: { grade: "asc" },
      }),
      db.assessment.count({ where: { status: "RELEASED" } }),
      db.assessment.findMany({
        where: { status: "RELEASED" },
        select: { score: true, subject: true, term: true },
        take: 2000,
      }),
      db.feeInvoice.findMany({
        select: {
          term: true,
          creditApplied: true,
          lines: { select: { amount: true } },
          payments: {
            where: { status: "RECORDED" },
            select: { amount: true },
          },
        },
        take: 2000,
      }),
      db.welfareContribution.groupBy({ by: ["year", "month"], _sum: { amount: true }, _count: { id: true }, orderBy: [{ year: "asc" }, { month: "asc" }], take: 12 }),
    ]);

  // Aggregate Finance Data
  let totalInvoiced = 0;
  let totalCollected = 0;
  const termsMap = new Map<string, { term: string; invoiced: number; collected: number; balance: number }>();

  for (const inv of invoicesList) {
    const invTotal = inv.lines.reduce((acc, l) => acc + l.amount, 0);
    const invPaid = inv.payments.reduce((acc, p) => acc + p.amount, 0);
    const netBilled = Math.max(0, invTotal - inv.creditApplied);

    totalInvoiced += netBilled;
    totalCollected += invPaid;

    const termKey = inv.term || "General Term";
    const existing = termsMap.get(termKey) || {
      term: termKey,
      invoiced: 0,
      collected: 0,
      balance: 0,
    };
    existing.invoiced += netBilled;
    existing.collected += invPaid;
    existing.balance = Math.max(0, existing.invoiced - existing.collected);
    termsMap.set(termKey, existing);
  }

  const totalBalance = Math.max(0, totalInvoiced - totalCollected);
  const collectionRate = totalInvoiced > 0 ? Math.round((totalCollected / totalInvoiced) * 100) : 0;

  const financeData: FinanceData = {
    totalInvoiced,
    totalCollected,
    totalBalance,
    collectionRate,
    invoiceCount: invoicesList.length,
    terms: Array.from(termsMap.values()),
  };

  // Aggregate Assessment Data
  let scoreSum = 0;
  let ee = 0;
  let me = 0;
  let ae = 0;
  let be = 0;
  const subjectsMap = new Map<string, { sum: number; count: number }>();

  for (const a of assessmentsList) {
    scoreSum += a.score;
    if (a.score >= 80) ee++;
    else if (a.score >= 60) me++;
    else if (a.score >= 40) ae++;
    else be++;

    const sub = subjectsMap.get(a.subject) || { sum: 0, count: 0 };
    sub.sum += a.score;
    sub.count++;
    subjectsMap.set(a.subject, sub);
  }

  const totalAssessments = assessmentsList.length;
  const avgScore = totalAssessments > 0 ? Math.round(scoreSum / totalAssessments) : 0;

  const assessmentData: AssessmentData = {
    total: assessmentsCount,
    avgScore,
    descriptors: {
      ee: { count: ee, pct: totalAssessments ? Math.round((ee / totalAssessments) * 100) : 0 },
      me: { count: me, pct: totalAssessments ? Math.round((me / totalAssessments) * 100) : 0 },
      ae: { count: ae, pct: totalAssessments ? Math.round((ae / totalAssessments) * 100) : 0 },
      be: { count: be, pct: totalAssessments ? Math.round((be / totalAssessments) * 100) : 0 },
    },
    subjects: Array.from(subjectsMap.entries()).map(([subject, val]) => ({
      subject,
      avg: Math.round(val.sum / val.count),
      count: val.count,
    })),
  };

  // Aggregate Learner Grade Data
  const learnerGrades: LearnerGradeData[] = gradeGroups.map((g) => ({
    grade: g.grade,
    count: g._count.id,
    pct: learnersCount > 0 ? Math.round((g._count.id / learnersCount) * 100) : 0,
  }));
  const bands = [
    { name: "ECD", test: /^(PP|ECD)/i },
    { name: "Lower Primary", test: /^(Grade\s*)?[1-3]$/i },
    { name: "Upper Primary", test: /^(Grade\s*)?[4-6]$/i },
    { name: "JSS", test: /^(Grade\s*)?[7-9]$/i },
  ].map((band) => ({ name: band.name, learners: gradeGroups.filter((row) => band.test.test(row.grade.trim())).reduce((total, row) => total + row._count.id, 0) }));
  const welfareMax = Math.max(...welfareTrend.map((row) => row._sum.amount ?? 0), 1);

  const totals = [
    {
      label: "Active Learners",
      value: learnersCount,
      icon: Users,
      description: "Enrolled across all grades",
      tone: "blue",
    },
    {
      label: "Released Assessments",
      value: assessmentsCount,
      icon: BookOpenCheck,
      description: "CBC marks visible to families",
      tone: "purple",
    },
    {
      label: "Fee Invoices",
      value: invoicesList.length,
      icon: ReceiptText,
      description: "All term invoices tracked",
      tone: "emerald",
    },
  ];

  const toneStyles: Record<string, string> = {
    blue: "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300",
    purple: "bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300",
    emerald: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
  };

  return (
    <PortalFrame active="Reports">
      <section className="mx-auto max-w-7xl space-y-6 p-4 pb-28 sm:p-6 lg:p-8">
        {/* Executive Hero Header */}
        <div className="bento-card overflow-hidden rounded-3xl border border-blue-100 bg-gradient-to-r from-blue-950 via-blue-900 to-indigo-950 p-6 text-white shadow-xl shadow-blue-950/15 sm:p-8 dark:border-blue-900/50">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-400/20 px-3 py-1 text-xs font-bold text-blue-200 ring-1 ring-inset ring-blue-300/30">
                <FileBarChart2 size={14} className="text-blue-300" />
                Director Executive Intelligence &amp; Data Hub
              </span>
              <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">
                School Analytics &amp; Verified Reports
              </h1>
              <p className="mt-1 text-xs text-blue-100/90 sm:text-sm">
                Interactive executive charts paired with live CSV exports for MOE compliance, audit, and strategic review.
              </p>
            </div>
          </div>
        </div>

        {/* High Level Metrics Bar */}
        <section className="grid gap-4 sm:grid-cols-3" aria-label="Executive summary metrics">
          {totals.map(({ label, value, icon: Icon, description, tone }) => (
            <article
              key={label}
              className="bento-card flex items-center justify-between rounded-2xl border border-slate-200/90 bg-white/95 p-5 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/90"
            >
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</p>
                <p className="mt-1 text-3xl font-black text-slate-900 dark:text-white">{value}</p>
                <p className="mt-0.5 text-[11px] text-slate-400">{description}</p>
              </div>
              <span className={`grid h-12 w-12 place-items-center rounded-2xl ${toneStyles[tone]}`}>
                <Icon size={22} />
              </span>
            </article>
          ))}
        </section>

        {/* Visual Charts & Download Side-by-Side Panels */}
        <ReportsVisualizer
          finance={financeData}
          assessment={assessmentData}
          learners={{
            total: learnersCount,
            byGrade: learnerGrades,
          }}
        />
        <section className="grid gap-5 lg:grid-cols-2" aria-label="Additional school reports">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Enrollment by learning stage</h2>
            <p className="mt-1 text-xs text-slate-500">Current learners grouped using their configured grade labels.</p>
            <div className="mt-5 space-y-4">{bands.map((band) => <div key={band.name}><div className="mb-1 flex justify-between text-sm"><span className="font-semibold text-slate-700 dark:text-slate-200">{band.name}</span><span className="font-bold text-blue-700 dark:text-blue-300">{band.learners}</span></div><div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-blue-600" style={{ width: `${learnersCount ? Math.max(2, band.learners / learnersCount * 100) : 0}%` }} /></div></div>)}</div>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Welfare contribution activity</h2>
            <p className="mt-1 text-xs text-slate-500">Monthly contributions recorded by the staff welfare programme.</p>
            {welfareTrend.length ? <div className="mt-5 flex h-36 items-end gap-2">{welfareTrend.map((row) => <div key={`${row.year}-${row.month}`} title={`${new Intl.DateTimeFormat("en", { month: "short" }).format(new Date(row.year, row.month - 1))} ${row.year}: KES ${(row._sum.amount ?? 0).toLocaleString()}`} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2"><div className="w-full rounded-t-lg bg-blue-600/90" style={{ height: `${Math.max(4, (row._sum.amount ?? 0) / welfareMax * 100)}%` }} /><span className="text-[10px] text-slate-500">{new Intl.DateTimeFormat("en", { month: "short" }).format(new Date(row.year, row.month - 1))}</span></div>)}</div> : <p className="mt-6 rounded-xl bg-slate-50 p-5 text-sm text-slate-500 dark:bg-slate-800">No welfare contributions are recorded yet.</p>}
          </article>
        </section>
      </section>
    </PortalFrame>
  );
}
