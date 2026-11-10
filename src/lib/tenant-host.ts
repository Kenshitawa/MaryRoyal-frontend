/**
 * Pure host-to-tenant resolution. No database or Node-only imports so this
 * module is safe to use from Edge middleware and unit tests.
 */

export type TenantHostResult =
  | { kind: "school"; slug: string; explicit: boolean }
  | { kind: "super-admin"; slug: null; explicit: true }
  | { kind: "root"; slug: null; explicit: boolean };

const RESERVED_SLUGS = new Set(["www", "superadmin", "admin", "platform", "app", "api"]);

export function normaliseHost(hostHeader: string | null | undefined): string | null {
  if (!hostHeader) return null;
  const hostname = hostHeader.split(",")[0].split(":")[0].trim().toLowerCase().replace(/\.$/, "");
  if (!hostname) return null;
  return hostname;
}

export function isValidSlug(value: string): boolean {
  return /^[a-z0-9][a-z0-9-]{0,38}[a-z0-9]$/.test(value) && !RESERVED_SLUGS.has(value);
}

function isIpAddress(hostname: string): boolean {
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname) || hostname === "::1" || hostname === "[::1]";
}

/**
 * Resolve a request host to a tenant.
 *
 * - `<slug>.localhost` (any port) is a school in local development.
 * - `<slug>.<PLATFORM_ROOT_DOMAIN>` is a school in production.
 * - `superadmin.<root>` / `superadmin.localhost` is the platform console.
 * - bare `localhost`, `127.0.0.1` and the bare root domain are the platform root.
 *
 * The function never accepts a slug from a query string or cookie: tenant
 * identity comes from the Host header only.
 */
export function resolveTenantHost(
  hostHeader: string | null | undefined,
  rootDomain: string | null | undefined = process.env.PLATFORM_ROOT_DOMAIN,
): TenantHostResult {
  const hostname = normaliseHost(hostHeader);
  const root = normaliseHost(rootDomain);

  if (!hostname) {
    return { kind: "root", slug: null, explicit: false };
  }

  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]" || isIpAddress(hostname)) {
    // Local development keeps the original single-host workflow: bare
    // localhost serves the permanent demo tenant. Production root stays root.
    if (process.env.NODE_ENV !== "production") {
      return { kind: "school", slug: "maryroyal", explicit: false };
    }
    return { kind: "root", slug: null, explicit: true };
  }

  if (hostname.endsWith(".localhost")) {
    const prefix = hostname.slice(0, -".localhost".length);
    const labels = prefix.split(".");
    if (labels.length === 1) {
      const candidate = labels[0];
      if (candidate === "superadmin" || candidate === "admin") {
        return { kind: "super-admin", slug: null, explicit: true };
      }
      if (isValidSlug(candidate)) {
        return { kind: "school", slug: candidate, explicit: true };
      }
    }
    return { kind: "root", slug: null, explicit: true };
  }

  if (root && (hostname === root || hostname === `www.${root}`)) {
    return { kind: "root", slug: null, explicit: true };
  }

  if (root && hostname.endsWith(`.${root}`)) {
    const prefix = hostname.slice(0, -(root.length + 1));
    const labels = prefix.split(".");
    if (labels.length === 1) {
      const candidate = labels[0];
      if (candidate === "superadmin" || candidate === "admin") {
        return { kind: "super-admin", slug: null, explicit: true };
      }
      if (isValidSlug(candidate)) {
        return { kind: "school", slug: candidate, explicit: true };
      }
    }
    return { kind: "root", slug: null, explicit: true };
  }

  // In local development a custom hostname (for example a Playwright host
  // mapping) still resolves to the permanent demo tenant.
  if (process.env.NODE_ENV !== "production" && root === null) {
    return { kind: "school", slug: "maryroyal", explicit: false };
  }

  return { kind: "root", slug: null, explicit: true };
}

/** CSS colours are injected into a style tag, so only allow strict hex values. */
export function safeHexColour(value: string | null | undefined, fallback: string): string {
  return value && /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;
}

/** Only same-site absolute paths may be used for tenant logos. */
export function safeLogoUrl(value: string | null | undefined, fallback = "/mary-royal-logo.png"): string {
  if (!value) return fallback;
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  return fallback;
}

export function tenantHomeUrl(slug: string, rootDomain: string | null | undefined = process.env.PLATFORM_ROOT_DOMAIN): string {
  const root = normaliseHost(rootDomain);
  if (root) return `https://${slug}.${root}`;
  return `http://${slug}.localhost:3000`;
}
