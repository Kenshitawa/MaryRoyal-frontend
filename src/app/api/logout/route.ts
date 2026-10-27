import { NextResponse } from "next/server";
export async function POST(request: Request) {
  const response = NextResponse.redirect(new URL("/", request.url));
  const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0, sameSite: "lax" as const };
  response.cookies.set("mary_session", "", cookieOptions);
  response.cookies.set("mary_activity", "", cookieOptions);
  return response;
}
