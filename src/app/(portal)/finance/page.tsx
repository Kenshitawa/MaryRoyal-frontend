import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { readSession } from "@/lib/session";
import { canInScope } from "@/lib/permissions";
import FinanceClient from "./finance-client";
import PayrollSheet from "./payroll-sheet";
import { ArrowRight, Layers } from "lucide-react";

export default async function FinancePage() {
  const token = (await cookies()).get("mary_session")?.value;
  const session = token ? await readSession(token) : null;
  if (!session) redirect("/");

  const user = await db.user.findUnique({ where: { id: session.id } });
  if (!user || user.suspended) redirect("/");
  if (user.forcePasswordChange) redirect("/change-password");
  if (!canInScope(user.role, "finance", "view", "school")) redirect("/dashboard");

  const canPayroll = user.role === "HEAD_TEACHER" || user.role === "DIRECTOR";

  return (
    <>
      <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 md:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">
              Accounts & Revenue
            </p>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl dark:text-white">
              Financial Management
            </h1>
          </div>

          <Link
            href="/finance/structures"
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-2.5 text-xs font-bold text-blue-800 shadow-sm backdrop-blur-sm transition hover:bg-blue-50 dark:border-slate-800 dark:bg-slate-900/80 dark:text-blue-300 dark:hover:bg-slate-800"
          >
            <Layers size={15} />
            <span>View Approved Fee Structures</span>
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>

      <FinanceClient
        canInvoice={user.role === "ACCOUNTANT" || user.role === "DIRECTOR"}
        canPay={user.role === "ACCOUNTANT" || user.role === "SECRETARY" || user.role === "HEAD_TEACHER" || user.role === "DIRECTOR"}
        canApprove={user.role === "HEAD_TEACHER" || user.role === "DIRECTOR"}
        canVoid={user.role === "ACCOUNTANT" || user.role === "DIRECTOR"}
      />

      {canPayroll && (
        <PayrollSheet
          canManage={user.role === "HEAD_TEACHER"}
          canApprove={user.role === "DIRECTOR"}
        />
      )}
    </>
  );
}
