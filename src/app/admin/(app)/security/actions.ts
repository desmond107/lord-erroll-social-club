"use server";

import { prisma } from "@/lib/db";
import { getAdmin, verifyPassword, hashPassword, passwordProblem, destroyOtherAdminSessions } from "@/lib/admin-auth";
import { openSecret, verifyTotp } from "@/lib/totp";
import { audit } from "@/lib/audit";
import type { ActionResult } from "@/lib/admin-action";

/** Confirms the secret shown on the page (stored sealed, not yet enabled) and turns 2FA on. */
export async function confirmTotp(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const u = await getAdmin();
  if (!u) return { error: "Sign in again." };
  const row = await prisma.adminUser.findUniqueOrThrow({ where: { id: u.id } });
  if (row.totpEnabled) return { ok: "Two-factor authentication is already on." };
  if (!row.totpSecret) return { error: "Reload the page to start setup." };
  if (!verifyTotp(String(fd.get("code") || ""), openSecret(row.totpSecret))) return { error: "That code doesn't match. Check the time on your phone and try again." };
  await prisma.adminUser.update({ where: { id: u.id }, data: { totpEnabled: true } });
  await destroyOtherAdminSessions(u.id);
  await audit(u, "admin.2fa_enabled", "AdminUser", u.id);
  return { ok: "Two-factor authentication is now on." };
}

export async function changePassword(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const u = await getAdmin();
  if (!u) return { error: "Sign in again." };
  const row = await prisma.adminUser.findUniqueOrThrow({ where: { id: u.id } });
  if (!(await verifyPassword(String(fd.get("current") || ""), row.passwordHash))) return { error: "Your current password is incorrect." };
  const pw = String(fd.get("password") || "");
  const problem = passwordProblem(pw);
  if (problem) return { error: problem };
  if (pw !== fd.get("password2")) return { error: "The new passwords don't match." };
  await prisma.adminUser.update({ where: { id: u.id }, data: { passwordHash: await hashPassword(pw) } });
  await destroyOtherAdminSessions(u.id);
  await audit(u, "admin.password_changed", "AdminUser", u.id);
  return { ok: "Password changed. Other sessions have been signed out." };
}
