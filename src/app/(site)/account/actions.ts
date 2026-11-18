"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { requireAccount } from "@/lib/member-auth";
import { acceptJuniorHandover, MembershipError, startJuniorHandover } from "@/lib/membership";
import { audit } from "@/lib/audit";
import { rateLimit } from "@/lib/ratelimit";
import { adminNotifyEmails, sendEmail } from "@/lib/notify";

export type FormState = { ok?: string; error?: string } | null;

export async function updateProfile(_: FormState, fd: FormData): Promise<FormState> {
  const a = await requireAccount();
  const marketingOk = fd.get("marketing") === "on";
  const pw = String(fd.get("password") || "");
  const data: { marketingOk: boolean; passwordHash?: string } = { marketingOk };
  if (pw) {
    if (pw.length < 10 || !/[a-zA-Z]/.test(pw) || !/\d/.test(pw)) return { error: "Passwords need at least 10 characters, with letters and numbers." };
    if (pw !== fd.get("password2")) return { error: "The two passwords don't match." };
    data.passwordHash = await bcrypt.hash(pw, 12);
  }
  await prisma.account.update({ where: { id: a.id }, data });
  // A new password signs the account out everywhere, including here.
  if (pw) await prisma.memberSession.deleteMany({ where: { accountId: a.id } });
  await audit("member", pw ? "account.password_set" : "account.preferences", "Account", a.id, { marketingOk });
  if (pw) redirect("/account/login?next=/account/profile");
  revalidatePath("/account/profile");
  return { ok: "Saved." };
}

export async function requestData(_: FormState, fd: FormData): Promise<FormState> {
  const a = await requireAccount();
  if (!(await rateLimit(`datareq:${a.id}`, 5, 86400)).ok) return { error: "You've made several requests today. We'll be in touch about those first." };
  const type = String(fd.get("type"));
  if (!["CORRECTION", "DELETION", "EXPORT"].includes(type)) return { error: "Choose a request type." };
  const subject = String(fd.get("subject") || "self");
  if (subject !== "self") {
    const ch = await prisma.cardholder.findUnique({ where: { id: subject }, include: { membership: true } });
    if (!ch || ch.membership.accountId !== a.id) return { error: "Choose whose data this concerns." };
  }
  const details = String(fd.get("details") || "").trim().slice(0, 2000);
  if (type === "CORRECTION" && details.length < 5) return { error: "Please tell us what needs correcting." };
  const r = await prisma.dataRequest.create({ data: { accountId: a.id, type: type as "CORRECTION" | "DELETION" | "EXPORT", subject, details } });
  await audit("member", "data_request.create", "DataRequest", r.id, { type, subject: subject === "self" ? "self" : "dependant" });
  await Promise.allSettled(
    adminNotifyEmails().map((to) => sendEmail({ to, subject: `Data ${type.toLowerCase()} request`, html: `<p>A member has made a data ${type.toLowerCase()} request. Review it in Admin → Members → Data requests.</p>`, text: `A member has made a data ${type.toLowerCase()} request.`, kind: "admin.data_request" })),
  );
  revalidatePath("/account/privacy");
  return { ok: "Your request has been received. We will respond within 14 days, as the Data Protection Act requires." };
}

export async function handoverStart(_: FormState, fd: FormData): Promise<FormState> {
  const a = await requireAccount();
  try {
    await startJuniorHandover(String(fd.get("membershipId")), a.id, String(fd.get("email") || ""), String(fd.get("phone") || ""));
  } catch (e) {
    if (e instanceof MembershipError) return { error: e.message };
    throw e;
  }
  return { ok: "Done. We've emailed the new member with instructions to sign in and take over the membership." };
}

export async function handoverAccept(_: FormState, fd: FormData): Promise<FormState> {
  const a = await requireAccount();
  if (fd.get("terms") !== "on" || fd.get("privacy") !== "on") return { error: "Please accept the Terms and the Privacy Policy." };
  const membershipId = String(fd.get("membershipId"));
  try {
    await acceptJuniorHandover(membershipId, a.id, String(fd.get("packageId")));
  } catch (e) {
    if (e instanceof MembershipError) return { error: e.message };
    throw e;
  }
  redirect(`/account/pay/${membershipId}`);
}
