import "server-only";
import { headers } from "next/headers";
import crypto from "crypto";

export async function clientIp() {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || "unknown").slice(0, 64);
}

export async function clientUserAgent() {
  return ((await headers()).get("user-agent") || "").slice(0, 300);
}

/** The server secret. A missing one in production would make sessions and OTPs forgeable. */
export function authSecret() {
  const s = process.env.AUTH_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build") {
    throw new Error("AUTH_SECRET is not set.");
  }
  return "dev-only-secret";
}

/** IPs are never stored raw in rate-limit keys. */
export function hashIp(ip: string) {
  return crypto.createHmac("sha256", authSecret()).update(`ip:${ip}`).digest("hex").slice(0, 32);
}

export function appUrl() {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

/**
 * CSRF guard for route handlers that accept POSTs from our own pages.
 * (Server actions get Next's built-in Origin check.) Webhooks don't use this.
 */
export function sameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  try {
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
