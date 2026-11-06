import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { readSession } from "@/lib/session";
import { canInScope } from "@/lib/permissions";
import { loadCurriculumCatalog } from "@/lib/curriculum-catalog";
import AssignmentsClient from "./assignments-client";

export default async function AssignmentsPage() {
  const token = (await cookies()).get("mary_session")?.value;
  const session = token ? await readSession(token) : null;
  if (!session) redirect("/");
  const user = await db.user.findUnique({ where: { id: session.id }, select: { id: true, role: true, suspended: true, forcePasswordChange: true } });
  if (!user || user.suspended) redirect("/");
  if (user.forcePasswordChange) redirect("/change-password");
  const scope = (user.role === "DIRECTOR" || user.role === "HEAD_TEACHER") ? "school" : user.role === "TEACHER" ? "assigned" : "self";
  if (!canInScope(user.role, "assignments", "view", scope)) redirect("/dashboard");
  const [teaching, catalog] = await Promise.all([
    user.role === "TEACHER"
      ? db.teacherAssignment.findMany({ where: { teacherId: user.id }, select: { grade: true, subject: true }, orderBy: [{ grade: "asc" }, { subject: "asc" }] })
      : Promise.resolve([]),
    user.role === "TEACHER" ? Promise.resolve(undefined) : loadCurriculumCatalog(),
  ]);
  return <><AssignmentsClient role={user.role} teaching={teaching} catalog={catalog}/></>;
}
