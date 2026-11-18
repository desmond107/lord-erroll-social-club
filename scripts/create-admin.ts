/**
 * Creates the first Super Admin (or any staff account) from the command line.
 *   npm run admin:create -- owner@lord-erroll.com "Owner Name" SUPER_ADMIN
 * Prints a one-time password; the user sets up two-factor at first sign-in.
 */
import { PrismaClient, type AdminRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const [email, name, role = "SUPER_ADMIN"] = process.argv.slice(2);
const prisma = new PrismaClient();

async function main() {
  if (!email || !name) throw new Error('Usage: npm run admin:create -- email "Full Name" [SUPER_ADMIN|MANAGER|FRONT_DESK|ACCOUNTANT]');
  if (!["SUPER_ADMIN", "MANAGER", "FRONT_DESK", "ACCOUNTANT"].includes(role)) throw new Error("Unknown role");
  const temp = `${crypto.randomBytes(9).toString("base64url")}-${crypto.randomInt(1000, 9999)}`;
  await prisma.adminUser.upsert({
    where: { email: email.toLowerCase() },
    create: { email: email.toLowerCase(), name, role: role as AdminRole, passwordHash: await bcrypt.hash(temp, 12) },
    update: { name, role: role as AdminRole, passwordHash: await bcrypt.hash(temp, 12), active: true, failedLogins: 0, lockedUntil: null },
  });
  console.log(`✓ ${email} (${role})\n  One-time password: ${temp}\n  Sign in at /admin/login, then change it under Security.`);
}

main().catch((e) => { console.error(e.message); process.exit(1); }).finally(() => prisma.$disconnect());
