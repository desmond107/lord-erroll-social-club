import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { addDays } from "./format";
import { notifyAccount } from "./membership";
import * as mails from "./emails";

export type Audience = "active" | "expiring" | "expired" | "pending_payment";

export type AudienceFilter = { audience: Audience; days?: number; packageSlugs: string[]; adultOnly: boolean; marketingOnly: boolean };

/**
 * Memberships matching an audience. Messages go to the account holder (the guardian for
 * a Junior), never to a child. Adult-only content never targets Junior memberships, and
 * marketing goes only to accounts that opted in.
 */
export function audienceWhere(f: AudienceFilter): Prisma.MembershipWhereInput {
  const now = new Date();
  const and: Prisma.MembershipWhereInput[] = [];
  if (f.audience === "active") and.push({ status: "ACTIVE" });
  if (f.audience === "expiring") and.push({ status: "ACTIVE", expiresAt: { gte: now, lte: addDays(now, f.days ?? 30) } });
  if (f.audience === "expired") and.push({ status: { in: ["EXPIRED", "LAPSED"] } });
  if (f.audience === "pending_payment") and.push({ status: "PENDING_PAYMENT" });
  if (f.packageSlugs.length) and.push({ package: { slug: { in: f.packageSlugs } } });
  if (f.adultOnly) and.push({ isJunior: false });
  if (f.marketingOnly) and.push({ account: { marketingOk: true } });
  return { AND: and };
}

export async function audienceCount(f: AudienceFilter) {
  const rows = await prisma.membership.findMany({ where: audienceWhere(f), select: { accountId: true } });
  return new Set(rows.map((r) => r.accountId)).size;
}

/** Sends with modest concurrency so providers aren't flooded. Returns the number of accounts messaged. */
export async function sendToAudience(f: AudienceFilter, build: (m: { number: string; expiresAt: Date | null; account: { fullName: string } }) => mails.Mail, kind: string, channels: string[]) {
  const ms = await prisma.membership.findMany({ where: audienceWhere(f), include: { account: true }, orderBy: { createdAt: "asc" } });
  const seen = new Set<string>();
  const queue = ms.filter((m) => (seen.has(m.accountId) ? false : (seen.add(m.accountId), true)));
  let i = 0;
  const worker = async () => {
    while (i < queue.length) {
      const m = queue[i++];
      await notifyAccount(m.account, build(m), kind, channels);
    }
  };
  await Promise.all(Array.from({ length: 4 }, worker));
  return queue.length;
}
