"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { guarded, str, InputError, type ActionResult } from "@/lib/admin-action";
import { eraseAccount, eraseCardholder } from "@/lib/erasure";
import { audit } from "@/lib/audit";

export async function resolveRequest(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return guarded("members.edit", async (u) => {
    const id = str(fd, "id");
    const resolution = str(fd, "resolution", 500);
    if (resolution.length < 3) throw new InputError("Describe what was done.");
    await prisma.dataRequest.update({ where: { id }, data: { status: "DONE", resolution, resolvedAt: new Date() } });
    await audit(u, "data_request.resolve", "DataRequest", id, { resolution });
    revalidatePath("/admin/data-requests");
    return "Marked as done.";
  });
}

/** Irreversible: erases the subject's personal data. Super Admin only. */
export async function erase(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return guarded("documents.sensitive", async (u) => {
    const id = str(fd, "id");
    if (str(fd, "confirm") !== "ERASE") throw new InputError('Type ERASE to confirm.');
    const r = await prisma.dataRequest.findUniqueOrThrow({ where: { id } });
    if (r.type !== "DELETION") throw new InputError("Only deletion requests can erase data.");
    if (r.subject === "self") await eraseAccount(r.accountId);
    else await eraseCardholder(r.subject);
    await prisma.dataRequest.update({ where: { id }, data: { status: "DONE", resolution: "Personal data erased", resolvedAt: new Date() } });
    await audit(u, "data_request.erase", "DataRequest", id, { subject: r.subject === "self" ? "account" : "cardholder" });
    revalidatePath("/admin/data-requests");
    return "Personal data erased. Payment records are kept under an anonymised name.";
  });
}
