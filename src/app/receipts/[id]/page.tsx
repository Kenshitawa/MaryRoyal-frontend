import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { db } from "@/lib/db";
import { readSession } from "@/lib/session";
import { canInScope } from "@/lib/permissions";
import { PrintButton } from "./print-button";
import PageNavigation from "@/components/page-navigation";
import { LearnerLink } from "@/components/learner-link";
import { ArrowLeft, CheckCircle2, AlertCircle, FileText } from "lucide-react";

const kes = (n: number) =>
  new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0
  }).format(n);

export default async function ReceiptPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const token = (await cookies()).get("mary_session")?.value;
  const session = token ? await readSession(token) : null;
  if (!session) redirect("/");

  const user = await db.user.findUnique({ where: { id: session.id } });
  if (!user || user.suspended) redirect("/");
  if (user.forcePasswordChange) redirect("/change-password");

  const { id } = await params;
  const schoolPaymentsAllowed = canInScope(user.role, "payments", "view", "school");
  const linkedPaymentsAllowed = canInScope(user.role, "payments", "view", "linked");
  if (!schoolPaymentsAllowed && !linkedPaymentsAllowed) {
    await db.auditEvent.create({
      data: { actorId: user.id, action: "ACCESS_DENIED", entity: "FeePayment", entityId: id }
    });
    notFound();
  }
  const payment = await db.feePayment.findUnique({
    where: { id },
    include: {
      invoice: {
        include: {
          learner: true,
          lines: true
        }
      }
    }
  });

  if (!payment || payment.status === "PENDING") notFound();

  if (!schoolPaymentsAllowed && linkedPaymentsAllowed) {
    const link = await db.guardianLink.findUnique({
      where: {
        userId_learnerId: {
          userId: user.id,
          learnerId: payment.invoice.learnerId
        }
      }
    });
    if (!link) {
      await db.auditEvent.create({
        data: { actorId: user.id, action: "ACCESS_DENIED", entity: "FeePayment", entityId: id }
      });
      notFound();
    }
  }

  const homeHref = user.role === "PARENT" ? "/portal" : "/finance";

  return (
    <>
      <a href="#receipt" className="skip-link">
        Skip to content
      </a>
      <header aria-label="Receipt navigation" className="print:hidden">
        <nav aria-label="Receipt breadcrumbs">
          <div className="flex items-center gap-2 bg-blue-800 px-4 py-2 text-white lg:hidden">
            <Link
              href={homeHref}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-2 text-sm font-semibold text-white hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
            >
              <ArrowLeft size={16} aria-hidden="true" />
              {user.role === "PARENT" ? "Back to portal" : "Back to finance"}
            </Link>
            <span className="ml-auto text-sm font-semibold text-blue-100">Fee receipt</span>
          </div>
          <PageNavigation active="Fee receipt" homeHref={homeHref} userId={user.id} />
        </nav>
      </header>
      <main id="receipt" className="mx-auto my-6 max-w-2xl px-4 sm:px-6 print:m-0 print:max-w-none print:p-0">
        <div className="animate-boardui-in overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-lg shadow-blue-950/5 print:rounded-none print:border print:border-slate-300 print:shadow-none dark:border-slate-800 dark:bg-slate-900">
          {/* Header banner */}
          <div className="border-b border-blue-950/20 bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 px-5 py-5 text-white sm:px-7 print:bg-white print:text-slate-950 print:border-b-2 print:border-slate-900">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white p-1.5 shadow-sm print:border print:border-slate-200">
                  <Image
                    src="/mary-royal-logo.png"
                    width={44}
                    height={44}
                    alt="Mary Royal School logo"
                    className="h-full w-full object-contain"
                  />
                </span>
                <div>
                  <h1 className="text-base font-bold tracking-tight text-white print:text-slate-950">Mary Royal School</h1>
                  <p className="text-[11px] font-medium text-blue-200 print:text-slate-600">P.O. Box 40100, Kisumu, Kenya</p>
                </div>
              </div>

              <div className="text-right">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${
                    payment.status === "VOID"
                      ? "bg-rose-500/20 text-rose-200 ring-1 ring-rose-400/30 print:bg-slate-100 print:text-rose-700"
                      : "bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-400/30 print:bg-slate-100 print:text-emerald-800"
                  }`}
                >
                  {payment.status === "VOID" ? (
                    <>
                      <AlertCircle size={12} /> VOIDED
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={12} /> OFFICIAL RECEIPT
                    </>
                  )}
                </span>
                <p className="mt-1 font-mono text-[11px] font-semibold text-blue-200 print:text-slate-700">{payment.receiptNo}</p>
              </div>
            </div>
          </div>

          <div className="p-5 sm:p-7">
            {payment.status === "VOID" && (
              <div className="mb-5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300">
                <span className="font-bold">Void Reason:</span> {payment.voidReason || "Transaction invalidated by finance administrator"}
              </div>
            )}

            {/* Learner & Payment Details Grid */}
            <div className="grid grid-cols-1 gap-3.5 rounded-xl border border-slate-200/80 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-800/40 sm:grid-cols-2">
              <div>
                <dt className="text-base font-semibold uppercase tracking-wider text-slate-400">Learner</dt>
                <dd className="mt-0.5 text-xs font-bold text-slate-900 dark:text-white">
                  <LearnerLink id={payment.invoice.learnerId} name={payment.invoice.learner.name} />
                </dd>
              </div>

              <div>
                <dt className="text-base font-semibold uppercase tracking-wider text-slate-400">Admission No</dt>
                <dd className="mt-0.5 text-xs font-semibold text-slate-800 dark:text-slate-200">
                  <LearnerLink id={payment.invoice.learnerId} admissionNo={payment.invoice.learner.admissionNo} />
                </dd>
              </div>

              <div>
                <dt className="text-base font-semibold uppercase tracking-wider text-slate-400">Class &amp; Term</dt>
                <dd className="mt-0.5 text-xs font-medium text-slate-700 dark:text-slate-300">
                  {payment.invoice.learner.grade} · {payment.invoice.term}
                </dd>
              </div>

              <div>
                <dt className="text-base font-semibold uppercase tracking-wider text-slate-400">Payment Date</dt>
                <dd className="mt-0.5 text-xs font-medium text-slate-700 dark:text-slate-300">
                  {new Intl.DateTimeFormat("en-KE", {
                    dateStyle: "medium",
                    timeStyle: "short",
                    timeZone: "Africa/Nairobi"
                  }).format(payment.createdAt)}
                </dd>
              </div>

              <div className="sm:col-span-2">
                <dt className="text-base font-semibold uppercase tracking-wider text-slate-400">Method &amp; Ref</dt>
                <dd className="mt-0.5 font-mono text-xs font-medium text-slate-800 dark:text-slate-200">
                  {payment.method}
                  {payment.mpesaCode ? ` · M-PESA: ${payment.mpesaCode}` : ""}
                  {payment.reference ? ` · Ref: ${payment.reference}` : ""}
                </dd>
              </div>
            </div>

            {/* Fee Items Breakdown */}
            <div className="mt-5">
              <h2 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <FileText size={13} /> Fee Statement Lines
              </h2>
              <div className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200/80 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900/50">
                {payment.invoice.lines.map((line) => (
                  <div key={line.id} className="flex justify-between px-3.5 py-2 text-xs text-slate-700 dark:text-slate-300">
                    <span className="font-medium">{line.description}</span>
                    <span className="font-semibold tabular-nums">{kes(line.amount)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Total paid and receipt reference */}
            <div className="mt-5 flex flex-col items-center justify-between gap-4 rounded-xl border border-blue-100 bg-blue-50/40 p-4 dark:border-blue-900/40 dark:bg-blue-950/20 sm:flex-row print:border-slate-300 print:bg-slate-50">
              <div>
                <p className="text-base font-bold uppercase tracking-wider text-blue-900 dark:text-blue-300 print:text-slate-700">
                  Amount Received
                </p>
                <p className="mt-0.5 text-xl font-extrabold text-blue-950 tabular-nums dark:text-white print:text-slate-950">
                  {kes(payment.amount)}
                </p>
                <span className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                  <CheckCircle2 size={13} className="text-emerald-600" />
                  Payment recorded in school accounts
                </span>
              </div>

              <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-xs dark:border-slate-700 dark:bg-slate-800 print:shadow-none">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                  <FileText size={20} aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">Receipt reference</p>
                  <p className="font-mono text-sm font-semibold text-slate-900 dark:text-white">{payment.receiptNo}</p>
                </div>
              </div>
            </div>

            <p className="mt-5 text-center text-base text-slate-400">
              {payment.status === "VOID"
                ? `Receipt ${payment.receiptNo} has been voided. Retain this copy for reference.`
                : "Payment receipt issued by Mary Royal School, Obunga, Kisumu. Retain this copy for your records."}
            </p>

            <div className="mt-5 flex justify-center">
              <PrintButton receiptId={payment.id} />
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
