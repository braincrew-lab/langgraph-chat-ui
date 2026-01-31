/**
 * Script to seed default global settings
 * Usage: npx tsx scripts/seed-settings.ts
 */

import { PrismaClient } from "@prisma/client";
import { SETTING_DEFINITIONS, DEFAULT_SETTINGS } from "../src/types/global-settings";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding global settings...");

  for (const definition of SETTING_DEFINITIONS) {
    const existing = await prisma.globalSetting.findUnique({
      where: { key: definition.key },
    });

    if (!existing) {
      await prisma.globalSetting.create({
        data: {
          key: definition.key,
          value: JSON.stringify(DEFAULT_SETTINGS[definition.key]),
          category: definition.category,
        },
      });
      console.log(`  ✓ Created: ${definition.key}`);
    } else {
      console.log(`  - Exists: ${definition.key}`);
    }
  }

  console.log("\nDone!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
