import "server-only";
import { prisma } from "../db";
import { confirmPayment, failPayment, MembershipError } from "../membership";
import { parseCallback, stkQuery, type StkCallback } from "./mpesa";

/** Shared by the real callback route and the dev simulator. */
export async function handleStkCallback(body: StkCallback): Promise<{ ok: boolean; message: string }> {
  const cb = parseCallback(body);
  if (!cb) return { ok: false, message: "Malformed callback" };
  const pay = await prisma.payment.findUnique({ where: { providerRef: cb.checkoutRequestId } });
  if (!pay || pay.method !== "MPESA") return { ok: false, message: "Unknown CheckoutRequestID" };
  if (pay.status === "PAID") return { ok: true, message: "Already processed" };

  if (cb.resultCode !== 0) {
    await failPayment(pay.id, cb.resultDesc || `M-Pesa result ${cb.resultCode}`, JSON.parse(JSON.stringify(body)));
    return { ok: true, message: "Recorded failure" };
  }
  if (cb.amount == null || cb.amount !== pay.amountKes) {
    await failPayment(pay.id, `Amount mismatch (got ${cb.amount}, expected ${pay.amountKes}). Needs manual review.`, JSON.parse(JSON.stringify(body)));
    return { ok: false, message: "Amount mismatch" };
  }
  if (!cb.receipt) return { ok: false, message: "No receipt number" };

  // Never trust the callback alone: ask Safaricom.
  const confirmed = await stkQuery(cb.checkoutRequestId).catch(() => null);
  if (confirmed !== "0") {
    console.warn("[mpesa] callback said paid but STK query returned", confirmed, "for", pay.id);
    // Keep the callback; the status poll (recheckPending) retries the query later.
    await prisma.payment.update({ where: { id: pay.id }, data: { rawCallback: JSON.parse(JSON.stringify(body)) } });
    return { ok: false, message: "Not confirmed by STK query yet" };
  }
  try {
    await confirmPayment(pay.id, { providerTxnId: cb.receipt, rawCallback: JSON.parse(JSON.stringify(body)), amountKes: cb.amount });
  } catch (e) {
    if (e instanceof MembershipError) return { ok: false, message: e.message };
    throw e;
  }
  return { ok: true, message: "Confirmed" };
}

/** Called by the payment-status poll: retries verification of a stored, unconfirmed callback. */
export async function recheckPending(paymentId: string) {
  const pay = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!pay || pay.status !== "PENDING" || pay.method !== "MPESA" || !pay.rawCallback) return;
  if (Date.now() - pay.createdAt.getTime() < 15000) return;
  await handleStkCallback(pay.rawCallback as StkCallback).catch((e) => console.error("[mpesa] recheck failed", e));
}
