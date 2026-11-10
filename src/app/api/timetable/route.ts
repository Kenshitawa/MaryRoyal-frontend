import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { readSession } from "@/lib/session";
import { can } from "@/lib/permissions";
import { createNotification } from "@/lib/notify";

async function actor() {
  const token = (await cookies()).get("school_session")?.value;
  const session = token ? await readSession(token) : null;
  if (!session) return null;
  const user = await db.user.findUnique({ where: { id: session.id }, select: { id: true, role: true, suspended: true, forcePasswordChange: true, name: true } });
  return user && !user.suspended && !user.forcePasswordChange ? user : null;
}

export async function GET() {
  const user = await actor();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!can(user.role as never, "timetable", "view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Return the published timetable (or draft for admins)
  const isAdmin = ["DIRECTOR", "HEAD_TEACHER", "DEPUTY"].includes(user.role);
  const timetables = await db.schoolTimetable.findMany({
    where: isAdmin ? {} : { status: "PUBLISHED" },
    include: {
      createdBy: { select: { id: true, name: true } },
      verifiedBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  return NextResponse.json({ timetables });
}

const createSchema = z.object({
  title: z.string().trim().min(3).max(80),
  term: z.string().trim().min(2).max(30),
  year: z.number().int().min(2020).max(2100).optional(),
  scheduleJson: z.string().min(2),
});

export async function POST(request: Request) {
  const user = await actor();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!can(user.role as never, "timetable", "create")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const { _action, ...rest } = body as { _action?: string } & Record<string, unknown>;

  if (_action === "create") {
    const parsed = createSchema.safeParse(rest);
    if (!parsed.success) return NextResponse.json({ error: "Provide title, term, and schedule." }, { status: 400 });
    const timetable = await db.schoolTimetable.create({ data: { ...parsed.data, year: parsed.data.year ?? new Date().getFullYear(), createdById: user.id, status: "DRAFT" } });
    return NextResponse.json({ timetable }, { status: 201 });
  }

  if (_action === "submit") {
    const { id } = rest as { id?: string };
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    const tt = await db.schoolTimetable.findUnique({ where: { id } });
    if (!tt || tt.createdById !== user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await db.schoolTimetable.update({ where: { id }, data: { status: "PENDING_APPROVAL" } });
    // Notify head teacher
    const heads = await db.user.findMany({ where: { role: "HEAD_TEACHER" }, select: { id: true } });
    for (const h of heads) {
      await createNotification({ userId: h.id, title: "Timetable Awaiting Verification", message: `"${tt.title}" for ${tt.term} has been submitted for your verification.`, type: "ACTION", link: "/timetable", actionRequired: true });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

const patchSchema = z.object({
  id: z.string().min(1),
  action: z.enum(["verify", "update"]),
  scheduleJson: z.string().optional(),
  title: z.string().trim().max(80).optional(),
  publishDirectly: z.boolean().optional(),
});

export async function PATCH(request: Request) {
  const user = await actor();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid data" }, { status: 400 });

  const tt = await db.schoolTimetable.findUnique({ where: { id: parsed.data.id }, include: { createdBy: { select: { id: true, name: true } } } });
  if (!tt) return NextResponse.json({ error: "Timetable not found" }, { status: 404 });

  if (parsed.data.action === "verify") {
    if (!["HEAD_TEACHER", "DIRECTOR"].includes(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    await db.schoolTimetable.update({ where: { id: tt.id }, data: { status: "PUBLISHED", verifiedById: user.id, verifiedAt: new Date() } });
    // Notify all teachers
    const teachers = await db.user.findMany({ where: { role: { in: ["TEACHER", "DEPUTY"] } }, select: { id: true } });
    for (const t of teachers) {
      await createNotification({ userId: t.id, title: "New Timetable Published", message: `"${tt.title}" for ${tt.term} is now published. Check your lessons schedule.`, type: "SUCCESS", link: "/timetable" });
    }
    await createNotification({ userId: tt.createdById, title: "Timetable Verified & Published", message: `Your timetable "${tt.title}" has been verified and published to all teachers.`, type: "SUCCESS", link: "/timetable" });
    return NextResponse.json({ ok: true });
  }

  if (parsed.data.action === "update") {
    if (!can(user.role as never, "timetable", "update")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const isLeadership = ["HEAD_TEACHER", "DIRECTOR"].includes(user.role);
    const publishDirectly = Boolean(parsed.data.publishDirectly && isLeadership);

    await db.schoolTimetable.update({
      where: { id: tt.id },
      data: {
        scheduleJson: parsed.data.scheduleJson ?? tt.scheduleJson,
        title: parsed.data.title ?? tt.title,
        status: publishDirectly ? "PUBLISHED" : "DRAFT",
        verifiedById: publishDirectly ? user.id : null,
        verifiedAt: publishDirectly ? new Date() : null,
      },
    });

    if (publishDirectly) {
      const teachers = await db.user.findMany({ where: { role: { in: ["TEACHER", "DEPUTY"] } }, select: { id: true } });
      for (const t of teachers) {
        await createNotification({ userId: t.id, title: "Timetable Updated", message: `Updates made to "${tt.title}" are now live. Please review your lesson schedule.`, type: "INFO", link: "/timetable" });
      }
    }

    return NextResponse.json({ ok: true, status: publishDirectly ? "PUBLISHED" : "DRAFT" });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
