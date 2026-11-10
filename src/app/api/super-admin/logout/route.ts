import { NextResponse } from "next/server";
import { getPlatformActor, PLATFORM_SESSION_COOKIE } from "@/lib/platform-auth";
import { recordPlatformAudit } from "@/lib/platform-audit";
import { clientIpFromRequest } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const actor = await getPlatformActor();
  if (actor) {
    await recordPlatformAudit({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "PLATFORM_LOGOUT",
      entity: "SuperAdmin",
      entityId: actor.id,
      ipAddress: clientIpFromRequest(request),
    });
  }

  const response = NextResponse.json(
    { ok: true },
    { headers: { "cache-control": "no-store" } },
  );
  response.cookies.set(PLATFORM_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
