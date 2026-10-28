import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { readSession } from "@/lib/session";
import { canInScope } from "@/lib/permissions";
import FinanceClient from "./finance-client";
import PayrollSheet from "./payroll-sheet";
import { Layers } from "lucide-react";
import { PageHeader } from "@/components/ui/primitives";

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
    <div className="space-y-3">
      <PageHeader
        title="Finance"
        help="Term invoicing, fee collection, M-Pesa receipts and arrears in one place."
        action={
          <Link href="/finance/structures" className="btn btn-secondary">
            <Layers size={15} aria-hidden="true" />
            <span>Fee structures</span>
          </Link>
        }
      />

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
    </div>
  );
}
