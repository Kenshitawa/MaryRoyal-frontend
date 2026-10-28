import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import AdmissionWizard from "../admission-wizard";
import { db } from "@/lib/db";
import { canInScope } from "@/lib/permissions";
import { readSession } from "@/lib/session";
export default async function AdmissionDetailPage({ params }: { params: Promise<{ id: string }> }) { const token = (await cookies()).get("mary_session")?.value; const session = token ? await readSession(token) : null; if (!session) redirect("/"); const user = await db.user.findUnique({ where: { id: session.id }, select: { id: true, role: true, suspended: true, forcePasswordChange: true } }); if (!user || user.suspended) redirect("/"); if (user.forcePasswordChange) redirect("/change-password"); if (!canInScope(user.role, "admissions", "view", "school")) redirect("/dashboard"); const { id } = await params; const draft = await db.admissionDraft.findUnique({ where: { id }, select: { id: true, status: true, createdById: true } }); if (!draft) notFound(); if (user.role === "SECRETARY" && draft.createdById !== user.id) notFound(); if (user.role === "HEAD_TEACHER" && draft.status === "DRAFT") notFound(); return <><AdmissionWizard initialId={id} canCreateAdmission={canInScope(user.role, "admissions", "create", "school")} canCreateLearnerLogin={canInScope(user.role, "learnerAccounts", "create", "school")}/></>; }
