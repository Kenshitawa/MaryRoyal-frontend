import fs from "node:fs";
import path from "node:path";

interface FieldDef {
  name: string;
  type: string;
  isOptional: boolean;
  isArray: boolean;
  rawAttributes: string[];
}

interface ModelDef {
  name: string;
  fields: Map<string, FieldDef>;
}

interface EnumDef {
  name: string;
  values: string[];
}

interface SchemaSummary {
  models: Map<string, ModelDef>;
  enums: Map<string, EnumDef>;
}

function parsePrismaSchema(content: string): SchemaSummary {
  const models = new Map<string, ModelDef>();
  const enums = new Map<string, EnumDef>();

  const lines = content.split("\n");
  let currentModel: ModelDef | null = null;
  let currentEnum: EnumDef | null = null;

  for (let line of lines) {
    line = line.trim();
    if (!line || line.startsWith("//")) continue;

    if (line.startsWith("model ")) {
      const match = line.match(/^model\s+(\w+)\s*\{/);
      if (match) {
        currentModel = { name: match[1], fields: new Map() };
        models.set(match[1], currentModel);
      }
      continue;
    }

    if (line.startsWith("enum ")) {
      const match = line.match(/^enum\s+(\w+)\s*\{/);
      if (match) {
        currentEnum = { name: match[1], values: [] };
        enums.set(match[1], currentEnum);
      }
      continue;
    }

    if (line === "}") {
      currentModel = null;
      currentEnum = null;
      continue;
    }

    if (currentEnum) {
      const val = line.split("//")[0].trim();
      if (val && !val.startsWith("@@")) {
        currentEnum.values.push(val);
      }
      continue;
    }

    if (currentModel) {
      if (line.startsWith("@@")) {
        // Block-level attributes (indexes, composite ids)
        continue;
      }
      const parts = line.split("//")[0].trim().split(/\s+/);
      if (parts.length >= 2) {
        const fieldName = parts[0];
        let rawType = parts[1];
        const isOptional = rawType.endsWith("?");
        if (isOptional) rawType = rawType.slice(0, -1);
        const isArray = rawType.endsWith("[]");
        if (isArray) rawType = rawType.slice(0, -2);

        const rawAttributes = parts.slice(2).filter((a) => !a.startsWith("@db."));

        currentModel.fields.set(fieldName, {
          name: fieldName,
          type: rawType,
          isOptional,
          isArray,
          rawAttributes,
        });
      }
    }
  }

  return { models, enums };
}

export function compareSchemas(
  sqliteSchemaPath: string,
  postgresSchemaPath: string
): { success: boolean; errors: string[] } {
  const sqliteContent = fs.readFileSync(sqliteSchemaPath, "utf-8");
  const postgresContent = fs.readFileSync(postgresSchemaPath, "utf-8");

  const sqlite = parsePrismaSchema(sqliteContent);
  const postgres = parsePrismaSchema(postgresContent);

  const errors: string[] = [];

  // Compare Enums
  for (const [name, enumDef] of sqlite.enums) {
    if (!postgres.enums.has(name)) {
      errors.push(`Enum "${name}" exists in SQLite schema but missing in PostgreSQL schema.`);
    } else {
      const pgEnum = postgres.enums.get(name)!;
      if (JSON.stringify(enumDef.values) !== JSON.stringify(pgEnum.values)) {
        errors.push(
          `Enum "${name}" values differ:\n  SQLite: ${enumDef.values.join(", ")}\n  Postgres: ${pgEnum.values.join(", ")}`
        );
      }
    }
  }

  for (const name of postgres.enums.keys()) {
    if (!sqlite.enums.has(name)) {
      errors.push(`Enum "${name}" exists in PostgreSQL schema but missing in SQLite schema.`);
    }
  }

  // Compare Models
  for (const [modelName, modelDef] of sqlite.models) {
    if (!postgres.models.has(modelName)) {
      errors.push(`Model "${modelName}" exists in SQLite schema but missing in PostgreSQL schema.`);
      continue;
    }

    const pgModel = postgres.models.get(modelName)!;

    for (const [fieldName, fieldDef] of modelDef.fields) {
      if (!pgModel.fields.has(fieldName)) {
        errors.push(`Field "${modelName}.${fieldName}" exists in SQLite schema but missing in PostgreSQL schema.`);
        continue;
      }

      const pgField = pgModel.fields.get(fieldName)!;

      if (fieldDef.type !== pgField.type) {
        errors.push(
          `Field "${modelName}.${fieldName}" type mismatch: SQLite has "${fieldDef.type}", PostgreSQL has "${pgField.type}".`
        );
      }

      if (fieldDef.isOptional !== pgField.isOptional) {
        errors.push(
          `Field "${modelName}.${fieldName}" optionality mismatch: SQLite optional=${fieldDef.isOptional}, PostgreSQL optional=${pgField.isOptional}.`
        );
      }

      if (fieldDef.isArray !== pgField.isArray) {
        errors.push(
          `Field "${modelName}.${fieldName}" array mismatch: SQLite isArray=${fieldDef.isArray}, PostgreSQL isArray=${pgField.isArray}.`
        );
      }
    }

    for (const fieldName of pgModel.fields.keys()) {
      if (!modelDef.fields.has(fieldName)) {
        errors.push(`Field "${modelName}.${fieldName}" exists in PostgreSQL schema but missing in SQLite schema.`);
      }
    }
  }

  for (const modelName of postgres.models.keys()) {
    if (!sqlite.models.has(modelName)) {
      errors.push(`Model "${modelName}" exists in PostgreSQL schema but missing in SQLite schema.`);
    }
  }

  return { success: errors.length === 0, errors };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  const root = path.resolve(__dirname, "..");
  const sqlitePath = path.join(root, "prisma", "schema.prisma");
  const pgPath = path.join(root, "prisma", "postgresql", "schema.prisma");

  console.log("Checking Prisma schema parity between SQLite and PostgreSQL...");
  const result = compareSchemas(sqlitePath, pgPath);

  if (!result.success) {
    console.error(`Schema drift detected! Found ${result.errors.length} mismatch(es):`);
    for (const err of result.errors) {
      console.error(` - ${err}`);
    }
    process.exit(1);
  } else {
    console.log("Parity confirmed: SQLite and PostgreSQL Prisma schemas define the same models and fields.");
    process.exit(0);
  }
}
