import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import AdmissionWizard from "../admission-wizard";
import { db } from "@/lib/db";
import { canInScope } from "@/lib/permissions";
import { readSession } from "@/lib/session";
export default async function NewAdmissionPage() { const token = (await cookies()).get("mary_session")?.value; const session = token ? await readSession(token) : null; if (!session) redirect("/"); const user = await db.user.findUnique({ where: { id: session.id }, select: { role: true, suspended: true, forcePasswordChange: true } }); if (!user || user.suspended) redirect("/"); if (user.forcePasswordChange) redirect("/change-password"); if (!canInScope(user.role, "admissions", "create", "school")) redirect("/admissions"); return <><AdmissionWizard canCreateAdmission canCreateLearnerLogin/></>; }
