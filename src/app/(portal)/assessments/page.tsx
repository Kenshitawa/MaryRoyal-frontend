import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { canInScope } from "@/lib/permissions";
import { readSession } from "@/lib/session";
import AssessmentWorkspace from "./workspace";

export default async function AssessmentsPage() {
  const token = (await cookies()).get("mary_session")?.value;
  const session = token ? await readSession(token) : null;
  if (!session) redirect("/");

  const user = await db.user.findUnique({
    where: { id: session.id },
    select: { id: true, role: true, suspended: true, forcePasswordChange: true },
  });

  if (!user || user.suspended) redirect("/");
  if (user.forcePasswordChange) redirect("/change-password");

  const schoolView = canInScope(user.role, "assessments", "view", "school");
  const assignedView = canInScope(user.role, "assessments", "view", "assigned");
  if (!schoolView && !assignedView) redirect("/dashboard");

  const assignments = assignedView
    ? await db.teacherAssignment.findMany({
        where: { teacherId: user.id },
        select: { subject: true },
      })
    : [];

  const subjects = assignedView
    ? [...new Set(assignments.map((a) => a.subject))]
    : ["English", "Mathematics", "Science"];

  return (
    <>
      <section className="mx-auto max-w-7xl p-4 pb-28 sm:p-6 md:p-8">
        <AssessmentWorkspace
          subjects={subjects}
          canCreate={
            canInScope(user.role, "assessments", "create", "school") ||
            canInScope(user.role, "assessments", "create", "assigned")
          }
          canSubmit={assignedView}
          canReview={user.role === "HEAD_TEACHER"}
          canRelease={user.role === "DIRECTOR"}
        />
      </section>
    </>
  );
}
