import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { canInScope } from "@/lib/permissions";
import { readSession } from "@/lib/session";

async function actor() {
  const token = (await cookies()).get("school_session")?.value;
  const session = token ? await readSession(token) : null;
  if (!session) return null;
  const user = await db.user.findUnique({ where: { id: session.id }, select: { id: true, role: true, suspended: true, forcePasswordChange: true } });
  return user && !user.suspended && !user.forcePasswordChange ? user : null;
}

const daySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const recordsSchema = z.object({ date: daySchema, records: z.array(z.object({ staffId: z.string().cuid(), status: z.enum(["PRESENT", "ABSENT", "LATE"]), checkInAt: z.string().datetime().optional(), note: z.string().trim().max(240).optional() })).min(1).max(100) }).superRefine((body, ctx) => {
  if (new Set(body.records.map(item => item.staffId)).size !== body.records.length) ctx.addIssue({ code: "custom", path: ["records"], message: "Each staff member may appear once per date." });
});

function day(date: string) { return new Date(`${date}T00:00:00.000Z`); }

export async function GET(request: Request) {
  const user = await actor();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const targetId = params.get("staffId") ?? (canInScope(user.role, "staffAttendance", "view", "self") ? user.id : null);
  const dateInput = params.get("date");
  const validDate = dateInput ? daySchema.safeParse(dateInput) : null;
  if (validDate && !validDate.success) return NextResponse.json({ error: "Use a valid date in YYYY-MM-DD format." }, { status: 400 });
  const school = canInScope(user.role, "staffAttendance", "view", "school");
  const self = canInScope(user.role, "staffAttendance", "view", "self") && targetId === user.id;
  if (!school && !self) { await db.auditEvent.create({ data: { actorId: user.id, action: "ACCESS_DENIED", entity: "StaffAttendance", entityId: targetId } }); return NextResponse.json({ error: "Forbidden" }, { status: 403 }); }
  if (targetId && !self && !school) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const records = await db.staffAttendance.findMany({ where: { ...(school && !params.get("staffId") ? {} : { staffId: targetId! }), ...(validDate?.success ? { date: day(validDate.data) } : {}) }, include: { staff: { select: { id: true, name: true, role: true, staffNumber: true } }, recordedBy: { select: { name: true } } }, orderBy: [{ date: "desc" }, { staff: { name: "asc" } }], take: 500 });
  await db.auditEvent.create({ data: { actorId: user.id, action: "STAFF_ATTENDANCE_VIEWED", entity: "StaffAttendance", entityId: targetId } });
  return NextResponse.json({ records });
}

export async function POST(request: Request) {
  const user = await actor();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!canInScope(user.role, "staffAttendance", "create", "school")) { await db.auditEvent.create({ data: { actorId: user.id, action: "ACCESS_DENIED", entity: "StaffAttendance" } }); return NextResponse.json({ error: "Forbidden" }, { status: 403 }); }
  let body: unknown; try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const parsed = recordsSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Check the date and each staff member's attendance status." }, { status: 400 });
  const rows = await db.user.findMany({ where: { id: { in: parsed.data.records.map(row => row.staffId) }, role: { in: ["DIRECTOR", "HEAD_TEACHER", "DEPUTY", "SECRETARY", "ACCOUNTANT", "TEACHER"] }, suspended: false }, select: { id: true } });
  if (rows.length !== parsed.data.records.length) return NextResponse.json({ error: "One or more active staff accounts were not found." }, { status: 404 });
  const date = day(parsed.data.date);
  const saved = await db.$transaction(async tx => {
    const results = [];
    for (const record of parsed.data.records) {
      const row = await tx.staffAttendance.upsert({ where: { staffId_date: { staffId: record.staffId, date } }, create: { staffId: record.staffId, date, status: record.status, checkInAt: record.checkInAt ? new Date(record.checkInAt) : null, note: record.note || null, recordedById: user.id }, update: { status: record.status, checkInAt: record.checkInAt ? new Date(record.checkInAt) : null, note: record.note || null, recordedById: user.id } });
      await tx.auditEvent.create({ data: { actorId: user.id, action: "STAFF_ATTENDANCE_RECORDED", entity: "StaffAttendance", entityId: row.id } });
      results.push(row);
    }
    return results;
  });
  return NextResponse.json({ records: saved }, { status: 201 });
}
