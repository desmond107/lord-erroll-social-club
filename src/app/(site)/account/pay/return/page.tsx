import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAccount } from "@/lib/member-auth";
import { verify } from "@/lib/payments/paystack";
import { confirmPayment, failPayment } from "@/lib/membership";

/** Paystack redirects here after card payment; we verify with Paystack before applying it. */
export default async function PayReturn({ searchParams }: { searchParams: Promise<{ reference?: string }> }) {
  const account = await requireAccount();
  const { reference } = await searchParams;
  const pay = reference ? await prisma.payment.findUnique({ where: { providerRef: reference }, include: { membership: true } }) : null;
  let ok = false;
  let msg = "We couldn't find that payment.";
  if (pay && pay.membership.accountId === account.id) {
    if (pay.status === "PAID") ok = true;
    else {
      const v = await verify(pay.providerRef!).catch(() => null);
      if (v?.paid && v.currency === "KES" && v.amountKes === pay.amountKes) {
        await confirmPayment(pay.id, { providerTxnId: `PSK-${v.txnId}`, amountKes: v.amountKes });
        ok = true;
      } else if (v && !v.paid) {
        await failPayment(pay.id, "Card payment not completed");
        msg = "The card payment was not completed.";
      } else msg = "We're still confirming your payment. It will appear in your account shortly.";
    }
  }
  return (
    <section className="bg-vignette flex min-h-screen items-center justify-center px-4 pt-[72px]">
      <div className="max-w-md text-center">
        <h1 className="display text-[2.4rem]">{ok ? "Payment received" : "Payment status"}</h1>
        <p className="mt-4 text-on-dark/85">{ok ? "Thank you. Your receipt is on its way and your card is active." : msg}</p>
        <Link href="/account" className="btn btn-gold mt-8">Go to my account</Link>
      </div>
    </section>
  );
}
