import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { readSession } from "@/lib/session";
import { can } from "@/lib/permissions";
import AccountDirectory from "./account-directory";
import GuardianLinks from "./guardian-links";
import PortalFrame from "@/components/portal-frame";

export default async function AccountsPage() {
  const token = (await cookies()).get("mary_session")?.value;
  const session = token ? await readSession(token) : null;
  if (!session) redirect("/");

  const user = await db.user.findUnique({
    where: { id: session.id },
    select: { role: true, suspended: true, forcePasswordChange: true },
  });

  if (!user || user.suspended) redirect("/");
  if (user.forcePasswordChange) redirect("/change-password");
  if (!can(user.role, "accounts", "view")) redirect("/dashboard");

  return (
    <PortalFrame active="Accounts">
      <section className="mx-auto max-w-7xl p-5 pb-28 md:p-8">
        <AccountDirectory />
        <GuardianLinks />
      </section>
    </PortalFrame>
  );
}
