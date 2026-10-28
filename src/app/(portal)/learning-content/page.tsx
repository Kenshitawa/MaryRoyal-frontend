import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { readSession } from "@/lib/session";
import LearningContentClient from "./learning-content-client";

export default async function LearningContentPage() {
  const token = (await cookies()).get("mary_session")?.value;
  const session = token ? await readSession(token) : null;
  if (!session) redirect("/");
  const user = await db.user.findUnique({ where: { id: session.id }, select: { id: true, role: true, suspended: true, forcePasswordChange: true } });
  if (!user || user.suspended) redirect("/");
  if (user.forcePasswordChange) redirect("/change-password");
  if (user.role !== "TEACHER") redirect("/dashboard");
  const assignments = await db.teacherAssignment.findMany({ where: { teacherId: user.id }, select: { grade: true, subject: true }, orderBy: [{ grade: "asc" }, { subject: "asc" }] });
  return <><LearningContentClient assignments={assignments}/></>;
}
