import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { db } from "@/lib/db";
import { readSession } from "@/lib/session";
import PortalFrame from "@/components/portal-frame";
import { LearnerLink } from "@/components/learner-link";
import {
  Calendar,
  CheckCircle2,
  GraduationCap,
  HeartHandshake,
  Receipt,
  Trophy,
  Wallet,
} from "lucide-react";
import ParentFeePaymentGuide from "@/components/parent-fee-payment-guide";

const kes = (n: number) =>
  new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(n);

export default async function FamilyPortal({
  searchParams,
}: {
  searchParams: Promise<{ child?: string }>;
}) {
  const token = (await cookies()).get("mary_session")?.value;
  const session = token ? await readSession(token) : null;
  if (!session) redirect("/");

  const [user, links] = await Promise.all([
    db.user.findUnique({
      where: { id: session.id },
      select: {
        id: true,
        name: true,
        role: true,
        suspended: true,
        forcePasswordChange: true,
      },
    }),
    db.guardianLink.findMany({
      where: { userId: session.id, learner: { archivedAt: null } },
      include: { learner: true },
      orderBy: { learner: { name: "asc" } },
    }),
  ]);

  if (!user || user.suspended) redirect("/");
  if (user.forcePasswordChange) redirect("/change-password");
  if (user.role !== "PARENT" && user.role !== "LEARNER") notFound();

  if (!links.length) {
    return (
      <PortalFrame active={user.role === "PARENT" ? "My children" : "My learning"}>
        <section className="mx-auto max-w-xl p-5 pb-28 md:py-16">
          <section className="glass dark:glass-dark rounded-3xl border border-slate-200/80 p-8 text-center shadow-sm dark:border-slate-800/80">
            <GraduationCap size={36} className="mx-auto text-blue-600" />
            <h1 className="mt-4 text-2xl font-black text-slate-900 dark:text-white">
              Family Portal Setup
            </h1>
            <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              No learner profile is linked to this account yet. Please contact the school
              administration to establish parent-child access.
            </p>
          </section>
        </section>
      </PortalFrame>
    );
  }

  const params = await searchParams;
  const selected = links.find((link) => link.learnerId === params.child) ?? links[0];
  const child = selected.learner;

  const [assessments, attendance, invoices] = await Promise.all([
    db.assessment.findMany({
      where: { learnerId: child.id, status: "RELEASED" },
      select: {
        subject: true,
        score: true,
        term: true,
        strand: true,
        competency: true,
        comment: true,
      },
      orderBy: [{ term: "desc" }, { subject: "asc" }],
      take: 100,
    }),
    db.attendance.findMany({
      where: { learnerId: child.id },
      select: { status: true, date: true },
      orderBy: { date: "desc" },
      take: 90,
    }),
    user.role === "PARENT"
      ? db.feeInvoice.findMany({
          where: { learnerId: child.id },
          include: {
            lines: true,
            payments: {
              where: { status: "RECORDED" },
              select: { id: true, receiptNo: true, amount: true },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 30,
        })
      : Promise.resolve([]),
  ]);

  const present = attendance.filter((a) => a.status === "PRESENT").length;
  const absent = attendance.filter((a) => a.status === "ABSENT").length;
  const attendancePct = attendance.length
    ? Math.round((present / attendance.length) * 100)
    : null;

  // Total outstanding balance across all invoices
  const totalBalance = invoices.reduce((sum, inv) => {
    const total = inv.lines.reduce((s, l) => s + l.amount, 0);
    const paid = inv.payments.reduce((s, p) => s + p.amount, 0);
    return sum + (total - paid - inv.creditApplied);
  }, 0);

  return (
    <PortalFrame active={user.role === "PARENT" ? "My children" : "My learning"}>
      <section className="mx-auto max-w-7xl p-4 pb-28 sm:p-6 md:p-8 space-y-6">
        {/* Hero Header Banner */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0a1b3b] via-blue-900 to-indigo-900 p-6 text-white shadow-xl sm:p-8">
          <div className="relative z-10 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/15 backdrop-blur-sm">
                <Image
                  src="/mary-royal-logo.png"
                  width={34}
                  height={34}
                  alt="Mary Royal School"
                  className="rounded-lg object-contain"
                />
              </div>
              <div>
                <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-400/30 bg-blue-500/20 px-3 py-0.5 text-[11px] font-semibold text-blue-200 backdrop-blur-sm">
                  {user.role === "PARENT" ? "Family Portal" : "Student Portal"}
                </div>
                <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">
                  Welcome, {user.name.split(" ")[0]}
                </h1>
                <p className="text-xs text-blue-100">
                  {user.role === "PARENT"
                    ? "Monitor academic results, daily attendance, and fee statements for your linked children."
                    : "Review your personal school records and assessments."}
                </p>
              </div>
            </div>

            {user.role === "PARENT" && (
              <Link
                href="/complaints"
                className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-white px-5 text-xs font-bold text-blue-950 shadow-md transition hover:bg-blue-50 active:scale-95"
              >
                <HeartHandshake size={15} />
                Message Leadership
              </Link>
            )}
          </div>
        </div>

        {/* Child Selector (If parent has multiple children) */}
        {links.length > 1 && (
          <div className="flex flex-col gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Select Child:
            </span>
            <nav aria-label="Switch child" className="flex flex-wrap gap-2">
              {links.map((link) => {
                const isSelected = link.learnerId === child.id;
                return (
                  <Link
                    key={link.learnerId}
                    href={`/portal?child=${link.learnerId}`}
                    aria-current={isSelected ? "page" : undefined}
                    className={`rounded-2xl border px-4 py-2 text-xs font-bold transition-all ${
                      isSelected
                        ? "border-blue-700 bg-blue-700 text-white shadow-md shadow-blue-700/20"
                        : "border-slate-200/80 bg-white/80 text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300"
                    }`}
                  >
                    {link.learner.name} ({link.learner.grade})
                  </Link>
                );
              })}
            </nav>
          </div>
        )}

        {/* Active Child Profile Bento Banner */}
        <section className="glass dark:glass-dark rounded-3xl border border-slate-200/80 p-6 shadow-sm dark:border-slate-800/80">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-blue-100 font-bold text-blue-800 text-xl dark:bg-blue-950/80 dark:text-blue-300">
                {child.name.charAt(0).toUpperCase()}
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <LearnerLink
                    id={child.id}
                    name={child.name}
                    showAdmissionNo={false}
                    className="text-lg font-black text-slate-900 dark:text-white"
                  />
                  <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                    {child.grade}
                  </span>
                </div>
                <p className="mt-1 font-mono text-xs text-slate-500 dark:text-slate-400">
                  Admission No: {child.admissionNo} · Gender: {child.gender}
                </p>
              </div>
            </div>

            <Link
              href={`/learners/${child.id}`}
              className="inline-flex items-center gap-1.5 self-start rounded-2xl border border-blue-200 bg-blue-50/70 px-4 py-2 text-xs font-bold text-blue-800 transition hover:bg-blue-100 sm:self-auto dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-300"
            >
              Open Complete Learner Profile →
            </Link>
          </div>
        </section>

        {/* KPI Bento Grid */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="glass dark:glass-dark rounded-3xl border border-slate-200/80 p-5 shadow-sm dark:border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Attendance Rate
              </span>
              <div className="rounded-xl bg-emerald-50 p-2 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
                <CheckCircle2 size={16} />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-black text-emerald-700 dark:text-emerald-400">
                {attendancePct === null ? "—" : `${attendancePct}%`}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {present} present, {absent} absent
            </p>
          </div>

          <div className="glass dark:glass-dark rounded-3xl border border-slate-200/80 p-5 shadow-sm dark:border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Released Marks
              </span>
              <div className="rounded-xl bg-blue-50 p-2 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400">
                <Trophy size={16} />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900 dark:text-white">
                {assessments.length}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Official CBE evaluations</p>
          </div>

          {user.role === "PARENT" && (
            <>
              <div className="glass dark:glass-dark rounded-3xl border border-slate-200/80 p-5 shadow-sm dark:border-slate-800/80">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Outstanding Balance
                  </span>
                  <div
                    className={`rounded-xl p-2 ${
                      totalBalance > 0
                        ? "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400"
                        : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
                    }`}
                  >
                    <Wallet size={16} />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span
                    className={`text-2xl font-black ${
                      totalBalance > 0
                        ? "text-amber-700 dark:text-amber-400"
                        : "text-emerald-700 dark:text-emerald-400"
                    }`}
                  >
                    {kes(totalBalance)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {totalBalance > 0 ? "Due for current term" : "Fees fully cleared"}
                </p>
              </div>

              <div className="glass dark:glass-dark rounded-3xl border border-slate-200/80 p-5 shadow-sm dark:border-slate-800/80">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Fee Invoices
                  </span>
                  <div className="rounded-xl bg-purple-50 p-2 text-purple-700 dark:bg-purple-950/60 dark:text-purple-400">
                    <Receipt size={16} />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-2xl font-black text-purple-700 dark:text-purple-400">
                    {invoices.length}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Billing records</p>
              </div>
            </>
          )}
        </div>

        {/* Dual Section: Attendance & Released Results */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Attendance Log Card */}
          <section className="glass dark:glass-dark rounded-3xl border border-slate-200/80 p-6 shadow-sm dark:border-slate-800/80">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Calendar size={18} className="text-blue-600" />
                <h2 className="text-base font-black text-slate-900 dark:text-white">
                  Attendance Records
                </h2>
              </div>
              <span className="text-xs font-semibold text-slate-500">
                Past {attendance.length} roll calls
              </span>
            </div>

            {attendance.length === 0 ? (
              <p className="mt-6 text-center text-xs text-slate-500 dark:text-slate-400">
                No attendance logs entered for this learner yet.
              </p>
            ) : (
              <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
                {attendance.slice(0, 7).map((item, index) => {
                  const isPresent = item.status === "PRESENT";
                  const isLate = item.status === "LATE";
                  return (
                    <div
                      key={index}
                      className="flex items-center justify-between py-2.5 text-xs"
                    >
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        {new Intl.DateTimeFormat("en-KE", {
                          dateStyle: "medium",
                          timeZone: "Africa/Nairobi",
                        }).format(item.date)}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                          isPresent
                            ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                            : isLate
                            ? "bg-amber-50 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300"
                            : "bg-red-50 text-red-800 dark:bg-red-950/60 dark:text-red-300"
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Released Results Card */}
          <section className="glass dark:glass-dark rounded-3xl border border-slate-200/80 p-6 shadow-sm dark:border-slate-800/80">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Trophy size={18} className="text-amber-500" />
                <h2 className="text-base font-black text-slate-900 dark:text-white">
                  Released Academic Results
                </h2>
              </div>
              <span className="text-xs font-semibold text-slate-500">
                {assessments.length} marks
              </span>
            </div>

            {assessments.length === 0 ? (
              <p className="mt-6 text-center text-xs text-slate-500 dark:text-slate-400">
                No official scores have been released for this learner yet.
              </p>
            ) : (
              <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
                {assessments.slice(0, 6).map((item, index) => (
                  <div
                    key={`${item.term}-${item.subject}-${index}`}
                    className="flex items-start justify-between py-2.5 text-xs"
                  >
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white">
                        {item.subject}{" "}
                        <span className="text-[10px] font-normal text-slate-400">
                          ({item.term})
                        </span>
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {item.strand ?? item.competency ?? "Curriculum Strand"}
                      </p>
                    </div>
                    <span className="font-mono font-black text-blue-700 dark:text-blue-400">
                      {item.score}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Parent-Only Fee Statements Section */}
        {user.role === "PARENT" && (
          <div className="space-y-6">
            <ParentFeePaymentGuide
              learnerName={child.name}
              admissionNo={child.admissionNo}
              outstandingBalance={totalBalance}
            />

            <section className="glass dark:glass-dark rounded-3xl border border-slate-200/80 p-6 shadow-sm dark:border-slate-800/80">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
                <div>
                  <h2 className="text-base font-black text-slate-900 dark:text-white">
                    Fee Statements &amp; Payment Receipts
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Official school invoices and issued payment receipts for {child.name}.
                  </p>
                </div>
              </div>

            {invoices.length === 0 ? (
              <p className="mt-6 text-center text-xs text-slate-500 dark:text-slate-400">
                No invoices issued for this learner.
              </p>
            ) : (
              <div className="mt-5 space-y-4">
                {invoices.map((invoice) => {
                  const total = invoice.lines.reduce((sum, line) => sum + line.amount, 0);
                  const paid = invoice.payments.reduce((sum, payment) => sum + payment.amount, 0);
                  const balance = total - paid - invoice.creditApplied;

                  return (
                    <article
                      key={invoice.id}
                      className="rounded-2xl border border-slate-200/80 bg-white/70 p-4 transition-all dark:border-slate-800 dark:bg-slate-900/50"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-slate-900 dark:text-white">
                              {invoice.term}
                            </h3>
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                                balance <= 0
                                  ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                                  : "bg-amber-50 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300"
                              }`}
                            >
                              {balance <= 0 ? "Cleared" : "Balance Due"}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            Total Invoiced: {kes(total)} · Paid: {kes(paid)}
                          </p>
                        </div>

                        <div className="text-right">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Balance
                          </span>
                          <p
                            className={`font-mono text-base font-black ${
                              balance > 0
                                ? "text-amber-700 dark:text-amber-400"
                                : "text-emerald-700 dark:text-emerald-400"
                            }`}
                          >
                            {kes(balance)}
                          </p>
                        </div>
                      </div>

                      {/* Attached Payment Receipts */}
                      {invoice.payments.length > 0 && (
                        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                          <span className="text-[11px] font-semibold text-slate-500">
                            Receipts:
                          </span>
                          {invoice.payments.map((p) => (
                            <Link
                              key={p.id}
                              href={`/receipts/${p.id}`}
                              className="inline-flex items-center gap-1 rounded-xl border border-blue-200 bg-blue-50/70 px-2.5 py-1 text-[11px] font-bold text-blue-800 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-300"
                            >
                              <Receipt size={12} />
                              {p.receiptNo} · {kes(p.amount)}
                            </Link>
                          ))}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
        )}

        <footer className="py-6 text-center text-xs text-slate-400 dark:text-slate-500">
          Mary Royal School · Obunga, Kisumu, Kenya · CBC Excellence
        </footer>
      </section>
    </PortalFrame>
  );
}
