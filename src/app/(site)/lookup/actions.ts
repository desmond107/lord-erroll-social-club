"use server";

import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/ratelimit";
import { verifyTurnstile } from "@/lib/turnstile";
import { clientIp, hashIp } from "@/lib/request";
import { publicLookup, type PublicLookup } from "@/lib/lookup";
import { baseOf, parseCardNumber } from "@/lib/numbers";
import { checkOtp, issueOtp } from "@/lib/otp";
import { decryptOr, maskEmail, maskPhone } from "@/lib/crypto";
import { sendEmail, sendSms } from "@/lib/notify";
import { otpMail } from "@/lib/emails";
import { allBenefits } from "@/lib/packages";
import { fmtDate, kes } from "@/lib/format";
import { audit } from "@/lib/audit";

export type LookupState =
  | { step: "idle"; error?: string }
  | { step: "result"; query: string; result: PublicLookup }
  | { step: "otp"; query: string; result: PublicLookup; sentTo: string; error?: string }
  | { step: "verified"; query: string; result: PublicLookup; detail: VerifiedDetail };

export type VerifiedDetail = {
  holderName: string;
  renewalDate: string;
  memberSince: string;
  benefits: string[];
  payments: { date: string; receipt: string; amount: string; purpose: string; method: string }[];
};

const tooMany = { step: "idle" as const, error: "Too many lookups from this connection. Please wait a few minutes and try again." };

async function contactsFor(number: string) {
  const m = await prisma.membership.findUnique({ where: { number }, include: { account: true } });
  if (!m) return null;
  return { m, email: decryptOr(m.account.emailEnc), phone: decryptOr(m.account.phoneEnc) };
}

export async function lookupAction(_: LookupState, fd: FormData): Promise<LookupState> {
  const ip = hashIp(await clientIp());
  const intent = String(fd.get("intent") || "search");
  const query = String(fd.get("number") || "").slice(0, 40);

  if (intent === "search") {
    // 10 per 10 minutes and 40 per day per connection: enough for members, too slow for scraping.
    if (!(await rateLimit(`lookup:${ip}`, 10, 600)).ok || !(await rateLimit(`lookup-day:${ip}`, 40, 86400)).ok) return tooMany;
    if (!(await verifyTurnstile(String(fd.get("cf-turnstile-response") || ""), await clientIp()))) return { step: "idle", error: "Please complete the security check." };
    // Masked contact details are only revealed after a code is sent, never on the public result.
    return { step: "result", query, result: await publicLookup(query) };
  }

  const card = parseCardNumber(query);
  if (!card) return { step: "idle", error: "Please search again." };
  const result = await publicLookup(card);
  if (result.kind === "none") return { step: "result", query, result };
  const base = baseOf(card);

  if (intent === "send-otp") {
    if (!(await rateLimit(`lookup-otp:${base}`, 3, 900)).ok || !(await rateLimit(`lookup-otp-ip:${ip}`, 6, 3600)).ok)
      return { step: "result", query, result };
    const c = await contactsFor(base);
    if (!c) return { step: "result", query, result };
    const channel = fd.get("channel") === "email" ? "email" : "sms";
    const code = await issueOtp("lookup", base);
    if (channel === "email") await sendEmail({ to: c.email, ...otpMail(code, "lookup"), kind: "otp.lookup" });
    else await sendSms(c.phone, `Your Lord Erroll verification code is ${code}. It expires in 10 minutes.`, "otp.lookup");
    return { step: "otp", query, result, sentTo: channel === "email" ? maskEmail(c.email) : maskPhone(c.phone) };
  }

  if (intent === "verify-otp") {
    if (!(await rateLimit(`lookup-verify:${ip}`, 12, 900)).ok) return tooMany;
    const r = await checkOtp("lookup", base, String(fd.get("code") || ""));
    const sentTo = String(fd.get("sentTo") || "");
    if (r !== "ok") {
      const error = r === "locked" ? "Too many attempts. Please request a new code." : r === "expired" ? "That code has expired. Please request a new one." : "That code isn't right. Please try again.";
      return { step: "otp", query, result, sentTo, error };
    }
    const m = await prisma.membership.findUniqueOrThrow({
      where: { number: base },
      include: { package: true, account: true, payments: { where: { status: "PAID" }, orderBy: { paidAt: "desc" }, take: 12 } },
    });
    const allPkgs = await prisma.package.findMany();
    await audit("member", "lookup.verified_view", "Membership", m.id, {});
    return {
      step: "verified",
      query,
      result,
      detail: {
        holderName: m.isJunior ? "Junior membership (managed by guardian)" : m.account.fullName,
        renewalDate: fmtDate(m.expiresAt),
        memberSince: fmtDate(m.memberSince),
        benefits: allBenefits(m.package, allPkgs),
        payments: m.payments.map((p) => ({
          date: fmtDate(p.paidAt),
          receipt: p.receiptNo ?? "-",
          amount: kes(p.amountKes),
          purpose: { NEW: "New membership", RENEWAL: "Renewal", UPGRADE: "Upgrade" }[p.purpose],
          method: { MPESA: "M-Pesa", CARD: "Card", CASH: "Cash", BANK: "Bank" }[p.method],
        })),
      },
    };
  }
  return { step: "idle" };
}
