import { NextResponse, type NextRequest } from "next/server";
import { makeActivitySession, readActivitySession, readSession, readSuperAdminSession } from "@/lib/session";
import { resolveHostTenant } from "@/lib/tenant";

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const host = request.headers.get("host");

  // Skip static files, images, favicon
  if (
    path.startsWith("/_next") ||
    path === "/favicon.ico" ||
    path === "/sw.js" ||
    path === "/offline.html" ||
    path === "/manifest.webmanifest" ||
    /\.(png|jpg|jpeg|gif|svg|ico|webp|woff2?|css|js)$/i.test(path)
  ) {
    return NextResponse.next();
  }

  const { isSuperAdmin: isSuperHost, slug: hostSlug } = resolveHostTenant(host);

  // Check if previewing specific school via searchParams or cookie in dev
  const querySlug = request.nextUrl.searchParams.get("school");
  const cookieSlug = request.cookies.get("current_school_slug")?.value;
  const activeSlug = querySlug || cookieSlug || hostSlug || "maryroyal";

  // 1. SUPER ADMIN PLATFORM ROUTES
  const isSuperAdminRoute = path.startsWith("/super-admin") || path.startsWith("/api/super-admin");
  if (isSuperHost || isSuperAdminRoute) {
    // If accessing root on superadmin host, rewrite to /super-admin
    if (isSuperHost && path === "/") {
      return NextResponse.redirect(new URL("/super-admin", request.url));
    }

    // Public super admin auth routes
    if (path === "/super-admin/login" || path.startsWith("/api/super-admin/login")) {
      return NextResponse.next();
    }

    const superToken = request.cookies.get("platform_session")?.value;
    const superSession = superToken ? await readSuperAdminSession(superToken) : null;

    if (!superSession) {
      if (path.startsWith("/api/")) {
        return NextResponse.json({ error: "Unauthorized platform access" }, { status: 401 });
      }
      return NextResponse.redirect(new URL("/super-admin/login", request.url));
    }

    const response = NextResponse.next();
    response.headers.set("x-is-super-admin", "true");
    return response;
  }

  // 2. SCHOOL TENANT ROUTES
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-school-slug", activeSlug);

  // Public school routes
  if (
    path.startsWith("/api/login") ||
    path.startsWith("/api/logout") ||
    path === "/" ||
    path.startsWith("/privacy") ||
    path.startsWith("/receipts")
  ) {
    const res = NextResponse.next({ request: { headers: requestHeaders } });
    if (querySlug) {
      res.cookies.set("current_school_slug", querySlug, { path: "/", sameSite: "lax" });
    }
    return res;
  }

  // Authenticated school routes
  const token = request.cookies.get("school_session")?.value ?? request.cookies.get("mary_session")?.value;
  const session = token ? await readSession(token) : null;

  if (!session) {
    return path.startsWith("/api/")
      ? NextResponse.json({ error: "Unauthenticated" }, { status: 401 })
      : NextResponse.redirect(new URL("/", request.url));
  }

  // Enforce 10-minute idle session
  const activity = request.cookies.get("school_activity")?.value ?? request.cookies.get("mary_activity")?.value;
  if (!activity || !(await readActivitySession(activity, session.id))) {
    const response = path.startsWith("/api/")
      ? NextResponse.json({ error: "Session expired after 10 minutes of inactivity." }, { status: 401 })
      : NextResponse.redirect(new URL("/?reason=idle", request.url));

    response.cookies.set("school_session", "", { httpOnly: true, path: "/", maxAge: 0, sameSite: "lax" });
    response.cookies.set("school_activity", "", { httpOnly: true, path: "/", maxAge: 0, sameSite: "lax" });
    response.cookies.set("mary_session", "", { httpOnly: true, path: "/", maxAge: 0, sameSite: "lax" });
    response.cookies.set("mary_activity", "", { httpOnly: true, path: "/", maxAge: 0, sameSite: "lax" });
    return response;
  }

  // Force password change on first login
  if (session.forcePasswordChange && path !== "/change-password" && !path.startsWith("/api/change-password")) {
    return path.startsWith("/api/")
      ? NextResponse.json({ error: "Password change required" }, { status: 403 })
      : NextResponse.redirect(new URL("/change-password", request.url));
  }

  requestHeaders.set("x-school-id", session.schoolId);
  requestHeaders.set("x-user-id", session.id);
  requestHeaders.set("x-user-role", session.role);

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  // Renew 10-minute activity cookie
  const newActivityToken = await makeActivitySession(session.id);
  response.cookies.set("school_activity", newActivityToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  return response;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"] };
