import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { canInScope } from "@/lib/permissions";
import { readSession } from "@/lib/session";
import LearningClient from "./learning-client";
import VideoLibrary from "../learning-videos/video-library";

export default async function LearningPage() {
  const token = (await cookies()).get("mary_session")?.value;
  const session = token ? await readSession(token) : null;
  if (!session) redirect("/");
  const user = await db.user.findUnique({ where: { id: session.id }, select: { id: true, name: true, role: true, suspended: true, forcePasswordChange: true } });
  if (!user || user.suspended) redirect("/");
  if (user.forcePasswordChange) redirect("/change-password");
  if (!canInScope(user.role, "learning", "view", "self")) redirect("/dashboard");
  const link = await db.guardianLink.findFirst({ where: { userId: user.id, relation: "Learner", learner: { archivedAt: null, admissionStatus: "APPROVED" } }, include: { learner: { select: { id: true, name: true, admissionNo: true, grade: true } } } });
  if (!link) return <><section className="mx-auto max-w-xl p-5 pb-28 md:py-12"><section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h1 className="text-2xl font-extrabold">Your learning account is ready</h1><p className="mt-3 text-slate-600">Learning activities will appear here after your approved admission is connected to this account. Please contact the school office if you need help.</p></section></section></>;
  const learner = link.learner;
  const [assessments, submissions, attempts, attendance] = await Promise.all([
    db.assessment.findMany({ where: { learnerId: learner.id, status: "RELEASED" }, select: { subject: true, score: true, term: true, strand: true, competency: true, comment: true }, orderBy: [{ term: "desc" }, { subject: "asc" }], take: 100 }),
    db.assignmentSubmission.findMany({ where: { learnerId: learner.id, status: "MARKED" }, select: { score: true, assignment: { select: { title: true, subject: true, maxScore: true, createdAt: true } } }, orderBy: { updatedAt: "desc" }, take: 100 }),
    db.learningGameAttempt.findMany({ where: { learnerId: learner.id }, select: { id: true, gameKey: true, score: true, maxScore: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 20 }),
    db.attendance.findMany({ where: { learnerId: learner.id }, select: { status: true }, orderBy: { date: "desc" }, take: 30 })
  ]);
  return <><div className="space-y-6"><LearningClient learner={learner} assessments={assessments} submissions={submissions} attempts={attempts} attendance={attendance}/><section className="mx-auto max-w-6xl px-4 pb-28 sm:px-6"><VideoLibrary/></section></div></>;
}
