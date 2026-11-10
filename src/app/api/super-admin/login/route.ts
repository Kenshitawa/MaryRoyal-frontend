import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { recordPlatformAudit } from "@/lib/platform-audit";
import {
  PLATFORM_SESSION_COOKIE,
  PLATFORM_SESSION_MAX_AGE_SECONDS,
} from "@/lib/platform-auth";
import { checkRateLimit, clientIpFromRequest } from "@/lib/rate-limit";
import { makeSuperAdminSession } from "@/lib/session";

const DETACHED_HASH = "$2b$12$joG/OZPiW1YdGzMRBDHxMuFoihGNphKdzoabNjGK6TRR83dd0NhWa";
const MAX_FAILED_LOGINS = 8;

const loginSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(254),
    password: z.string().min(1).max(200),
  })
  .strict();

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "cache-control": "no-store", pragma: "no-cache" },
  });
}

export async function POST(request: Request) {
  const ip = clientIpFromRequest(request);
  const ipLimit = checkRateLimit(`platform-login:ip:${ip}`, 12, 60_000);
  if (!ipLimit.allowed) {
    return json(
      { error: "Too many sign-in attempts. Wait a minute and try again." },
      429,
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request." }, 400);
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return json({ error: "Enter a valid email address and password." }, 400);
  }

  const emailLimit = checkRateLimit(`platform-login:email:${parsed.data.email}`, 8, 15 * 60_000);
  if (!emailLimit.allowed) {
    return json({ error: "Too many sign-in attempts for this account. Wait 15 minutes." }, 429);
  }

  const admin = await db.superAdmin.findUnique({ where: { email: parsed.data.email } });
  const passwordOk = admin
    ? await bcrypt.compare(parsed.data.password, admin.passwordHash)
    : (await bcrypt.compare(parsed.data.password, DETACHED_HASH), false);

  if (!admin || admin.suspended || admin.failedLogins >= MAX_FAILED_LOGINS || !passwordOk) {
    if (admin) {
      await db.superAdmin.update({
        where: { id: admin.id },
        data: { failedLogins: { increment: 1 } },
      });
    }
    await recordPlatformAudit({
      actorId: admin?.id ?? null,
      actorEmail: admin?.email ?? parsed.data.email,
      action: "PLATFORM_LOGIN_FAILED",
      entity: "SuperAdmin",
      entityId: admin?.id ?? null,
      ipAddress: ip,
    });

    if (admin && (admin.suspended || admin.failedLogins >= MAX_FAILED_LOGINS)) {
      return json({ error: "This platform account is locked. Contact platform support." }, 401);
    }
    return json({ error: "Wrong email or password." }, 401);
  }

  await db.superAdmin.update({ where: { id: admin.id }, data: { failedLogins: 0 } });
  await recordPlatformAudit({
    actorId: admin.id,
    actorEmail: admin.email,
    action: "PLATFORM_LOGIN_SUCCEEDED",
    entity: "SuperAdmin",
    entityId: admin.id,
    ipAddress: ip,
  });

  const token = await makeSuperAdminSession({ id: admin.id, email: admin.email });
  const response = json({ ok: true });
  response.cookies.set(PLATFORM_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: PLATFORM_SESSION_MAX_AGE_SECONDS,
  });
  return response;
}
