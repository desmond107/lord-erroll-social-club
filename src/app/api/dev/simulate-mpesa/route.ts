import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { simulateEnabled } from "@/lib/payments/mpesa";
import { handleStkCallback } from "@/lib/payments/mpesa-handler";
import { getAccount } from "@/lib/member-auth";
import { sameOrigin } from "@/lib/request";

export const dynamic = "force-dynamic";

/**
 * DEVELOPMENT ONLY. Plays the part of Safaricom: builds a realistic STK callback for a
 * simulated payment and feeds it through the same handler as the real callback route.
 * 404 unless PAYMENTS_SIMULATE=1 and NODE_ENV is not production.
 */
export async function POST(req: Request) {
  if (!simulateEnabled()) return new NextResponse("Not found", { status: 404 });
  const { paymentId, ok, e2eKey } = (await req.json()) as { paymentId: string; ok: boolean; e2eKey?: string };
  const pay = await prisma.payment.findUnique({ where: { id: paymentId }, include: { membership: true } });
  if (!pay || !pay.providerRef?.startsWith("SIM-")) return NextResponse.json({ error: "not a simulated payment" }, { status: 400 });
  // Browser: must be the payer on our origin. Script (e2e): must present the cron secret.
  const scripted = !!e2eKey && e2eKey === process.env.CRON_SECRET;
  if (!scripted) {
    const acct = await getAccount();
    if (!sameOrigin(req) || !acct || acct.id !== pay.membership.accountId) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const body = {
    Body: {
      stkCallback: {
        MerchantRequestID: "SIM",
        CheckoutRequestID: pay.providerRef,
        ResultCode: ok ? 0 : 1032,
        ResultDesc: ok ? "The service request is processed successfully." : "Request cancelled by user",
        CallbackMetadata: ok
          ? { Item: [{ Name: "Amount", Value: pay.amountKes }, { Name: "MpesaReceiptNumber", Value: `SIM${crypto.randomBytes(4).toString("hex").toUpperCase()}` }, { Name: "PhoneNumber", Value: 254700000000 }] }
          : undefined,
      },
    },
  };
  return NextResponse.json(await handleStkCallback(body));
}
