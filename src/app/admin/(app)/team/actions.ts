"use server";

import { revalidatePath } from "next/cache";
import crypto from "crypto";
import type { AdminRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { guarded, str, InputError, type ActionResult } from "@/lib/admin-action";
import { hashPassword } from "@/lib/admin-auth";
import { audit } from "@/lib/audit";

const ROLES: AdminRole[] = ["SUPER_ADMIN", "MANAGER", "FRONT_DESK", "ACCOUNTANT"];

async function superAdminsLeft(excludeId: string) {
  return prisma.adminUser.count({ where: { role: "SUPER_ADMIN", active: true, id: { not: excludeId } } });
}

export async function addAdmin(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return guarded("team", async (u) => {
    const email = str(fd, "email", 160).toLowerCase();
    const name = str(fd, "name", 80);
    const role = str(fd, "role") as AdminRole;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || name.length < 2 || !ROLES.includes(role)) throw new InputError("Enter a name, email and role.");
    if (await prisma.adminUser.findUnique({ where: { email } })) throw new InputError("That email already has a staff account.");
    // One-time password, shown once; they change it and set up 2FA at first sign-in.
    const temp = `${crypto.randomBytes(6).toString("base64url")}-${crypto.randomInt(1000, 9999)}`;
    const a = await prisma.adminUser.create({ data: { email, name, role, passwordHash: await hashPassword(temp) } });
    await audit(u, "team.add", "AdminUser", a.id, { email, role });
    revalidatePath("/admin/team");
    return `Account created. Temporary password (shown once): ${temp}. Share it securely; they must set up two-factor at first sign-in.`;
  });
}

export async function updateAdmin(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return guarded("team", async (u) => {
    const id = str(fd, "id");
    const role = str(fd, "role") as AdminRole;
    const active = fd.get("active") === "on";
    if (!ROLES.includes(role)) throw new InputError("Choose a role.");
    const target = await prisma.adminUser.findUniqueOrThrow({ where: { id } });
    if (target.role === "SUPER_ADMIN" && (role !== "SUPER_ADMIN" || !active) && (await superAdminsLeft(id)) === 0) throw new InputError("There must always be at least one active Super Admin.");
    await prisma.adminUser.update({ where: { id }, data: { role, active } });
    if (!active) await prisma.adminSession.deleteMany({ where: { userId: id } });
    await audit(u, "team.update", "AdminUser", id, { role, active, from: { role: target.role, active: target.active } });
    revalidatePath("/admin/team");
    return "Updated.";
  });
}

export async function reset2fa(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return guarded("team", async (u) => {
    const id = str(fd, "id");
    await prisma.adminUser.update({ where: { id }, data: { totpEnabled: false, totpSecret: null } });
    await prisma.adminSession.deleteMany({ where: { userId: id } });
    await audit(u, "team.reset_2fa", "AdminUser", id);
    revalidatePath("/admin/team");
    return "Two-factor reset. They will set it up again at next sign-in.";
  });
}
