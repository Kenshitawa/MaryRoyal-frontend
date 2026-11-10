import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { readSession } from "@/lib/session";

export async function POST() {
  const token = (await cookies()).get("school_session")?.value;
  const session = token ? await readSession(token) : null;
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const user = await db.user.findUnique({ where: { id: session.id }, select: { suspended: true } });
  if (!user || user.suspended) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  return NextResponse.json({ ok: true });
}
