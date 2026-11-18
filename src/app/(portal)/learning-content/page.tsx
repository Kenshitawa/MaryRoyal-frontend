import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { readSession } from "@/lib/session";
import LearningContentClient from "./learning-content-client";
import { loadCurriculumCatalog } from "@/lib/curriculum-catalog";
import { canInScope } from "@/lib/permissions";

export default async function LearningContentPage() {
  const token = (await cookies()).get("mary_session")?.value;
  const session = token ? await readSession(token) : null;
  if (!session) redirect("/");
  const user = await db.user.findUnique({ where: { id: session.id }, select: { id: true, role: true, suspended: true, forcePasswordChange: true } });
  if (!user || user.suspended) redirect("/");
  if (user.forcePasswordChange) redirect("/change-password");
  const videoScope = user.role === "LEARNER" ? "self" : user.role === "PARENT" ? "linked" : user.role === "TEACHER" ? "assigned" : "school";
  if (!canInScope(user.role, "learningVideos", "view", videoScope)) redirect("/dashboard");
  const canManageVideos = canInScope(user.role, "learningVideos", "create", user.role === "TEACHER" ? "assigned" : "school");
  const canManageResources = canInScope(user.role, "learning", "create", user.role === "TEACHER" ? "assigned" : "school");
  const [assignments, catalog] = await Promise.all([
    user.role === "TEACHER"
      ? db.teacherAssignment.findMany({ where: { teacherId: user.id }, select: { grade: true, subject: true }, orderBy: [{ grade: "asc" }, { subject: "asc" }] })
      : Promise.resolve([]),
    user.role === "TEACHER" ? Promise.resolve(undefined) : loadCurriculumCatalog(),
  ]);
  return <><LearningContentClient assignments={assignments} catalog={catalog} canManageVideos={canManageVideos} canManageResources={canManageResources}/></>;
}
