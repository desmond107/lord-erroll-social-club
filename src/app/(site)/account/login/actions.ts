"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/ratelimit";
import { clientIp, hashIp } from "@/lib/request";
import { decryptOr, emailIdx, maskEmail, maskPhone, phoneIdx } from "@/lib/crypto";
import { checkOtp, issueOtp } from "@/lib/otp";
import { sendEmail, sendSms } from "@/lib/notify";
import { otpMail } from "@/lib/emails";
import { createMemberSession } from "@/lib/member-auth";
import { verifyTurnstile } from "@/lib/turnstile";

export type LoginState = { step: "start"; error?: string } | { step: "code"; identifier: string; sentTo: string; next: string; error?: string };

// Compared against when no account matches, so timing doesn't reveal which accounts exist.
let dummyHash: string | null = null;
const dummy = async () => (dummyHash ??= await bcrypt.hash("not-a-real-password", 12));

async function findAccount(identifier: string) {
  const id = identifier.trim();
  if (!id) return null;
  return id.includes("@")
    ? prisma.account.findUnique({ where: { emailIdx: emailIdx(id) } })
    : prisma.account.findUnique({ where: { phoneIdx: phoneIdx(id) } });
}

const safeNext = (n: string) => (n.startsWith("/account") && !n.startsWith("//") ? n : "/account");

export async function loginAction(prev: LoginState, fd: FormData): Promise<LoginState> {
  const ip = hashIp(await clientIp());
  const intent = String(fd.get("intent"));
  const next = safeNext(String(fd.get("next") || "/account"));
  const identifier = String(fd.get("identifier") || "").slice(0, 160);

  if (!(await rateLimit(`member-login:${ip}`, 20, 900)).ok) return { step: "start", error: "Too many attempts. Please wait 15 minutes." };

  if (intent === "send-code") {
    if (!(await verifyTurnstile(String(fd.get("cf-turnstile-response") || ""), await clientIp()))) return { step: "start", error: "Please complete the security check." };
    if (!(await rateLimit(`member-otp:${identifier.toLowerCase()}`, 4, 900)).ok) return { step: "start", error: "Too many codes requested. Please wait 15 minutes." };
    const acct = await findAccount(identifier);
    const viaEmail = identifier.includes("@");
    // Same response whether or not the account exists (no account enumeration).
    const sentTo = viaEmail ? maskEmail(identifier.trim().toLowerCase()) : maskPhone(identifier.replace(/\D/g, ""));
    if (acct) {
      const code = await issueOtp("login", acct.id);
      if (viaEmail) await sendEmail({ to: decryptOr(acct.emailEnc), ...otpMail(code, "login"), kind: "otp.login" });
      else await sendSms(decryptOr(acct.phoneEnc), `Your Lord Erroll sign-in code is ${code}. It expires in 10 minutes. Never share it.`, "otp.login");
    }
    return { step: "code", identifier, sentTo, next };
  }

  if (intent === "verify-code") {
    const acct = await findAccount(identifier);
    const sentTo = prev.step === "code" ? prev.sentTo : "";
    if (!acct) return { step: "code", identifier, sentTo, next, error: "That code isn't right." };
    const r = await checkOtp("login", acct.id, String(fd.get("code") || ""));
    if (r !== "ok") return { step: "code", identifier, sentTo, next, error: r === "locked" ? "Too many attempts. Request a new code." : r === "expired" ? "That code has expired. Request a new one." : "That code isn't right." };
    await createMemberSession(acct.id);
    redirect(next);
  }

  if (intent === "password") {
    if (!(await rateLimit(`member-pw:${identifier.toLowerCase()}`, 6, 900)).ok) return { step: "start", error: "Too many attempts for this account. Use a sign-in code or wait 15 minutes." };
    const acct = await findAccount(identifier);
    const ok = await bcrypt.compare(String(fd.get("password") || ""), acct?.passwordHash ?? (await dummy()));
    if (!acct || !acct.passwordHash || !ok) return { step: "start", error: "Those details don't match. You can also sign in with a one-time code." };
    await createMemberSession(acct.id);
    redirect(next);
  }
  return { step: "start" };
}
