import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAccount } from "@/lib/member-auth";
import { recheckPending } from "@/lib/payments/mpesa-handler";

export const dynamic = "force-dynamic";

/** Polled by the payment page. Only the membership's own account can read it. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const account = await getAccount();
  if (!account) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const pay = await prisma.payment.findUnique({ where: { id }, include: { membership: { select: { accountId: true } } } });
  if (!pay || pay.membership.accountId !== account.id) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (pay.status === "PENDING") await recheckPending(pay.id);
  const fresh = await prisma.payment.findUniqueOrThrow({ where: { id } });
  return NextResponse.json(
    { status: fresh.status, reason: fresh.status === "FAILED" ? fresh.failureReason : undefined },
    { headers: { "Cache-Control": "no-store" } },
  );
}
