import { db } from "./db";

export interface TenantConfig {
  id: string;
  name: string;
  slug: string;
  motto: string;
  slogan: string | null;
  logoUrl: string;
  primaryColour: string;
  secondaryColour: string;
  accentColour: string;
  contactEmail: string | null;
  contactPhone: string | null;
  poBox: string | null;
  physicalAddress: string | null;
  status: "ACTIVE" | "SUSPENDED" | string;
  paymentConfig?: {
    paybillNumber: string | null;
    accountFormat: string;
    tillNumber: string | null;
    bankName: string | null;
    bankBranch: string | null;
    bankAccountNumber: string | null;
    bankAccountName: string | null;
    darajaShortcode: string | null;
    darajaEnvironment: string;
  } | null;
}

// In-memory cache with short TTL (60 seconds) for fast edge/server performance
interface CacheEntry {
  data: TenantConfig | null;
  expiresAt: number;
}
const tenantCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60_000;

/**
 * Parses the incoming Host header to extract the subdomain/tenant slug or super-admin indicator.
 */
export function resolveHostTenant(hostHeader: string | null | undefined): {
  isSuperAdmin: boolean;
  slug: string;
} {
  if (!hostHeader) {
    return { isSuperAdmin: false, slug: "maryroyal" };
  }

  // Remove port if present (e.g. "school.localhost:3000" -> "school.localhost")
  const hostname = hostHeader.split(":")[0].toLowerCase().trim();

  // Check if it's the dedicated Super Admin host
  if (
    hostname.startsWith("superadmin.") ||
    hostname.startsWith("admin.") ||
    hostname === "superadmin"
  ) {
    return { isSuperAdmin: true, slug: "" };
  }

  // Handle localhost subdomains: e.g. "maryroyal.localhost", "stjude.localhost"
  if (hostname.endsWith(".localhost")) {
    const parts = hostname.split(".");
    if (parts.length >= 2 && parts[0] !== "www") {
      const slug = parts[0] === "demo" ? "maryroyal" : parts[0];
      return { isSuperAdmin: false, slug };
    }
  }

  // Handle domain subdomains: e.g. "maryroyal.schoolcore.co.ke", "stjude.yourdomain.com"
  const parts = hostname.split(".");
  // If e.g. ["maryroyal", "domain", "co", "ke"] or ["stjude", "domain", "com"]
  if (parts.length > 2 && parts[0] !== "www") {
    const slug = parts[0] === "demo" ? "maryroyal" : parts[0];
    return { isSuperAdmin: false, slug };
  }

  // Default fallback for root/local dev without subdomain
  return { isSuperAdmin: false, slug: "maryroyal" };
}

/**
 * Loads tenant configuration by slug or id, utilizing an in-memory cache with short TTL.
 */
export async function getTenantConfig(
  slugOrId: string,
  forceRefresh = false
): Promise<TenantConfig | null> {
  const normalized = slugOrId.toLowerCase().trim();
  const cacheKey = `tenant:${normalized}`;
  const now = Date.now();

  if (!forceRefresh) {
    const cached = tenantCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return cached.data;
    }
  }

  // Query database
  const school = await db.school.findFirst({
    where: {
      OR: [{ slug: normalized }, { id: normalized }],
    },
    include: {
      paymentConfig: {
        select: {
          paybillNumber: true,
          accountFormat: true,
          tillNumber: true,
          bankName: true,
          bankBranch: true,
          bankAccountNumber: true,
          bankAccountName: true,
          darajaShortcode: true,
          darajaEnvironment: true,
        },
      },
    },
  });

  if (!school) {
    // Cache negative lookup briefly (10 seconds) to mitigate repeat 404 queries
    tenantCache.set(cacheKey, { data: null, expiresAt: now + 10_000 });
    return null;
  }

  const config: TenantConfig = {
    id: school.id,
    name: school.name,
    slug: school.slug,
    motto: school.motto,
    slogan: school.slogan,
    logoUrl: school.logoUrl,
    primaryColour: school.primaryColour,
    secondaryColour: school.secondaryColour,
    accentColour: school.accentColour,
    contactEmail: school.contactEmail,
    contactPhone: school.contactPhone,
    poBox: school.poBox,
    physicalAddress: school.physicalAddress,
    status: school.status,
    paymentConfig: school.paymentConfig,
  };

  tenantCache.set(cacheKey, { data: config, expiresAt: now + CACHE_TTL_MS });
  // Also index by ID if queried by slug
  if (school.slug !== school.id) {
    tenantCache.set(`tenant:${school.id.toLowerCase()}`, {
      data: config,
      expiresAt: now + CACHE_TTL_MS,
    });
  }

  return config;
}

/**
 * Invalidate cached tenant configuration (e.g. after updating school settings).
 */
export function invalidateTenantCache(slugOrId: string) {
  const normalized = slugOrId.toLowerCase().trim();
  tenantCache.delete(`tenant:${normalized}`);
}
