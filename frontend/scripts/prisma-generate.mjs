#!/usr/bin/env node
/**
 * Dynamic Prisma schema generator
 * Reads DATABASE_PROVIDER env var and patches schema.prisma before running prisma generate
 */
import { readFileSync, writeFileSync } from "fs";
import { execSync } from "child_process";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const schemaPath = resolve(__dirname, "..", "prisma", "schema.prisma");

const provider = process.env.DATABASE_PROVIDER || "sqlite";
const validProviders = ["sqlite", "postgresql", "mysql"];

if (!validProviders.includes(provider)) {
  console.error(
    `Invalid DATABASE_PROVIDER: "${provider}". Must be one of: ${validProviders.join(", ")}`,
  );
  process.exit(1);
}

// Read and patch schema
let schema = readFileSync(schemaPath, "utf-8");
const originalSchema = schema;

// Replace provider value in datasource block
schema = schema.replace(
  /provider\s*=\s*"(sqlite|postgresql|mysql)"/,
  `provider = "${provider}"`,
);

if (schema !== originalSchema) {
  writeFileSync(schemaPath, schema, "utf-8");
  console.log(`[prisma-generate] Patched schema provider to "${provider}"`);
}

// Run prisma generate
try {
  execSync("npx prisma generate", {
    stdio: "inherit",
    cwd: resolve(__dirname, ".."),
  });
} catch (e) {
  process.exit(1);
} finally {
  // Restore original schema to keep git clean
  if (schema !== originalSchema) {
    writeFileSync(schemaPath, originalSchema, "utf-8");
    console.log(`[prisma-generate] Restored original schema`);
  }
}
