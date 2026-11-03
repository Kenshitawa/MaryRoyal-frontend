import path from "node:path";
import { describe, expect, it } from "vitest";
import { compareSchemas } from "../scripts/check-schema-drift";

describe("Prisma Schema Parity", () => {
  it("ensures SQLite and PostgreSQL schemas define identical models, enums, and fields", () => {
    const sqlitePath = path.resolve(__dirname, "../prisma/schema.prisma");
    const pgPath = path.resolve(__dirname, "../prisma/postgresql/schema.prisma");

    const result = compareSchemas(sqlitePath, pgPath);
    if (!result.success) {
      console.error("Schema drift detected:", result.errors);
    }
    expect(result.errors).toEqual([]);
    expect(result.success).toBe(true);
  });
});
