import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { makeActivitySession, makeSession } from "@/lib/session";
const schema = z.object({ email: z.string().trim().email().max(254), password: z.string().min(1).max(200) });
export async function POST(request: Request) {
 const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
 const now = Date.now(); const bucket = (globalThis as typeof globalThis & { loginBuckets?: Map<string, { count: number; start: number }> }).loginBuckets ?? new Map();
 (globalThis as typeof globalThis & { loginBuckets?: Map<string, { count: number; start: number }> }).loginBuckets = bucket;
 const state = bucket.get(ip); if (state && now - state.start < 60_000 && state.count >= 12) return NextResponse.json({ error: "Too many attempts. Try again in one minute." }, { status: 429 });
 let body: unknown; try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
 const parsed = schema.safeParse(body); if (!parsed.success) return NextResponse.json({ error: "Enter a valid email and password." }, { status: 400 });
 const user = await db.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
 if (!user || user.suspended || user.failedLogins >= 8 || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
  bucket.set(ip, { count: (state?.count ?? 0) + 1, start: state?.start ?? now });
  if (user) await db.user.update({ where: { id: user.id }, data: { failedLogins: { increment: 1 } } });
  await db.auditEvent.create({ data: { actorId: user?.id, action: "LOGIN_FAILED", entity: "User", entityId: user?.id } });
  return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 });
 }
 await db.user.update({ where: { id: user.id }, data: { failedLogins: 0 } });
 await db.auditEvent.create({ data: { actorId: user.id, action: "LOGIN_SUCCEEDED", entity: "User", entityId: user.id } });
 const response = NextResponse.json({ ok: true, forcePasswordChange: user.forcePasswordChange });
 response.cookies.set("mary_session", await makeSession(user), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 8 });
 response.cookies.set("mary_activity", await makeActivitySession(user.id), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 600 });
 return response;
}
