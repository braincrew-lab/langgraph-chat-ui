/**
 * Script to promote an existing user to admin
 * Usage: npx tsx scripts/promote-admin.ts <email> [admin|super_admin]
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const [, , email, roleArg] = process.argv;

  if (!email) {
    console.error("Usage: npx tsx scripts/promote-admin.ts <email> [admin|super_admin]");
    process.exit(1);
  }

  const role = roleArg === "admin" ? "admin" : "super_admin";

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (!user) {
    console.error(`User with email ${email} not found`);
    process.exit(1);
  }

  if (user.role === role) {
    console.log(`User ${email} is already a ${role}`);
    process.exit(0);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      role,
      status: "active",
      approvedAt: user.approvedAt || new Date(),
    },
  });

  console.log(`✓ Promoted ${email} to ${role}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
