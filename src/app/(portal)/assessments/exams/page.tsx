import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { readSession } from "@/lib/session";
import { canInScope } from "@/lib/permissions";
import ExamSessionsClient from "./exam-sessions-client";

export default async function ExamSessionsPage() {
  const token = (await cookies()).get("mary_session")?.value;
  const session = token ? await readSession(token) : null;
  if (!session) redirect("/");

  const user = await db.user.findUnique({
    where: { id: session.id },
    select: { id: true, role: true, suspended: true, forcePasswordChange: true }
  });

  if (!user || user.suspended) redirect("/");
  if (user.forcePasswordChange) redirect("/change-password");
  if (!canInScope(user.role, "examSessions", "view", user.role === "TEACHER" ? "assigned" : "school")) {
    redirect("/dashboard");
  }

  const canManage = canInScope(user.role, "examSessions", "create", "school");
  const canApprove = canInScope(user.role, "examSessions", "approve", "school");

  return (
    <>
      <section className="mx-auto max-w-7xl p-4 pb-28 sm:p-6 md:p-8">
        <ExamSessionsClient canManage={canManage} canApprove={canApprove} />
      </section>
    </>
  );
}
