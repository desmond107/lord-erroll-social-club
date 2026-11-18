import "server-only";
import crypto from "crypto";

/**
 * Paystack card payments (Kenya, KES). Card details never touch our servers: the member
 * pays on Paystack's hosted page. Webhooks are verified with the HMAC-SHA512 signature
 * and the transaction is re-verified with the API before it is applied.
 */

export const paystackConfigured = () => !!process.env.PAYSTACK_SECRET_KEY;

const key = () => process.env.PAYSTACK_SECRET_KEY!;

export async function initialize(opts: { email: string; amountKes: number; reference: string; callbackUrl: string; membership: string }) {
  const res = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: { Authorization: `Bearer ${key()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: opts.email,
      amount: opts.amountKes * 100,
      currency: "KES",
      reference: opts.reference,
      callback_url: opts.callbackUrl,
      channels: ["card"],
      metadata: { membership: opts.membership },
    }),
    signal: AbortSignal.timeout(20000),
  });
  const j = (await res.json()) as { status: boolean; message: string; data?: { authorization_url: string } };
  if (!res.ok || !j.status || !j.data) throw new Error(j.message || "Card payment could not be started");
  return j.data.authorization_url;
}

export async function verify(reference: string) {
  const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${key()}` },
    signal: AbortSignal.timeout(20000),
  });
  const j = (await res.json()) as { status: boolean; data?: { status: string; amount: number; currency: string; id: number; reference: string } };
  if (!res.ok || !j.status || !j.data) return null;
  return { paid: j.data.status === "success", amountKes: j.data.amount / 100, currency: j.data.currency, txnId: String(j.data.id) };
}

export function signatureValid(rawBody: string, signature: string | null) {
  if (!signature || !paystackConfigured()) return false;
  const want = crypto.createHmac("sha512", key()).update(rawBody).digest("hex");
  return want.length === signature.length && crypto.timingSafeEqual(Buffer.from(want), Buffer.from(signature));
}
