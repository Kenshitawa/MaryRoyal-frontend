import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { readSession } from "@/lib/session";
import { canInScope } from "@/lib/permissions";
import PortalFrame from "@/components/portal-frame";
import RubricsClient from "./rubrics-client";

export default async function RubricsPage() {
  const token = (await cookies()).get("mary_session")?.value;
  const session = token ? await readSession(token) : null;
  if (!session) redirect("/");

  const user = await db.user.findUnique({
    where: { id: session.id },
    select: { id: true, role: true, suspended: true, forcePasswordChange: true }
  });

  if (!user || user.suspended) redirect("/");
  if (user.forcePasswordChange) redirect("/change-password");
  if (!canInScope(user.role, "rubrics", "view", "school")) {
    redirect("/dashboard");
  }

  const canManage = canInScope(user.role, "rubrics", "create", "school");

  return (
    <PortalFrame active="Assessments">
      <section className="mx-auto max-w-7xl p-4 pb-28 sm:p-6 md:p-8">
        <RubricsClient canManage={canManage} />
      </section>
    </PortalFrame>
  );
}
