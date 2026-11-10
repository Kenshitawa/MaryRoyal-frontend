import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { makeActivitySession, makeSession } from "@/lib/session";
import { getTenantConfig } from "@/lib/tenant";

const DETACHED_HASH = "$2b$12$joG/OZPiW1YdGzMRBDHxMuFoihGNphKdzoabNjGK6TRR83dd0NhWa";

const schema = z
  .object({
    email: z.string().trim().max(254).optional(),
    identifier: z.string().trim().max(254).optional(),
    password: z.string().min(1).max(200),
  })
  .strict()
  .refine((value) => Boolean(value.identifier || value.email), "An email, username or phone number is required.");

function phoneVariants(value: string): string[] {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 9) return [];
  const local = digits.startsWith("254") ? `0${digits.slice(3)}` : digits.startsWith("0") ? digits : `0${digits.slice(-9)}`;
  const international = `+254${local.slice(1)}`;
  return [...new Set([digits, local, international, `254${local.slice(1)}`, local.slice(1)])];
}

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const now = Date.now();
  const bucket =
    (globalThis as typeof globalThis & { loginBuckets?: Map<string, { count: number; start: number }> }).loginBuckets ??
    new Map();
  (globalThis as typeof globalThis & { loginBuckets?: Map<string, { count: number; start: number }> }).loginBuckets = bucket;

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
    return NextResponse.json({ error: "Enter a valid email, username or phone number and password." }, { status: 400 });
  }

  const reqHeaders = await headers();
  const schoolSlug = reqHeaders.get("x-school-slug");
  if (!schoolSlug) {
    return NextResponse.json({ error: "School portal not found." }, { status: 404 });
  }

  const school = await getTenantConfig(schoolSlug);
  if (!school) {
    return NextResponse.json({ error: "School portal not found." }, { status: 404 });
  }
  if (school.status === "SUSPENDED") {
    return NextResponse.json(
      { error: "This school portal has been suspended. Please contact platform administration." },
      { status: 403 },
    );
  }

  const identifier = (parsed.data.identifier ?? parsed.data.email ?? "").trim().toLowerCase();
  const isEmail = identifier.includes("@");
  const phones = phoneVariants(identifier);

  const user = await db.user.findFirst({
    where: {
      schoolId: school.id,
      OR: [
        ...(isEmail ? [{ email: identifier }] : []),
        ...(phones.length ? [{ phone: { in: phones } }] : []),
        { username: identifier },
        { staffNumber: identifier },
      ],
    },
  });

  const passwordOk = user
    ? await bcrypt.compare(parsed.data.password, user.passwordHash)
    : (await bcrypt.compare(parsed.data.password, DETACHED_HASH), false);

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
        { status: 401 },
      );
    }
    return NextResponse.json(
      { error: "Wrong password or account. Please check your details and try again." },
      { status: 401 },
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
    schoolSlug: school.slug,
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

  return response;
}
