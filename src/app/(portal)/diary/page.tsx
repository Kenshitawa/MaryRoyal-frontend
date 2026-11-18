import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { readSession } from "@/lib/session";
import { canInScope } from "@/lib/permissions";
import DiaryClient from "./diary-client";

export const metadata = { title: "Family Diary — Mary Royal School" };

export default async function DiaryPage() {
  const token = (await cookies()).get("mary_session")?.value;
  const session = token ? await readSession(token) : null;
  if (!session) redirect("/");
  const user = await db.user.findUnique({ where: { id: session.id }, select: { id: true, role: true, suspended: true, forcePasswordChange: true } });
  if (!user || user.suspended) redirect("/");
  if (user.forcePasswordChange) redirect("/change-password");
  const scope = user.role === "PARENT" ? "linked" : user.role === "TEACHER" ? "assigned" : "school";
  if (!canInScope(user.role, "diary", "view", scope)) redirect("/dashboard");
  return <DiaryClient role={user.role} />;
}
