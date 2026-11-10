import { NextResponse, type NextRequest } from "next/server";
import { makeActivitySession, readActivitySession, readSession, readSuperAdminSession } from "@/lib/session";
import { resolveTenantHost } from "@/lib/tenant-host";

const SECURITY_HEADERS: Record<string, string> = {
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "X-DNS-Prefetch-Control": "off",
  // HSTS is added in production only (the check is below).
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // unsafe-eval needed by Next.js dev mode; tighten in prod
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; "),
};

function applySecurityHeaders(response: NextResponse): void {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }
  if (process.env.NODE_ENV === "production") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload",
    );
  }
}

const SPOOFABLE_HEADERS = ["x-school-slug", "x-school-id", "x-user-id", "x-user-role", "x-tenant-kind", "x-is-super-admin"];
const SCHOOL_PUBLIC_PATHS = [
  "/",
  "/privacy",
  "/api/login",
  "/api/logout",
  "/api/health",
  "/api/public/",
  "/receipts",
  "/tenant-status",
];
const PASSWORD_CHANGE_PATHS = ["/change-password", "/api/change-password", "/api/logout"];

function isSchoolPublicPath(path: string): boolean {
  if (path === "/") return true;
  return SCHOOL_PUBLIC_PATHS.some((allowed) => {
    if (allowed === "/") return false;
    return allowed.endsWith("/") ? path.startsWith(allowed) : path === allowed || path.startsWith(`${allowed}/`);
  });
}

function isPlatformPath(path: string): boolean {
  return path.startsWith("/super-admin") || path.startsWith("/api/super-admin");
}

function clearSchoolCookies(response: NextResponse) {
  for (const name of ["school_session", "school_activity", "mary_session", "mary_activity"]) {
    response.cookies.set(name, "", { httpOnly: true, path: "/", maxAge: 0, sameSite: "lax" });
  }
}

