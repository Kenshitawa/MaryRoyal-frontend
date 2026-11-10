import { db } from "./db";
import { safeHexColour, safeLogoUrl } from "./tenant-host";
import type { TenantConfig } from "./tenant-types";

export type { TenantConfig, TenantPaymentConfig } from "./tenant-types";
export { PLATFORM_TENANT, DEMO_FALLBACK_TENANT } from "./tenant-types";

interface CacheEntry {
  data: TenantConfig | null;
  expiresAt: number;
}

const tenantCache = new Map<string, CacheEntry>();
const DEFAULT_TTL_MS = 60_000;

function cacheTtl(): number {
  const configured = Number(process.env.TENANT_CACHE_TTL_MS);
  if (!Number.isFinite(configured) || configured < 1_000) return DEFAULT_TTL_MS;
  return Math.min(configured, 5 * 60_000);
}

function normaliseKey(value: string): string {
  return value.trim().toLowerCase();
}

function toTenantConfig(school: {
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
  status: string;
  paymentConfig: {
    paybillNumber: string | null;
    accountFormat: string;
    tillNumber: string | null;
    bankName: string | null;
    bankBranch: string | null;
    bankAccountNumber: string | null;
    bankAccountName: string | null;
    darajaShortcode: string | null;
    darajaEnvironment: string;
    darajaConsumerKeyEncrypted: string | null;
    darajaConsumerSecretEncrypted: string | null;
    darajaPasskeyEncrypted: string | null;
  } | null;
}): TenantConfig {
  return {
    id: school.id,
    name: school.name,
    slug: school.slug,
    motto: school.motto,
    slogan: school.slogan,
    logoUrl: safeLogoUrl(school.logoUrl),
    primaryColour: safeHexColour(school.primaryColour, "#1d4ed8"),
    secondaryColour: safeHexColour(school.secondaryColour, "#102653"),
    accentColour: safeHexColour(school.accentColour, "#d97706"),
    contactEmail: school.contactEmail,
    contactPhone: school.contactPhone,
    poBox: school.poBox,
    physicalAddress: school.physicalAddress,
    status: school.status,
    paymentConfig: school.paymentConfig
      ? {
          paybillNumber: school.paymentConfig.paybillNumber,
          accountFormat: school.paymentConfig.accountFormat,
          tillNumber: school.paymentConfig.tillNumber,
          bankName: school.paymentConfig.bankName,
          bankBranch: school.paymentConfig.bankBranch,
          bankAccountNumber: school.paymentConfig.bankAccountNumber,
          bankAccountName: school.paymentConfig.bankAccountName,
          darajaShortcode: school.paymentConfig.darajaShortcode,
          darajaEnvironment: school.paymentConfig.darajaEnvironment,
          darajaConfigured: Boolean(
            school.paymentConfig.darajaConsumerKeyEncrypted &&
              school.paymentConfig.darajaConsumerSecretEncrypted &&
              school.paymentConfig.darajaPasskeyEncrypted,
          ),
        }
      : null,
  };
}

/**
 * Load tenant configuration by slug or id, using a short-lived per-instance
 * cache. Payment secrets are deliberately never selected.
 */
export async function getTenantConfig(slugOrId: string, forceRefresh = false): Promise<TenantConfig | null> {
  const normalized = normaliseKey(slugOrId);
  if (!normalized) return null;

  const cacheKey = `tenant:${normalized}`;
  const now = Date.now();
  if (!forceRefresh) {
    const cached = tenantCache.get(cacheKey);
    if (cached && cached.expiresAt > now) return cached.data;
  }

  const school = await db.school.findFirst({
    where: { OR: [{ slug: normalized }, { id: normalized }] },
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
          darajaConsumerKeyEncrypted: true,
          darajaConsumerSecretEncrypted: true,
          darajaPasskeyEncrypted: true,
        },
      },
    },
  });

  if (!school) {
    tenantCache.set(cacheKey, { data: null, expiresAt: now + 10_000 });
    return null;
  }

  const config = toTenantConfig(school);
  const ttl = cacheTtl();
  tenantCache.set(cacheKey, { data: config, expiresAt: now + ttl });
  tenantCache.set(`tenant:${normaliseKey(school.id)}`, { data: config, expiresAt: now + ttl });
  tenantCache.set(`tenant:${normaliseKey(school.slug)}`, { data: config, expiresAt: now + ttl });

  return config;
}

export function invalidateTenantCache(slugOrId: string): void {
  const normalized = normaliseKey(slugOrId);
  if (!normalized) return;

  // The cache stores the same config under both the id and the slug. Drop every
  // entry that points at this tenant so a payment-settings save cannot leave a
  // stale branded/payment payload behind under the other key.
  for (const [cacheKey, entry] of tenantCache) {
    if (
      cacheKey === `tenant:${normalized}` ||
      normaliseKey(entry.data?.id ?? "") === normalized ||
      normaliseKey(entry.data?.slug ?? "") === normalized
    ) {
      tenantCache.delete(cacheKey);
    }
  }
}

export function clearTenantCache(): void {
  tenantCache.clear();
}
