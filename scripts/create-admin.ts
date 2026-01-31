/**
 * Script to create an admin user
 * Usage: npx tsx scripts/create-admin.ts <email> <password> [name]
 */

import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const [, , email, password, name] = process.argv;

  if (!email || !password) {
    console.error("Usage: npx tsx scripts/create-admin.ts <email> <password> [name]");
    process.exit(1);
  }

  // Check if user exists
  const existing = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (existing) {
    console.error(`User with email ${email} already exists`);
    console.log("Use scripts/promote-admin.ts to promote an existing user");
    process.exit(1);
  }

  const hashedPassword = await hash(password, 12);

  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      password: hashedPassword,
      name: name || "Admin",
      role: "super_admin",
      status: "active",
      approvedAt: new Date(),
    },
  });

  console.log(`✓ Created super admin: ${user.email}`);
  console.log(`  ID: ${user.id}`);
  console.log(`  Name: ${user.name}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
