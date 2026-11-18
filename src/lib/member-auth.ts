import "server-only";
import crypto from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "./db";
import { clientIp, clientUserAgent } from "./request";

export const MEMBER_COOKIE = "le_member";
const TTL_MS = 30 * 24 * 3600 * 1000;
const sha = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

export async function createMemberSession(accountId: string) {
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + TTL_MS);
  await prisma.memberSession.create({
    data: { tokenHash: sha(token), accountId, expiresAt, ip: await clientIp(), userAgent: await clientUserAgent() },
  });
  await prisma.account.update({ where: { id: accountId }, data: { lastLoginAt: new Date() } });
  (await cookies()).set(MEMBER_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function getAccount() {
  const token = (await cookies()).get(MEMBER_COOKIE)?.value;
  if (!token) return null;
  const s = await prisma.memberSession.findUnique({ where: { tokenHash: sha(token) }, include: { account: true } });
  if (!s || s.expiresAt < new Date()) return null;
  return s.account;
}

export async function requireAccount() {
  const a = await getAccount();
  if (!a) redirect("/account/login");
  return a;
}

export async function destroyMemberSession() {
  const jar = await cookies();
  const token = jar.get(MEMBER_COOKIE)?.value;
  if (token) await prisma.memberSession.deleteMany({ where: { tokenHash: sha(token) } });
  jar.delete(MEMBER_COOKIE);
}
