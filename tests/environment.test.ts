import { afterEach, describe, expect, it } from "vitest";
import { validateProductionEnvironment } from "../src/lib/environment";

const original = { ...process.env };

afterEach(() => {
  for (const key of Object.keys(process.env)) if (!(key in original)) delete process.env[key];
  for (const [key, value] of Object.entries(original)) if (value !== undefined) process.env[key] = value;
});

describe("production environment validation", () => {
  function productionEnvironment(overrides: Record<string, string | undefined> = {}) {
    (process.env as Record<string, string | undefined>)["NODE_ENV"] = "production";
    delete process.env.NEXT_PHASE;
    process.env.DATABASE_URL = "postgresql://app:secret@localhost:5432/school";
    process.env.SESSION_SECRET = "a-unique-session-secret-with-at-least-32-characters";
    process.env.OBJECT_STORAGE_DRIVER = "supabase";
    process.env.SUPABASE_URL = "https://mary-royal.example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "server-only-test-secret";
    process.env.SUPABASE_STORAGE_BUCKET = "mary-royal-private";
    for (const [key, value] of Object.entries(overrides)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }

  it("accepts a complete PostgreSQL and private Supabase storage configuration", () => {
    productionEnvironment();
    expect(() => validateProductionEnvironment()).not.toThrow();
  });

  it("rejects missing runtime secrets without echoing values", () => {
    productionEnvironment({ SESSION_SECRET: "replace-this-with-placeholder" });
    expect(() => validateProductionEnvironment()).toThrow(/SESSION_SECRET/);
    try { validateProductionEnvironment(); } catch (error) {
      expect(String(error)).not.toContain("replace-this-with-placeholder");
    }
  });

  it("requires all server-only storage settings when Supabase storage is enabled", () => {
    productionEnvironment({ SUPABASE_SERVICE_ROLE_KEY: undefined });
    expect(() => validateProductionEnvironment()).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it("rejects ephemeral local uploads on Vercel", () => {
    productionEnvironment({ OBJECT_STORAGE_DRIVER: "local", VERCEL: "1" });
    expect(() => validateProductionEnvironment()).toThrow(/OBJECT_STORAGE_DRIVER/);
  });
});
