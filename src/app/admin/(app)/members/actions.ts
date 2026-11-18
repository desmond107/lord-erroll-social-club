"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { guarded, int, str, InputError, type ActionResult } from "@/lib/admin-action";
import { confirmPayment, createPayment, extendMembership, quote, setSuspended } from "@/lib/membership";
import { encrypt, emailIdx, normEmail, normPhone, phoneIdx, randomToken } from "@/lib/crypto";
import { parseDob } from "@/lib/age";
import { audit } from "@/lib/audit";

const done = (id: string) => revalidatePath(`/admin/members/${id}`);

export async function suspend(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return guarded("members.edit", async (u) => {
    const reason = str(fd, "reason", 500);
    if (reason.length < 3) throw new InputError("Please give a reason.");
    await setSuspended(str(fd, "id"), u, true, reason);
    done(str(fd, "id"));
    return "Membership suspended; the card is now invalid.";
  });
}

export async function reinstate(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return guarded("members.edit", async (u) => {
    await setSuspended(str(fd, "id"), u, false, str(fd, "reason", 500));
    done(str(fd, "id"));
    return "Membership reinstated.";
  });
}

export async function extend(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return guarded("members.edit", async (u) => {
    const days = int(fd, "days");
    if (days < 1 || days > 730) throw new InputError("Extend by 1 to 730 days.");
    const reason = str(fd, "reason", 500);
    if (reason.length < 3) throw new InputError("Please give a reason.");
    await extendMembership(str(fd, "id"), u, days, reason);
    done(str(fd, "id"));
    return `Extended by ${days} days.`;
  });
}

export async function editAccount(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return guarded("members.edit", async (u) => {
    const id = str(fd, "membershipId");
    const m = await prisma.membership.findUniqueOrThrow({ where: { id } });
    const fullName = str(fd, "fullName", 120);
    const email = str(fd, "email", 160);
    const phone = str(fd, "phone", 30);
    if (fullName.length < 3) throw new InputError("Enter the full name.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new InputError("Enter a valid email.");
    if (!/^\d{9,15}$/.test(normPhone(phone))) throw new InputError("Enter a valid phone number.");
    const eIdx = emailIdx(email);
    const pIdx = phoneIdx(phone);
    const clash = await prisma.account.findFirst({ where: { id: { not: m.accountId }, OR: [{ emailIdx: eIdx }, { phoneIdx: pIdx }] } });
    if (clash) throw new InputError("That email or phone already belongs to another member account.");
    await prisma.account.update({
      where: { id: m.accountId },
      data: { fullName, emailEnc: encrypt(normEmail(email)), emailIdx: eIdx, phoneEnc: encrypt(normPhone(phone)), phoneIdx: pIdx },
    });
    if (!m.isJunior) await prisma.cardholder.updateMany({ where: { membershipId: id, suffix: "" }, data: { fullName, displayName: fullName } });
    await audit(u, "account.edit", "Account", m.accountId, { fields: ["fullName", "email", "phone"] });
    done(id);
    return "Account details updated.";
  });
}

export async function editCardholder(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return guarded("members.edit", async (u) => {
    const id = str(fd, "cardholderId");
    const c = await prisma.cardholder.findUniqueOrThrow({ where: { id }, include: { membership: true } });
    const fullName = str(fd, "fullName", 120);
    const dob = parseDob(str(fd, "dateOfBirth", 10));
    if (fullName.length < 2 || !dob) throw new InputError("Enter a name and a valid date of birth.");
    await prisma.cardholder.update({
      where: { id },
      data: { fullName, displayName: c.suffix === "J" ? fullName.split(" ")[0] : fullName, dateOfBirth: dob, relationship: str(fd, "relationship", 40) || c.relationship },
    });
    await audit(u, "cardholder.edit", "Cardholder", id, {});
    done(c.membershipId);
    return "Card holder updated.";
  });
}

export async function toggleCard(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return guarded("members.edit", async (u) => {
    const id = str(fd, "cardholderId");
    const c = await prisma.cardholder.findUniqueOrThrow({ where: { id } });
    await prisma.cardholder.update({ where: { id }, data: { active: !c.active } });
    await audit(u, c.active ? "cardholder.deactivate" : "cardholder.activate", "Cardholder", id, {});
    done(c.membershipId);
    return c.active ? "Card deactivated." : "Card reactivated.";
  });
}

/** Issues a new QR token: any old printed or downloaded card stops verifying. */
export async function rotateQr(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return guarded("members.edit", async (u) => {
    const id = str(fd, "cardholderId");
    const c = await prisma.cardholder.update({ where: { id }, data: { verifyToken: randomToken(18) } });
    await audit(u, "cardholder.rotate_qr", "Cardholder", id, {});
    done(c.membershipId);
    return "New QR code issued. Previously downloaded cards no longer verify.";
  });
}

/** Records a cash or bank payment confirmed by the accounts team (manual fallback). */
export async function recordManualPayment(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return guarded("payments.confirm", async (u) => {
    const id = str(fd, "id");
    const method = str(fd, "method") === "BANK" ? "BANK" : "CASH";
    const reference = str(fd, "reference", 80);
    if (reference.length < 3) throw new InputError("Enter the bank reference or cash receipt number.");
    const q = await quote(id, str(fd, "packageId") || undefined);
    const amount = int(fd, "amount");
    if (amount !== q.amount) throw new InputError(`The amount due for ${q.pkg.name} (${q.purpose.toLowerCase()}) is KES ${q.amount.toLocaleString()}. Enter that exact amount.`);
    const pay = await createPayment(id, q, method, { providerRef: `MAN-${method}-${reference}-${Date.now()}`, note: str(fd, "note", 300) || null });
    await confirmPayment(pay.id, { providerTxnId: `${method}-${reference}`, confirmedBy: u, note: str(fd, "note", 300) || undefined });
    done(id);
    revalidatePath("/admin/payments");
    return `Payment recorded and receipt sent.`;
  });
}
