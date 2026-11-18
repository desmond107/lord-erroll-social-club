"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { createAdminSession, destroyAdminSession, getPending2fa, verifyPassword, twoFactorRequired } from "@/lib/admin-auth";
import { rateLimit } from "@/lib/ratelimit";
import { clientIp, hashIp } from "@/lib/request";
import { openSecret, verifyTotp } from "@/lib/totp";
import { audit } from "@/lib/audit";
import { homeFor } from "@/lib/roles";

export type AdminLoginState = { error?: string } | null;

const LOCK_AFTER = 5;
const LOCK_MS = 15 * 60 * 1000;

export async function adminLogin(_: AdminLoginState, fd: FormData): Promise<AdminLoginState> {
  const email = String(fd.get("email") || "").trim().toLowerCase().slice(0, 160);
  const password = String(fd.get("password") || "");
  const ip = hashIp(await clientIp());
  if (!(await rateLimit(`admin-login:${ip}`, 15, 900)).ok) return { error: "Too many attempts. Please wait 15 minutes." };

  const user = await prisma.adminUser.findUnique({ where: { email } });
  if (user?.lockedUntil && user.lockedUntil > new Date()) return { error: "This account is temporarily locked after failed attempts. Try again later." };
  const ok = user && user.active && (await verifyPassword(password, user.passwordHash));
  if (!user || !ok) {
    if (user) {
      const failed = user.failedLogins + 1;
      await prisma.adminUser.update({
        where: { id: user.id },
        data: { failedLogins: failed >= LOCK_AFTER ? 0 : failed, lockedUntil: failed >= LOCK_AFTER ? new Date(Date.now() + LOCK_MS) : null },
      });
      await audit({ id: user.id, email: user.email }, failed >= LOCK_AFTER ? "admin.locked" : "admin.login_failed", "AdminUser", user.id);
    }
    return { error: "Email or password is incorrect." };
  }
  await prisma.adminUser.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null } });

  if (user.totpEnabled) {
    await createAdminSession(user.id, true);
    redirect("/admin/two-factor");
  }
  await createAdminSession(user.id, false);
  await prisma.adminUser.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await audit({ id: user.id, email: user.email }, "admin.login", "AdminUser", user.id, { twoFactor: false });
  redirect(twoFactorRequired() ? "/admin/security?enrol=1" : homeFor(user.role));
}

export async function adminTwoFactor(_: AdminLoginState, fd: FormData): Promise<AdminLoginState> {
  const pending = await getPending2fa();
  if (!pending) redirect("/admin/login");
  const ip = hashIp(await clientIp());
  if (!(await rateLimit(`admin-2fa:${pending.userId}`, 6, 900)).ok || !(await rateLimit(`admin-2fa-ip:${ip}`, 12, 900)).ok) {
    await destroyAdminSession();
    return { error: "Too many attempts. Please sign in again later." };
  }
  const user = await prisma.adminUser.findUniqueOrThrow({ where: { id: pending.userId } });
  if (!user.totpSecret || !verifyTotp(String(fd.get("code") || ""), openSecret(user.totpSecret))) {
    await audit({ id: user.id, email: user.email }, "admin.2fa_failed", "AdminUser", user.id);
    return { error: "That code isn't right." };
  }
  await destroyAdminSession();
  await createAdminSession(user.id, false);
  await prisma.adminUser.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await audit({ id: user.id, email: user.email }, "admin.login", "AdminUser", user.id, { twoFactor: true });
  redirect(homeFor(user.role));
}
