import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { assertCan, assertCanInScope, canInScope } from "@/lib/permissions";
import { readSession } from "@/lib/session";
import { cookies } from "next/headers";
async function currentRole() { const token = (await cookies()).get("mary_session")?.value; const session = token ? await readSession(token) : null; if (!session) return null; const user = await db.user.findUnique({ where: { id: session.id }, select: { id: true, role: true, suspended: true, forcePasswordChange: true } }); return user && !user.suspended && !user.forcePasswordChange ? user : null; }
export async function GET(request: Request) {
 const user = await currentRole(); if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
 try { assertCan(user.role, "learners", "view"); } catch { await db.auditEvent.create({ data: { actorId: user.id, action: "ACCESS_DENIED", entity: "Learner" } }); return NextResponse.json({ error: "Forbidden" }, { status: 403 }); }
 const { searchParams } = new URL(request.url); const parsed = z.object({ q: z.string().max(80).optional(), take: z.coerce.number().int().min(1).max(100).default(25), cursor: z.string().optional() }).safeParse(Object.fromEntries(searchParams)); if (!parsed.success) return NextResponse.json({ error: "Invalid filters." }, { status: 400 });
 const q = parsed.data.q?.trim(); let gradeScope: string[] | undefined; let linkedIds: string[] | undefined;
 if (canInScope(user.role, "learners", "view", "learner-identity")) {
  const learners = await db.learner.findMany({ where: { archivedAt: null, admissionStatus: "APPROVED", ...(q ? { OR: [{ name: { contains: q } }, { admissionNo: { contains: q } }, { grade: { contains: q } }] } : {}) }, select: { id: true, admissionNo: true, name: true, grade: true }, orderBy: { admissionNo: "asc" }, take: parsed.data.take + 1, ...(parsed.data.cursor ? { cursor: { id: parsed.data.cursor }, skip: 1 } : {}) });
  const hasMore = learners.length > parsed.data.take; const rows = learners.slice(0, parsed.data.take); return NextResponse.json({ learners: rows, nextCursor: hasMore ? rows.at(-1)?.id : null });
 }
 if (!canInScope(user.role, "learners", "view", "school")) {
  if (canInScope(user.role, "learners", "view", "assigned")) { const assignments=await db.teacherAssignment.findMany({where:{teacherId:user.id},select:{grade:true}}); gradeScope=[...new Set(assignments.map(a=>a.grade))]; }
  else if (canInScope(user.role, "learners", "view", "learner-identity")) { /* Reserved for a future explicitly scoped finance identity view. */ }
  else if (canInScope(user.role,"learners","view","linked")||canInScope(user.role,"learners","view","self")) { const links=await db.guardianLink.findMany({where:{userId:user.id},select:{learnerId:true}});linkedIds=links.map(link=>link.learnerId); }
  else return NextResponse.json({ error: "Forbidden" }, { status: 403 });
 }
 const where: Prisma.LearnerWhereInput = { archivedAt: null, ...(!canInScope(user.role, "learners", "view", "school") ? { admissionStatus: "APPROVED" } : {}), ...(gradeScope ? {grade:{in:gradeScope}} : {}), ...(linkedIds ? {id:{in:linkedIds}} : {}), ...(q ? { OR: [{ name: { contains: q } }, { admissionNo: { contains: q } }, { grade: { contains: q } }] } : {}) };
 const learners = await db.learner.findMany({ where, select: { id: true, admissionNo: true, name: true, grade: true, gender:true, admissionStatus:true, guardians: { where: { relation: "Learner" }, select: { id: true }, take: 1 } }, orderBy: { admissionNo: "asc" }, take: parsed.data.take + 1, ...(parsed.data.cursor ? { cursor: { id: parsed.data.cursor }, skip: 1 } : {}) });
 const hasMore = learners.length > parsed.data.take; const rows = learners.slice(0, parsed.data.take).map(({guardians,...learner})=>({...learner,hasLearnerLogin:guardians.length>0})); return NextResponse.json({ learners: rows, nextCursor: hasMore ? rows.at(-1)?.id : null });
}
export async function POST() {
 const user = await currentRole(); if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
 try { assertCanInScope(user.role, "admissions", "create", "school"); } catch { await db.auditEvent.create({ data: { actorId: user.id, action: "ACCESS_DENIED", entity: "Learner" } }); return NextResponse.json({ error: "Forbidden" }, { status: 403 }); }
 return NextResponse.json({ error: "Learners are created only from a complete admission record. Start or resume an admission at /admissions." }, { status: 410 });
}

