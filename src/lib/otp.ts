import "server-only";
import crypto from "crypto";
import { prisma } from "./db";
import { authSecret } from "./request";

const TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

const hashCode = (purpose: string, subject: string, code: string) =>
  crypto.createHmac("sha256", authSecret()).update(`${purpose}:${subject}:${code}`).digest("hex");

/** Issues a fresh 6-digit code, invalidating earlier unused codes for the same subject. */
export async function issueOtp(purpose: "login" | "lookup", subject: string) {
  const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
  await prisma.$transaction([
    prisma.otpCode.updateMany({ where: { purpose, subject, usedAt: null }, data: { usedAt: new Date() } }),
    prisma.otpCode.create({
      data: { purpose, subject, codeHash: hashCode(purpose, subject, code), expiresAt: new Date(Date.now() + TTL_MS) },
    }),
  ]);
  return code;
}

export type OtpResult = "ok" | "invalid" | "expired" | "locked";

export async function checkOtp(purpose: "login" | "lookup", subject: string, code: string): Promise<OtpResult> {
  const row = await prisma.otpCode.findFirst({
    where: { purpose, subject, usedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!row) return "expired";
  if (row.expiresAt < new Date()) return "expired";
  if (row.attempts >= MAX_ATTEMPTS) return "locked";
  const want = Buffer.from(row.codeHash, "hex");
  const got = Buffer.from(hashCode(purpose, subject, code.replace(/\D/g, "")), "hex");
  if (want.length === got.length && crypto.timingSafeEqual(want, got)) {
    await prisma.otpCode.update({ where: { id: row.id }, data: { usedAt: new Date() } });
    return "ok";
  }
  const attempts = row.attempts + 1;
  await prisma.otpCode.update({ where: { id: row.id }, data: { attempts } });
  return attempts >= MAX_ATTEMPTS ? "locked" : "invalid";
}

/**
 * Signed, short-lived token proving a lookup OTP was passed for one membership number.
 * Stored in an httpOnly cookie by the lookup page.
 */
export function signLookupGrant(number: string, ttlMs = 15 * 60 * 1000) {
  const exp = Date.now() + ttlMs;
  const payload = `${number}|${exp}`;
  const mac = crypto.createHmac("sha256", authSecret()).update(`grant:${payload}`).digest("base64url");
  return `${Buffer.from(payload).toString("base64url")}.${mac}`;
}

export function readLookupGrant(token: string | undefined): string | null {
  if (!token) return null;
  const [p, mac] = token.split(".");
  if (!p || !mac) return null;
  const payload = Buffer.from(p, "base64url").toString();
  const want = crypto.createHmac("sha256", authSecret()).update(`grant:${payload}`).digest("base64url");
  if (want.length !== mac.length || !crypto.timingSafeEqual(Buffer.from(want), Buffer.from(mac))) return null;
  const [number, exp] = payload.split("|");
  return Number(exp) > Date.now() ? number : null;
}
