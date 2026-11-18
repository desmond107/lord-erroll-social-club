"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { guarded, str, InputError, type ActionResult } from "@/lib/admin-action";
import { approveApplication, rejectApplication, requestInfo } from "@/lib/membership";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";

export async function approve(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return guarded("applications", async (u) => {
    const m = await approveApplication(str(fd, "id"), u, str(fd, "note", 1000) || undefined);
    revalidatePath("/admin/applications");
    redirect(`/admin/applications/${str(fd, "id")}?done=approved`);
    return `Approved: ${m.number}`;
  });
}

export async function reject(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return guarded("applications", async (u) => {
    const reason = str(fd, "reason", 1000);
    if (reason.length < 3) throw new InputError("Please give a reason (it is shared politely with the applicant).");
    await rejectApplication(str(fd, "id"), u, reason, str(fd, "note", 1000) || undefined);
    revalidatePath("/admin/applications");
    redirect(`/admin/applications/${str(fd, "id")}?done=rejected`);
  });
}

export async function askInfo(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return guarded("applications", async (u) => {
    const msg = str(fd, "message", 1500);
    if (msg.length < 5) throw new InputError("Please write the question for the applicant.");
    await requestInfo(str(fd, "id"), u, msg);
    revalidatePath("/admin/applications");
    redirect(`/admin/applications/${str(fd, "id")}?done=info`);
  });
}

export async function saveNote(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return guarded("applications", async (u) => {
    const id = str(fd, "id");
    await prisma.application.update({ where: { id }, data: { adminNote: str(fd, "note", 2000) || null } });
    await audit(u, "application.note", "Application", id);
    revalidatePath(`/admin/applications/${id}`);
    return "Note saved.";
  });
}
