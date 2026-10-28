import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { readSession } from "@/lib/session";
import { canInScope } from "@/lib/permissions";
import LearnerDirectory from "./directory";

export default async function LearnersPage() {
  const token = (await cookies()).get("mary_session")?.value;
  const session = token ? await readSession(token) : null;
  if (!session) redirect("/");

  const user = await db.user.findUnique({
    where: { id: session.id },
    select: { id: true, role: true, suspended: true, forcePasswordChange: true },
  });

  if (!user || user.suspended) redirect("/");
  if (user.forcePasswordChange) redirect("/change-password");

  const identityOnly = canInScope(user.role, "learners", "view", "learner-identity");
  const allowed =
    canInScope(user.role, "learners", "view", "school") ||
    canInScope(user.role, "learners", "view", "assigned") ||
    identityOnly;

  if (!allowed) redirect("/dashboard");

  return (
    <>
      <section className="mx-auto max-w-7xl p-4 pb-28 sm:p-6 md:p-8">
        <LearnerDirectory
          identityOnly={identityOnly}
          canCreate={canInScope(user.role, "admissions", "create", "school")}
          canApprove={user.role === "HEAD_TEACHER"}
        />
      </section>
    </>
  );
}
