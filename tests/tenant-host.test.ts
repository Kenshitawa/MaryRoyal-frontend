import { describe, expect, it } from "vitest";
import { isValidSlug, normaliseHost, resolveTenantHost, safeHexColour, safeLogoUrl, tenantHomeUrl } from "../src/lib/tenant-host";

const originalEnv = process.env.NODE_ENV;

describe("tenant host resolution", () => {
  it("resolves production subdomains against the configured root domain", () => {
    expect(resolveTenantHost("maryroyal.schoolcore.co.ke", "schoolcore.co.ke")).toEqual({
      kind: "school",
      slug: "maryroyal",
      explicit: true,
    });
    expect(resolveTenantHost("stjude.schoolcore.co.ke:443", "schoolcore.co.ke")).toEqual({
      kind: "school",
      slug: "stjude",
      explicit: true,
    });
  });

  it("maps the platform console host separately", () => {
    expect(resolveTenantHost("superadmin.schoolcore.co.ke", "schoolcore.co.ke")).toEqual({
      kind: "super-admin",
      slug: null,
      explicit: true,
    });
    expect(resolveTenantHost("superadmin.localhost:3000", "schoolcore.co.ke").kind).toBe("super-admin");
  });

  it("treats the bare root domain and www as the platform root", () => {
    expect(resolveTenantHost("schoolcore.co.ke", "schoolcore.co.ke").kind).toBe("root");
    expect(resolveTenantHost("www.schoolcore.co.ke", "schoolcore.co.ke").kind).toBe("root");
  });

  it("never treats lookalike domains as tenants", () => {
    expect(resolveTenantHost("maryroyal.schoolcore.co.ke.evil.com", "schoolcore.co.ke").kind).toBe("root");
    expect(resolveTenantHost("schoolcore.co.ke.evil.com", "schoolcore.co.ke").kind).toBe("root");
  });

  it("resolves localhost subdomains in development", () => {
    expect(resolveTenantHost("stjude.localhost:3000", null)).toEqual({
      kind: "school",
      slug: "stjude",
      explicit: true,
    });
    expect(resolveTenantHost("maryroyal.localhost", null).slug).toBe("maryroyal");
  });

  it("keeps bare localhost as the demo school in development", () => {
    expect(resolveTenantHost("localhost:3000", null)).toEqual({
      kind: "school",
      slug: "maryroyal",
      explicit: false,
    });
    expect(resolveTenantHost("127.0.0.1:3000", null).kind).toBe("school");
  });

  it("rejects reserved and malformed slugs", () => {
    expect(resolveTenantHost("www.localhost", null).kind).toBe("root");
    expect(resolveTenantHost("admin.localhost", null).kind).toBe("super-admin");
    expect(resolveTenantHost("-bad.localhost", null).kind).toBe("root");
    expect(resolveTenantHost("UPPER.localhost", null).slug).toBe("upper");
    expect(isValidSlug("mary-royal")).toBe(true);
    expect(isValidSlug("mary_royal")).toBe(false);
    expect(isValidSlug("www")).toBe(false);
    expect(isValidSlug("a")).toBe(false);
  });

  it("normalises host headers with ports, commas and trailing dots", () => {
    expect(normaliseHost("MaryRoyal.Example.com:443")).toBe("maryroyal.example.com");
    expect(normaliseHost("maryroyal.example.com.")).toBe("maryroyal.example.com");
    expect(normaliseHost("maryroyal.example.com, proxy.local")).toBe("maryroyal.example.com");
    expect(normaliseHost(null)).toBeNull();
  });

  it("builds tenant URLs from the root domain", () => {
    expect(tenantHomeUrl("stjude", "schoolcore.co.ke")).toBe("https://stjude.schoolcore.co.ke");
    expect(tenantHomeUrl("stjude", null)).toBe("http://stjude.localhost:3000");
  });

  if (originalEnv === "test") {
    it("keeps production root hosts from resolving to a tenant during tests", () => {
      const previous = process.env.NODE_ENV;
      // @ts-expect-error NODE_ENV is writable at runtime in tests
      process.env.NODE_ENV = "production";
      try {
        expect(resolveTenantHost("localhost:3000", null).kind).toBe("root");
      } finally {
        // @ts-expect-error restore
        process.env.NODE_ENV = previous;
      }
    });
  }
});

describe("tenant display sanitisation", () => {
  it("accepts only strict six-digit hex colours", () => {
    expect(safeHexColour("#1d4ed8", "#000000")).toBe("#1d4ed8");
    expect(safeHexColour("red; background:url(x)", "#000000")).toBe("#000000");
    expect(safeHexColour("#12345", "#000000")).toBe("#000000");
    expect(safeHexColour(null, "#abcdef")).toBe("#abcdef");
  });

  it("accepts only same-site logo paths", () => {
    expect(safeLogoUrl("/mary-royal-logo.png")).toBe("/mary-royal-logo.png");
    expect(safeLogoUrl("https://evil.example/logo.png")).toBe("/mary-royal-logo.png");
    expect(safeLogoUrl("//evil.example/logo.png")).toBe("/mary-royal-logo.png");
  });
});
