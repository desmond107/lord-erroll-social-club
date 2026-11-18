"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { guarded, str, InputError, type ActionResult } from "@/lib/admin-action";
import { confirmPayment } from "@/lib/membership";
import { audit } from "@/lib/audit";

/** Manual fallback: the accountant has seen the money (e.g. the M-Pesa statement) but no callback arrived. */
export async function confirmPending(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return guarded("payments.confirm", async (u) => {
    const ref = str(fd, "reference", 60).toUpperCase();
    if (ref.length < 4) throw new InputError("Enter the M-Pesa receipt or bank reference you checked.");
    const ok = await confirmPayment(str(fd, "id"), { providerTxnId: ref, confirmedBy: u, note: "Confirmed manually" });
    if (!ok) throw new InputError("That payment is no longer pending.");
    revalidatePath("/admin/payments");
    return "Payment confirmed; receipt sent.";
  });
}

export async function cancelPending(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return guarded("payments.confirm", async (u) => {
    const id = str(fd, "id");
    const r = await prisma.payment.updateMany({ where: { id, status: "PENDING" }, data: { status: "CANCELLED", failureReason: `Cancelled by ${u.name}` } });
    if (!r.count) throw new InputError("That payment is no longer pending.");
    await audit(u, "payment.cancel", "Payment", id);
    revalidatePath("/admin/payments");
    return "Payment cancelled.";
  });
}