function clearPlatformCookies(response: NextResponse) {
  response.cookies.set("platform_session", "", { httpOnly: true, path: "/", maxAge: 0, sameSite: "lax" });
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const requestHeaders = new Headers(request.headers);
  for (const header of SPOOFABLE_HEADERS) requestHeaders.delete(header);

  const tenantHost = resolveTenantHost(request.headers.get("host"));
  requestHeaders.set("x-tenant-kind", tenantHost.kind);
  if (tenantHost.kind === "school" && tenantHost.slug) {
    requestHeaders.set("x-school-slug", tenantHost.slug);
  }

  const platformPath = isPlatformPath(path);
  if (path === "/api/health") {
    const r = NextResponse.next({ request: { headers: requestHeaders } });
    applySecurityHeaders(r);
    return r;
  }
  const platformAllowed =
    tenantHost.kind === "super-admin" ||
    (platformPath && tenantHost.kind !== "school") ||
    (platformPath && tenantHost.kind === "school" && !tenantHost.explicit);

  // ── Platform console ────────────────────────────────────────────────────
  if (platformAllowed) {
    if (tenantHost.kind === "super-admin" && path === "/") {
      const r = NextResponse.redirect(new URL("/super-admin", request.url));
      applySecurityHeaders(r);
      return r;
    }
    if (path === "/super-admin/login" || path === "/api/super-admin/login") {
      const r = NextResponse.next({ request: { headers: requestHeaders } });
      applySecurityHeaders(r);
      return r;
    }

    const token = request.cookies.get("platform_session")?.value;
    const session = token ? await readSuperAdminSession(token) : null;
    if (!session) {
      if (path.startsWith("/api/")) {
        const r = NextResponse.json({ error: "Unauthorized platform access" }, { status: 401 });
        applySecurityHeaders(r);
        return r;
      }
      const login = new URL("/super-admin/login", request.url);
      login.searchParams.set("next", path.startsWith("/super-admin") ? path : "/super-admin");
      const response = NextResponse.redirect(login);
      clearPlatformCookies(response);
      applySecurityHeaders(response);
      return response;
    }

    requestHeaders.set("x-super-admin-id", session.id);
    const r = NextResponse.next({ request: { headers: requestHeaders } });
    applySecurityHeaders(r);
    return r;
  }

  // The platform console is never served from an explicit school subdomain.
  if (platformPath && tenantHost.kind === "school" && tenantHost.explicit) {
    const response = NextResponse.rewrite(new URL("/tenant-status?reason=not-found", request.url));
    response.headers.set("x-tenant-mismatch", "1");
    applySecurityHeaders(response);
    return response;
  }

  // ── Root host (no tenant) ──────────────────────────────────────────────
  if (tenantHost.kind === "root") {
    if (path === "/api/health" || path.startsWith("/api/public/") || path === "/privacy") {
      const r = NextResponse.next({ request: { headers: requestHeaders } });
      applySecurityHeaders(r);
      return r;
    }
    if (path === "/") {
      const r = NextResponse.rewrite(new URL("/tenant-status?reason=no-school", request.url));
      applySecurityHeaders(r);
      return r;
    }
    const r = NextResponse.rewrite(new URL("/tenant-status?reason=not-found", request.url));
    applySecurityHeaders(r);
    return r;
  }

  // ── School tenant ──────────────────────────────────────────────────────
  if (!tenantHost.slug) {
    const r = NextResponse.rewrite(new URL("/tenant-status?reason=not-found", request.url));
    applySecurityHeaders(r);
    return r;
  }

  // Public school pages (login, privacy, receipts, health).
  if (isSchoolPublicPath(path)) {
    const r = NextResponse.next({ request: { headers: requestHeaders } });
    applySecurityHeaders(r);
    return r;
  }

  // Everything else requires a signed school session.
  const token = request.cookies.get("school_session")?.value;
  const session = token ? await readSession(token) : null;

  if (!session) {
    if (path.startsWith("/api/")) {
      const response = NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
      clearSchoolCookies(response);
      applySecurityHeaders(response);
      return response;
    }
    const response = NextResponse.redirect(new URL("/?reason=signin", request.url));
    clearSchoolCookies(response);
    applySecurityHeaders(response);
    return response;
  }

  // A session minted for one school can never be used on another school's
  // subdomain. This is checked before any page or API code runs.
  if (tenantHost.explicit && session.schoolSlug !== tenantHost.slug) {
    if (path.startsWith("/api/")) {
      const response = NextResponse.json({ error: "Tenant mismatch" }, { status: 401 });
      clearSchoolCookies(response);
      applySecurityHeaders(response);
      return response;
    }
    const response = NextResponse.redirect(new URL("/?reason=tenant", request.url));
    clearSchoolCookies(response);
    applySecurityHeaders(response);
    return response;
  }

  if (session.forcePasswordChange && !PASSWORD_CHANGE_PATHS.includes(path)) {
    if (path.startsWith("/api/")) {
      const r = NextResponse.json({ error: "Password change required" }, { status: 403 });
      applySecurityHeaders(r);
      return r;
    }
    const r = NextResponse.redirect(new URL("/change-password", request.url));
    applySecurityHeaders(r);
    return r;
  }

  const activity = request.cookies.get("school_activity")?.value;
  if (!activity || !(await readActivitySession(activity, session.id))) {
    if (path.startsWith("/api/")) {
      const response = NextResponse.json({ error: "Session expired after 10 minutes of inactivity." }, { status: 401 });
      clearSchoolCookies(response);
      applySecurityHeaders(response);
      return response;
    }
    const response = NextResponse.redirect(new URL("/?reason=idle", request.url));
    clearSchoolCookies(response);
    applySecurityHeaders(response);
    return response;
  }

  requestHeaders.set("x-school-id", session.schoolId);
  requestHeaders.set("x-user-id", session.id);
  requestHeaders.set("x-user-role", session.role);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  applySecurityHeaders(response);
  response.cookies.set("school_activity", await makeActivitySession(session.id), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return response;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"] };
