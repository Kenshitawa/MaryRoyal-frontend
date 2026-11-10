import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { canInScope } from "@/lib/permissions";
import { readSession } from "@/lib/session";

async function actor() {
  const token = (await cookies()).get("mary_session")?.value;
  const session = token ? await readSession(token) : null;
  if (!session) return null;
  const user = await db.user.findUnique({
    where: { id: session.id },
    select: { id: true, name: true, role: true, schoolId: true, suspended: true, forcePasswordChange: true },
  });
  return user && !user.suspended && !user.forcePasswordChange ? user : null;
}

export async function GET() {
  const user = await actor();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  if (!canInScope(user.role, "admissions", "view", "school")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const setting = await db.schoolSetting.findUnique({
    where: { schoolId_key: { schoolId: user.schoolId, key: "draft_retention_days" } },
  });

  const days = setting ? parseInt(setting.value, 10) || 0 : 0;

  return NextResponse.json({
    draftRetentionDays: days,
    isEnabled: days > 0,
    notice:
      days > 0
        ? `Notice: Automatic cleanup is configured. Inactive drafts untouched for more than ${days} days will be permanently purged.`
        : null,
  });
}

const patchSchema = z.object({
  draftRetentionDays: z.coerce.number().int().min(0).max(365),
});

export async function PATCH(request: Request) {
  const user = await actor();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  // Only Director and Head Teacher can change school retention policy
  if (user.role !== "DIRECTOR" && user.role !== "HEAD_TEACHER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid retention days (0-365)." }, { status: 400 });
  }

  const days = parsed.data.draftRetentionDays;

  await db.schoolSetting.upsert({
    where: { schoolId_key: { schoolId: user.schoolId, key: "draft_retention_days" } },
    create: {
      schoolId: user.schoolId,
      key: "draft_retention_days",
      value: String(days),
    },
    update: {
      value: String(days),
    },
  });

  await db.auditEvent.create({
    data: {
      actorId: user.id,
      action: "ADMISSION_RETENTION_UPDATED",
      entity: "SchoolSetting",
      entityId: `draft_retention_days=${days}`,
    },
  });

  return NextResponse.json({
    success: true,
    draftRetentionDays: days,
    isEnabled: days > 0,
    message: days > 0 ? `Retention policy set to ${days} days.` : "Automatic cleanup disabled.",
  });
}
