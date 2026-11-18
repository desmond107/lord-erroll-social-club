"use server";

import { prisma } from "@/lib/db";
import { assertAdmin, AuthError } from "@/lib/admin-auth";
import { parseCardNumber, baseOf } from "@/lib/numbers";
import { getSettings } from "@/lib/settings";
import { effectiveStatus, EFFECTIVE_LABEL, isValidForEntry } from "@/lib/membership";
import { ageOn } from "@/lib/age";
import { fmtDate } from "@/lib/format";
import { audit } from "@/lib/audit";

export type VerifyResult =
  | { error: string }
  | {
      ok: boolean;
      statusLabel: string;
      number: string;
      packageName: string;
      expires: string;
      holders: { name: string; cardNumber: string; relationship: string; under18: boolean; active: boolean; photoId: string | null; token: string }[];
      junior: boolean;
    }
  | null;

export async function verifyByNumber(_: VerifyResult, fd: FormData): Promise<VerifyResult> {
  let user;
  try {
    user = await assertAdmin("verify");
  } catch (e) {
    return { error: e instanceof AuthError ? e.message : "Please sign in again." };
  }
  const card = parseCardNumber(String(fd.get("number") || ""));
  if (!card) return { error: "Enter a number like LE-2026-000123." };
  const m = await prisma.membership.findUnique({ where: { number: baseOf(card) }, include: { package: true, cardholders: { orderBy: { suffix: "asc" } } } });
  if (!m) return { error: "No membership with that number." };
  const holders = card === m.number ? m.cardholders : m.cardholders.filter((c) => c.cardNumber === card);
  if (!holders.length) return { error: "No card with that number." };
  const { graceDays } = await getSettings();
  const st = effectiveStatus(m, graceDays);
  await audit(user, "verify.lookup", "Membership", m.id, { card, status: st });
  return {
    ok: isValidForEntry(st),
    statusLabel: EFFECTIVE_LABEL[st],
    number: card,
    packageName: m.isJunior ? "Junior" : m.package.name,
    expires: fmtDate(m.expiresAt),
    junior: m.isJunior,
    holders: holders.map((c) => ({ name: c.fullName, cardNumber: c.cardNumber, relationship: c.relationship, under18: ageOn(c.dateOfBirth) < 18, active: c.active, photoId: c.photoId, token: c.verifyToken })),
  };
}
