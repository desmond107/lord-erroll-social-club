"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAccount } from "@/lib/member-auth";
import { createPayment, MembershipError, quote } from "@/lib/membership";
import { stkPush, mpesaConfigured, simulateEnabled } from "@/lib/payments/mpesa";
import { initialize, paystackConfigured } from "@/lib/payments/paystack";
import { normPhone, phoneIdx, decryptOr } from "@/lib/crypto";
import { rateLimit } from "@/lib/ratelimit";
import { appUrl } from "@/lib/request";
import { audit } from "@/lib/audit";

export type PayState = { error?: string; paymentId?: string; simulated?: boolean } | null;

export async function startPayment(_: PayState, fd: FormData): Promise<PayState> {
  const account = await requireAccount();
  const membershipId = String(fd.get("membershipId"));
  const packageId = String(fd.get("packageId") || "") || undefined;
  const method = fd.get("method") === "CARD" ? "CARD" : "MPESA";

  const m = await prisma.membership.findUnique({ where: { id: membershipId } });
  if (!m || m.accountId !== account.id) return { error: "Membership not found." };
  if (!(await rateLimit(`pay:${account.id}`, 8, 900)).ok) return { error: "Too many payment attempts. Please wait a few minutes." };

  let q;
  try {
    q = await quote(m.id, packageId);
  } catch (e) {
    if (e instanceof MembershipError) return { error: e.message };
    throw e;
  }
  if (q.amount <= 0) return { error: "There is nothing to pay for that change." };

  if (method === "MPESA") {
    const phone = normPhone(String(fd.get("phone") || ""));
    if (!/^254(7|1)\d{8}$/.test(phone)) return { error: "Enter a Safaricom number, e.g. 0712 345 678." };
    if (!mpesaConfigured() && !simulateEnabled()) return { error: "M-Pesa payments are not available yet. Please contact the club." };
    const pay = await createPayment(m.id, q, "MPESA", { payerPhoneIdx: phoneIdx(phone) });
    try {
      const r = await stkPush({ phone, amount: q.amount, accountRef: m.number.replace(/-/g, "").slice(-12), description: "Membership" });
      await prisma.payment.update({ where: { id: pay.id }, data: { providerRef: r.checkoutRequestId } });
      await audit("member", "payment.stk_sent", "Payment", pay.id, { amount: q.amount, purpose: q.purpose });
      return { paymentId: pay.id, simulated: r.simulated };
    } catch (e) {
      await prisma.payment.update({ where: { id: pay.id }, data: { status: "FAILED", failureReason: String(e).slice(0, 300) } });
      return { error: "We couldn't reach M-Pesa. Please try again in a moment." };
    }
  }

  if (!paystackConfigured()) return { error: "Card payments are not available yet. Please use M-Pesa or contact the club." };
  const pay = await createPayment(m.id, q, "CARD");
  await prisma.payment.update({ where: { id: pay.id }, data: { providerRef: pay.id } });
  let url: string;
  try {
    url = await initialize({ email: decryptOr(account.emailEnc), amountKes: q.amount, reference: pay.id, callbackUrl: `${appUrl()}/account/pay/return`, membership: m.number });
  } catch {
    await prisma.payment.update({ where: { id: pay.id }, data: { status: "FAILED", failureReason: "Initialize failed" } });
    return { error: "Card payment could not be started. Please try again." };
  }
  redirect(url);
}
