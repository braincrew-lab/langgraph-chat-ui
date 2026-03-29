#!/usr/bin/env node
/**
 * Database setup script — handles schema initialization for any supported provider.
 *
 * - SQLite:      Uses `prisma migrate deploy` (existing migration files are SQLite-compatible)
 * - PostgreSQL:  Uses `prisma db push` (generates correct SQL from schema.prisma)
 * - MySQL:       Uses `prisma db push` (generates correct SQL from schema.prisma)
 *
 * This script patches the schema provider temporarily (like prisma-generate.mjs does),
 * then runs the appropriate command, and restores the original schema.
 */
import { readFileSync, writeFileSync } from "fs";
import { execSync } from "child_process";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const cwd = resolve(__dirname, "..");
const schemaPath = resolve(cwd, "prisma", "schema.prisma");

const provider = process.env.DATABASE_PROVIDER || "sqlite";
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.log("[db-setup] DATABASE_URL not set — skipping database setup.");
  process.exit(0);
}

console.log(`[db-setup] Provider: ${provider}`);

// Patch schema provider
let schema = readFileSync(schemaPath, "utf-8");
const originalSchema = schema;
schema = schema.replace(
  /provider\s*=\s*"(sqlite|postgresql|mysql)"/,
  `provider = "${provider}"`,
);
if (schema !== originalSchema) {
  writeFileSync(schemaPath, schema, "utf-8");
}

try {
  if (provider === "sqlite") {
    console.log("[db-setup] Running prisma migrate deploy (SQLite)...");
    execSync("npx prisma migrate deploy", { stdio: "inherit", cwd });
  } else {
    console.log(`[db-setup] Running prisma db push (${provider})...`);
    execSync("npx prisma db push --skip-generate --accept-data-loss", {
      stdio: "inherit",
      cwd,
    });
  }
  console.log("[db-setup] Database schema is up to date.");
} catch (error) {
  console.error("[db-setup] Database setup failed:", error.message);
  process.exit(1);
} finally {
  // Restore original schema
  if (schema !== originalSchema) {
    writeFileSync(schemaPath, originalSchema, "utf-8");
    console.log("[db-setup] Restored original schema.");
  }
}
