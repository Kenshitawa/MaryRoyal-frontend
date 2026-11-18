import { NextResponse } from "next/server";

export async function POST(request: Request) {
  // Native forms need a 303 so the redirected GET does not resubmit the POST.
  // fetch() clients ask for JSON and handle the redirect themselves.
  const wantsJson = (request.headers.get("accept") ?? "").includes("application/json");
  const target = new URL("/", request.url);
  const response = wantsJson
    ? NextResponse.json({ ok: true, redirect: target.pathname })
    : NextResponse.redirect(target, 303);

  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
    sameSite: "lax" as const,
  };
  response.cookies.set("mary_session", "", cookieOptions);
  response.cookies.set("mary_activity", "", cookieOptions);
  return response;
}
