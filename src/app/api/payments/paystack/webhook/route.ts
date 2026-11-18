import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { signatureValid, verify } from "@/lib/payments/paystack";
import { confirmPayment, MembershipError } from "@/lib/membership";

export const dynamic = "force-dynamic";

/** Paystack webhook: HMAC-SHA512 signature check, then API re-verification, then apply. */
export async function POST(req: Request) {
  const raw = await req.text();
  if (!signatureValid(raw, req.headers.get("x-paystack-signature"))) return new NextResponse("Invalid signature", { status: 401 });
  const evt = JSON.parse(raw) as { event: string; data?: { reference?: string } };
  if (evt.event !== "charge.success" || !evt.data?.reference) return NextResponse.json({ ok: true });
  const pay = await prisma.payment.findUnique({ where: { providerRef: evt.data.reference } });
  if (!pay || pay.method !== "CARD" || pay.status === "PAID") return NextResponse.json({ ok: true });
  const v = await verify(evt.data.reference);
  if (!v?.paid || v.currency !== "KES" || v.amountKes !== pay.amountKes) {
    console.warn("[paystack] webhook failed verification for", pay.id);
    return NextResponse.json({ ok: true });
  }
  try {
    await confirmPayment(pay.id, { providerTxnId: `PSK-${v.txnId}`, amountKes: v.amountKes });
  } catch (e) {
    if (!(e instanceof MembershipError)) throw e;
    console.warn("[paystack]", e.message);
  }
  return NextResponse.json({ ok: true });
}
