import { Prisma, PrismaClient } from "@prisma/client";

const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
const apiKey = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;
if (!url || !apiKey) throw new Error("Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY (or SUPABASE_ANON_KEY) in the trusted environment.");
if (!process.env.DATABASE_URL) throw new Error("Set DATABASE_URL to the PostgreSQL database being checked.");

const db = new PrismaClient();
const methods = ["SELECT", "INSERT", "UPDATE", "DELETE"] as const;

async function main() {
  const schema = await db.$queryRaw<Array<{ schema_usage: boolean }>>`
    SELECT has_schema_privilege('anon', 'public', 'USAGE') AS schema_usage
  `;
  if (schema[0]?.schema_usage) throw new Error("Supabase anon still has USAGE on public schema.");

  const tables = await db.$queryRaw<Array<Record<string, string | boolean>>>(Prisma.sql`
    SELECT c.relname AS table_name,
           c.relrowsecurity AS rls_enabled,
           has_table_privilege('anon', c.oid, 'SELECT') AS anon_select,
           has_table_privilege('anon', c.oid, 'INSERT') AS anon_insert,
           has_table_privilege('anon', c.oid, 'UPDATE') AS anon_update,
           has_table_privilege('anon', c.oid, 'DELETE') AS anon_delete,
           has_table_privilege('authenticated', c.oid, 'SELECT') AS auth_select,
           has_table_privilege('authenticated', c.oid, 'INSERT') AS auth_insert,
           has_table_privilege('authenticated', c.oid, 'UPDATE') AS auth_update,
           has_table_privilege('authenticated', c.oid, 'DELETE') AS auth_delete
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
     ORDER BY c.relname
  `);
  if (!tables.length) throw new Error("No public tables found; refusing to report a passing security check.");

  const failures: string[] = [];
  for (const table of tables) {
    if (table.rls_enabled !== true) failures.push(`${table.table_name}: RLS disabled`);
    for (const method of methods) {
      const key = `anon_${method.toLowerCase()}`;
      if (table[key] === true) failures.push(`${table.table_name}: anon ${method} granted`);
      const authKey = `auth_${method.toLowerCase()}`;
      if (table[authKey] === true) failures.push(`${table.table_name}: authenticated ${method} granted`);
    }

    const endpoint = `${url}/rest/v1/${encodeURIComponent(String(table.table_name))}`;
    const headers = { apikey: apiKey!, authorization: `Bearer ${apiKey!}`, "content-type": "application/json", prefer: "return=minimal" };
    const attempts = [
      { label: "SELECT", url: `${endpoint}?select=*`, method: "GET" },
      { label: "INSERT", url: endpoint, method: "POST", body: "{}" },
      { label: "UPDATE", url: `${endpoint}?id=eq.__mary_royal_security_probe__`, method: "PATCH", body: "{}" },
      { label: "DELETE", url: `${endpoint}?id=eq.__mary_royal_security_probe__`, method: "DELETE" },
    ] as const;
    for (const attempt of attempts) {
      const response = await fetch(attempt.url, {
        method: attempt.method,
        headers,
        ...("body" in attempt ? { body: attempt.body } : {}),
        signal: AbortSignal.timeout(10_000),
      });
      if (response.ok) failures.push(`${table.table_name}: public Data API ${attempt.label} returned ${response.status}`);
      await response.body?.cancel();
    }
  }

  if (failures.length) throw new Error(`Supabase public API security check failed (${failures.length} findings):\n${failures.join("\n")}`);
  console.log(`PASS: checked ${tables.length} public tables: RLS enabled; anon/authenticated have no table privileges; publishable-key Data API reads denied.`);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : "Supabase security check failed.");
  process.exitCode = 1;
}).finally(async () => db.$disconnect());
