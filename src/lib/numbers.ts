import "server-only";
import crypto from "crypto";
import type { Prisma } from "@prisma/client";

/**
 * Membership numbers: LE-<year>-<6 digits>. The digits are random (not sequential),
 * so numbers can't be guessed by counting, and every issued number is recorded in
 * IssuedNumber, so a number is never reused even after a member is erased.
 * Only ever called on the server inside the approval transaction.
 */
export async function issueMembershipNumber(tx: Prisma.TransactionClient, year = new Date().getUTCFullYear()) {
  for (let i = 0; i < 25; i++) {
    const n = crypto.randomInt(100000, 1000000);
    const number = `LE-${year}-${n.toString().padStart(6, "0")}`;
    const taken = await tx.issuedNumber.findUnique({ where: { number } });
    if (taken) continue;
    await tx.issuedNumber.create({ data: { number } });
    return number;
  }
  throw new Error("Could not allocate a membership number");
}

/** Family suffixes for linked members, in order. */
export const FAMILY_SUFFIXES = ["A", "B", "C", "D", "E", "F", "G", "H"];

export const cardNumberOf = (base: string, suffix: string) => (suffix ? `${base}-${suffix}` : base);

/** Accepts "le-2026-483920", "LE 2026 483920 a", etc. Returns a canonical card number or null. */
export function parseCardNumber(input: string): string | null {
  const s = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const m = /^LE(\d{4})(\d{6})([A-HJ])?$/.exec(s);
  if (!m) return null;
  return `LE-${m[1]}-${m[2]}${m[3] ? `-${m[3]}` : ""}`;
}

export const baseOf = (cardNumber: string) => cardNumber.split("-").slice(0, 3).join("-");

/** Next sequential receipt number, e.g. RCT-2026-00042 (receipts may be sequential). */
export async function nextReceiptNo(tx: Prisma.TransactionClient, year = new Date().getUTCFullYear()) {
  const key = `receipt:${year}`;
  const row = await tx.counter.upsert({ where: { key }, create: { key, value: 1 }, update: { value: { increment: 1 } } });
  return `RCT-${year}-${row.value.toString().padStart(5, "0")}`;
}

export function applicationRef() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += alphabet[crypto.randomInt(alphabet.length)];
  return `APP-${s}`;
}
