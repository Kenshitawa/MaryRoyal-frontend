import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { makeActivitySession, makeSession } from "@/lib/session";
import { getTenantConfig, resolveHostTenant } from "@/lib/tenant";

const schema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(200),
});

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const now = Date.now();
  const bucket =
    (globalThis as typeof globalThis & { loginBuckets?: Map<string, { count: number; start: number }> }).loginBuckets ??
    new Map();
  (globalThis as typeof globalThis & { loginBuckets?: Map<string, { count: number; start: number }> }).loginBuckets =
    bucket;

  const state = bucket.get(ip);
  if (state && now - state.start < 60_000 && state.count >= 12) {
    return NextResponse.json({ error: "Too many failed attempts. Please wait one minute then try again." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email and password." }, { status: 400 });
  }

  // Resolve tenant school
  const host = request.headers.get("host");
  const { slug } = resolveHostTenant(host);
  const schoolSlug = request.headers.get("x-school-slug") || slug || "maryroyal";
  const school = await getTenantConfig(schoolSlug);

  if (!school) {
    return NextResponse.json({ error: "School portal not found." }, { status: 404 });
  }

  if (school.status === "SUSPENDED") {
    return NextResponse.json(
      { error: "This school portal has been suspended. Please contact platform administration." },
      { status: 403 }
    );
  }

  const user = await db.user.findUnique({
    where: {
      schoolId_email: {
        schoolId: school.id,
        email: parsed.data.email.toLowerCase(),
      },
    },
  });

  const passwordOk = user ? await bcrypt.compare(parsed.data.password, user.passwordHash) : false;

  if (!user || user.suspended || user.failedLogins >= 8 || !passwordOk) {
    bucket.set(ip, { count: (state?.count ?? 0) + 1, start: state?.start ?? now });
    if (user) {
      await db.user.update({ where: { id: user.id }, data: { failedLogins: { increment: 1 } } });
    }
    await db.auditEvent.create({
      data: {
        schoolId: school.id,
        actorId: user?.id,
        action: "LOGIN_FAILED",
        entity: "User",
        entityId: user?.id,
      },
    });

    if (user && (user.suspended || user.failedLogins >= 8)) {
      return NextResponse.json(
        { error: "This account has been locked. Please contact the school administrator." },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { error: "Wrong password or email address. Please check your details and try again." },
      { status: 401 }
    );
  }

  await db.user.update({ where: { id: user.id }, data: { failedLogins: 0 } });
  await db.auditEvent.create({
    data: {
      schoolId: school.id,
      actorId: user.id,
      action: "LOGIN_SUCCEEDED",
      entity: "User",
      entityId: user.id,
    },
  });

  const response = NextResponse.json({ ok: true, forcePasswordChange: user.forcePasswordChange });
  const isProduction = process.env.NODE_ENV === "production";

  const sessionToken = await makeSession({
    id: user.id,
    schoolId: school.id,
    role: user.role,
    forcePasswordChange: user.forcePasswordChange,
  });
  const activityToken = await makeActivitySession(user.id);

  response.cookies.set("school_session", sessionToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  response.cookies.set("school_activity", activityToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  // Keep mary_session cookie aligned for backwards compatibility
  response.cookies.set("mary_session", sessionToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  response.cookies.set("mary_activity", activityToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  return response;
}
