import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { readSession } from "@/lib/session";
import { can } from "@/lib/permissions";
import SchemesClient from "./schemes-client";

export const metadata = { title: "Schemes of Work — Mary Royal School" };

export default async function SchemesPage() {
  const token = (await cookies()).get("mary_session")?.value;
  const session = token ? await readSession(token) : null;
  if (!session) redirect("/");
  const user = await db.user.findUnique({ where: { id: session.id }, select: { id: true, role: true, name: true, suspended: true, forcePasswordChange: true } });
  if (!user || user.suspended) redirect("/");
  if (user.forcePasswordChange) redirect("/change-password");
  if (!can(user.role as never, "schemesOfWork", "view")) redirect("/dashboard");

  // Get teaching assignments for teachers
  const teaching = user.role === "TEACHER" ? await db.teacherAssignment.findMany({ where: { teacherId: user.id }, select: { grade: true, subject: true } }) : [];

  return (
    <>
      <SchemesClient role={user.role} userId={user.id} teaching={teaching} />
    </>
  );
}
