import "server-only";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { AdminUser } from "@prisma/client";
import { prisma } from "./db";
import { clientIp, clientUserAgent } from "./request";
import { can, homeFor, type Permission } from "./roles";

export const ADMIN_COOKIE = "le_admin";
const SESSION_TTL_MS = 12 * 3600 * 1000;
const PENDING_TTL_MS = 10 * 60 * 1000;

export type AdminSessionUser = Pick<AdminUser, "id" | "email" | "name" | "role" | "totpEnabled">;

const sha = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

export const hashPassword = (pw: string) => bcrypt.hash(pw, 12);
export const verifyPassword = (pw: string, hash: string) => bcrypt.compare(pw, hash);

export function passwordProblem(pw: string): string | null {
  if (pw.length < 12) return "Use at least 12 characters.";
  if (!/[a-zA-Z]/.test(pw) || !/[0-9]/.test(pw)) return "Use a mix of letters and numbers.";
  return null;
}

/** "required" (default) forces every admin to enrol in 2FA before using the dashboard. */
export function twoFactorRequired() {
  return (process.env.ADMIN_2FA || "required") !== "optional";
}

export async function createAdminSession(userId: string, pending2fa: boolean) {
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + (pending2fa ? PENDING_TTL_MS : SESSION_TTL_MS));
  await prisma.adminSession.create({
    data: { tokenHash: sha(token), userId, pending2fa, expiresAt, ip: await clientIp(), userAgent: await clientUserAgent() },
  });
  (await cookies()).set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    expires: expiresAt,
  });
}

async function readSession() {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!token) return null;
  const s = await prisma.adminSession.findUnique({
    where: { tokenHash: sha(token) },
    include: { user: { select: { id: true, email: true, name: true, role: true, totpEnabled: true, active: true } } },
  });
  if (!s || s.expiresAt < new Date() || !s.user.active) return null;
  return s;
}

export async function getAdmin(): Promise<AdminSessionUser | null> {
  const s = await readSession();
  if (!s || s.pending2fa) return null;
  const { active: _a, ...u } = s.user;
  return u;
}

export async function getPending2fa() {
  const s = await readSession();
  return s?.pending2fa ? s : null;
}

export async function destroyAdminSession() {
  const jar = await cookies();
  const token = jar.get(ADMIN_COOKIE)?.value;
  if (token) await prisma.adminSession.deleteMany({ where: { tokenHash: sha(token) } });
  jar.delete(ADMIN_COOKIE);
}

export async function destroyOtherAdminSessions(userId: string) {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  await prisma.adminSession.deleteMany({ where: { userId, ...(token ? { tokenHash: { not: sha(token) } } : {}) } });
}

/** For pages: redirect to sign-in / 2FA enrolment / the role's home when not allowed. */
export async function requireAdmin(p: Permission, opts: { allowWithout2fa?: boolean } = {}): Promise<AdminSessionUser> {
  const user = await getAdmin();
  if (!user) redirect("/admin/login");
  if (!opts.allowWithout2fa && twoFactorRequired() && !user.totpEnabled) redirect("/admin/security?enrol=1");
  if (!can(user, p)) redirect(`${homeFor(user.role)}?denied=1`);
  return user;
}

/** For server actions and route handlers: throws instead of redirecting. */
export async function assertAdmin(p: Permission): Promise<AdminSessionUser> {
  const user = await getAdmin();
  if (!user) throw new AuthError("Please sign in again.", 401);
  if (twoFactorRequired() && !user.totpEnabled) throw new AuthError("Set up two-factor authentication first.", 403);
  if (!can(user, p)) throw new AuthError("Your role doesn't allow that.", 403);
  return user;
}

export class AuthError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
