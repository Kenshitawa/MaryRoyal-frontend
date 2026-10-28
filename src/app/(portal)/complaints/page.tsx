import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { readSession } from "@/lib/session";
import { canInScope } from "@/lib/permissions";
import ComplaintsClient from "./complaints-client";

export default async function ComplaintsPage() {
  const token = (await cookies()).get("mary_session")?.value;
  const session = token ? await readSession(token) : null;
  if (!session) redirect("/");
  const user = await db.user.findUnique({ where: { id: session.id }, select: { id: true, name: true, role: true, suspended: true, forcePasswordChange: true } });
  if (!user || user.suspended) redirect("/");
  if (user.forcePasswordChange) redirect("/change-password");
  const scope = user.role === "PARENT" ? "self" : user.role === "SECRETARY" ? "self" : "school";
  if (!canInScope(user.role, "complaints", "view", scope)) redirect("/dashboard");
  const linked = user.role === "PARENT" ? await db.guardianLink.findMany({ where: { userId: user.id, learner: { archivedAt: null, admissionStatus: "APPROVED" } }, include: { learner: { select: { id: true, name: true, grade: true } } }, orderBy: { learner: { name: "asc" } } }) : [];
  const linkedLearners = linked.map(link => link.learner);
  const learners = linkedLearners;
  return <><ComplaintsClient role={user.role} userId={user.id} userName={user.name} learners={learners}/></>;
}
