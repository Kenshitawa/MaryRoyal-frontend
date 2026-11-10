import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { canInScope } from "@/lib/permissions";
import { readSession } from "@/lib/session";

async function actor() {
  const token = (await cookies()).get("school_session")?.value;
  const session = token ? await readSession(token) : null;
  if (!session) return null;
  const user = await db.user.findUnique({
    where: { id: session.id },
    select: { id: true, name: true, role: true, suspended: true, forcePasswordChange: true },
  });
  return user && !user.suspended && !user.forcePasswordChange ? user : null;
}

export async function GET() {
  const user = await actor();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  if (!canInScope(user.role, "staff", "create", "school")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const draft = await db.staffDraft.findFirst({
    where: { createdById: user.id },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({ draft });
}

export async function POST(request: Request) {
  const user = await actor();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  if (!canInScope(user.role, "staff", "create", "school")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const currentStep = Number(body.currentStep) || 1;
  const payload = typeof body.payload === "string" ? body.payload : JSON.stringify(body.payload || {});

  const draft = await db.staffDraft.upsert({
    where: { id: body.id || "non-existent" },
    create: {
      createdById: user.id,
      currentStep,
      payload,
    },
    update: {
      currentStep,
      payload,
    },
  });

  return NextResponse.json({ success: true, draft });
}

export async function DELETE() {
  const user = await actor();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  await db.staffDraft.deleteMany({
    where: { createdById: user.id },
  });

  return NextResponse.json({ success: true });
}
