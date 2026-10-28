import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import PortalFrame from "@/components/portal-frame";
import { db } from "@/lib/db";
import { canInScope } from "@/lib/permissions";
import { readSession } from "@/lib/session";
import VideoLibrary from "./video-library";
export default async function LearningVideosPage() {
  const token = (await cookies()).get("mary_session")?.value;
  const session = token ? await readSession(token) : null;
  if (!session) redirect("/");
  const user = await db.user.findUnique({ where: { id: session.id }, select: { id: true, role: true, suspended: true, forcePasswordChange: true } });
  if (!user || user.suspended) redirect("/");
  if (user.forcePasswordChange) redirect("/change-password");
  if (!canInScope(user.role, "learningVideos", "view", user.role === "LEARNER" ? "self" : user.role === "TEACHER" ? "assigned" : "school")) redirect("/dashboard");
  const canManage = canInScope(user.role, "learningVideos", "create", user.role === "TEACHER" ? "assigned" : "school");
  return <PortalFrame active="KICD videos"><section className="mx-auto max-w-6xl space-y-5 p-4 pb-28 sm:p-6 md:p-8"><VideoLibrary canManage={canManage}/></section></PortalFrame>;
}
