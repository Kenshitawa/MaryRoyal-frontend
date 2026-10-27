import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { makeActivitySession, makeSession, readSession } from "@/lib/session";
const schema = z.object({ password: z.string().min(12).max(200), currentPassword: z.string().min(1).max(200).optional() });
export async function POST(request: Request) {
 const token = (await cookies()).get("mary_session")?.value; const session = token ? await readSession(token) : null; if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
 let body: unknown; try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }
 const parsed = schema.safeParse(body); if (!parsed.success) return NextResponse.json({ error: "Use at least 12 characters." }, { status: 400 });
 const existing = await db.user.findUnique({ where: { id: session.id } });
 if (!existing) return NextResponse.json({ error: "Account not found." }, { status: 401 });
 if (!existing.forcePasswordChange && (!parsed.data.currentPassword || !(await bcrypt.compare(parsed.data.currentPassword, existing.passwordHash)))) return NextResponse.json({ error: "Your current password is incorrect." }, { status: 400 });
 const user = await db.user.update({ where: { id: session.id }, data: { passwordHash: await bcrypt.hash(parsed.data.password, 12), forcePasswordChange: false } });
 await db.auditEvent.create({ data: { actorId: session.id, action: "PASSWORD_CHANGED", entity: "User", entityId: session.id } });
 const response = NextResponse.json({ ok: true });
 response.cookies.set("mary_session", await makeSession(user), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 8 });
 response.cookies.set("mary_activity", await makeActivitySession(user.id), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 600 });
 return response;
}
