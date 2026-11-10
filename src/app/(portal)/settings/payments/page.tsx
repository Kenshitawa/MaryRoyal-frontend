import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ArrowLeft, Wallet } from "lucide-react";
import PaymentSettingsForm from "@/components/payment-settings-form";
import { db } from "@/lib/db";
import { canInScope } from "@/lib/permissions";
import { getPaymentSettingsView } from "@/lib/payment-settings";
import { readSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function PaymentSettingsPage() {
  const token = (await cookies()).get("school_session")?.value;
  const session = token ? await readSession(token) : null;
  if (!session) redirect("/");

  const user = await db.user.findFirst({
    where: { id: session.id, schoolId: session.schoolId },
    select: { id: true, role: true, suspended: true, forcePasswordChange: true },
  });
  if (!user || user.suspended) redirect("/");
  if (user.forcePasswordChange) redirect("/change-password");
  if (!canInScope(user.role, "paymentSettings", "view", "school")) redirect("/dashboard");

  const settings = await getPaymentSettingsView(session.schoolId);

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <Link
        href="/finance"
        className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-brand hover:underline"
      >
        <ArrowLeft size={15} aria-hidden="true" /> Back to finance
      </Link>

      <section className="rounded-2xl border border-slate-200 bg-gradient-to-r from-blue-700 to-blue-900 p-5 text-white shadow-sm sm:p-6">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/15">
            <Wallet size={21} aria-hidden="true" />
          </span>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[.16em] text-blue-100">
              Finance settings
            </p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">
              Payment settings
            </h1>
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-blue-100">
              Manage the M-Pesa, bank and Daraja collection details for this school. Director and
              Accountant access only; credentials stay encrypted on the server.
            </p>
          </div>
        </div>
      </section>

      <PaymentSettingsForm
        initial={settings}
        endpoint="/api/payment-settings"
        canEdit={canInScope(user.role, "paymentSettings", "update", "school")}
      />
    </div>
  );
}
