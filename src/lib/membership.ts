import "server-only";
import type { Account, Membership, Package, Payment, PaymentMethod, PaymentPurpose, Prisma } from "@prisma/client";
import { prisma } from "./db";
import { decryptOr, emailIdx as toEmailIdx, phoneIdx as toPhoneIdx, randomToken } from "./crypto";
import { issueMembershipNumber, FAMILY_SUFFIXES, cardNumberOf, nextReceiptNo } from "./numbers";
import { ageOn, birthdayAt } from "./age";
import { addDays, addYears, firstName, STATUS_LABEL } from "./format";
import { getSettings } from "./settings";
import { upgradePrice } from "./packages";
import { audit } from "./audit";
import { sendEmail, sendSms, sendWhatsApp } from "./notify";
import * as mails from "./emails";
import { appUrl } from "./request";

export class MembershipError extends Error {}

type Actor = { id: string; email: string };

// ─── Messaging helper ────────────────────────────────────────────────────

/** Email + SMS (+ WhatsApp when asked) to an account holder. Never throws. */
export async function notifyAccount(
  account: Pick<Account, "emailEnc" | "phoneEnc">,
  mail: mails.Mail,
  kind: string,
  channels: string[] = ["EMAIL", "SMS"],
  attachments?: { filename: string; content: Buffer }[],
) {
  const email = decryptOr(account.emailEnc);
  const phone = decryptOr(account.phoneEnc);
  const jobs: Promise<unknown>[] = [];
  if (channels.includes("EMAIL") && email) jobs.push(sendEmail({ to: email, ...mail, kind, attachments }));
  if (channels.includes("SMS") && phone) jobs.push(sendSms(phone, mail.text.slice(0, 450), kind));
  if (channels.includes("WHATSAPP") && phone) jobs.push(sendWhatsApp(phone, mail.text, kind));
  await Promise.allSettled(jobs);
}

// ─── Status ──────────────────────────────────────────────────────────────

export type EffectiveStatus = "ACTIVE" | "GRACE" | "EXPIRED" | "PENDING" | "SUSPENDED" | "CANCELLED";

/**
 * The status the outside world sees. Guards against the daily job not having run yet:
 * an ACTIVE membership past expiry + grace reads as EXPIRED immediately.
 */
export function effectiveStatus(m: Pick<Membership, "status" | "expiresAt">, graceDays: number, now = new Date()): EffectiveStatus {
  switch (m.status) {
    case "PENDING_PAYMENT":
      return "PENDING";
    case "SUSPENDED":
      return "SUSPENDED";
    case "CANCELLED":
      return "CANCELLED";
    case "EXPIRED":
    case "LAPSED":
      return "EXPIRED";
    case "ACTIVE":
      if (!m.expiresAt) return "ACTIVE";
      if (m.expiresAt > now) return "ACTIVE";
      return addDays(m.expiresAt, graceDays) > now ? "GRACE" : "EXPIRED";
  }
}

export const EFFECTIVE_LABEL: Record<EffectiveStatus, string> = {
  ACTIVE: "Active",
  GRACE: "Active · renewal due",
  EXPIRED: "Expired",
  PENDING: "Pending",
  SUSPENDED: "Suspended",
  CANCELLED: "Cancelled",
};

export const isValidForEntry = (s: EffectiveStatus) => s === "ACTIVE" || s === "GRACE";

// ─── Applications ────────────────────────────────────────────────────────

export async function approveApplication(applicationId: string, actor: Actor, note?: string) {
  const settings = await getSettings();
  const result = await prisma.$transaction(async (tx) => {
    const app = await tx.application.findUnique({
      where: { id: applicationId },
      include: { package: true, dependants: { orderBy: { sortOrder: "asc" } } },
    });
    if (!app) throw new MembershipError("Application not found.");
    if (app.status !== "PENDING" && app.status !== "INFO_REQUESTED") throw new MembershipError("This application has already been decided.");

    // Re-verify ages at the moment of approval.
    if (ageOn(app.dateOfBirth) < 18) throw new MembershipError("The applicant/guardian must be 18 or over.");
    if (app.type === "JUNIOR") {
      const child = app.dependants[0];
      if (!child) throw new MembershipError("Junior application has no child listed.");
      const age = ageOn(child.dateOfBirth);
      if (age < settings.juniorMinAge || age > settings.juniorMaxAge)
        throw new MembershipError(`The child is ${age}; Junior membership is for ages ${settings.juniorMinAge}–${settings.juniorMaxAge}.`);
      if (!child.dobProofId) throw new MembershipError("Junior applications need a date-of-birth document.");
    }
    if (app.type === "FAMILY" && app.dependants.length > app.package.maxLinked)
      throw new MembershipError(`This package allows up to ${app.package.maxLinked} linked members.`);

    // One account per person: find by email or phone, refusing ambiguous matches.
    const byEmail = await tx.account.findUnique({ where: { emailIdx: app.emailIdx } });
    const byPhone = await tx.account.findUnique({ where: { phoneIdx: app.phoneIdx } });
    if (byEmail && byPhone && byEmail.id !== byPhone.id)
      throw new MembershipError("The email and phone belong to two different member accounts. Please resolve before approving.");
    const account =
      byEmail ??
      byPhone ??
      (await tx.account.create({
        data: {
          fullName: app.fullName,
          emailEnc: app.emailEnc,
          emailIdx: app.emailIdx,
          phoneEnc: app.phoneEnc,
          phoneIdx: app.phoneIdx,
          marketingOk: app.marketingOk,
        },
      }));

    const number = await issueMembershipNumber(tx);
    const membership = await tx.membership.create({
      data: {
        number,
        status: "PENDING_PAYMENT",
        isJunior: app.type === "JUNIOR",
        packageId: app.packageId,
        accountId: account.id,
        applicationId: app.id,
      },
    });

    const holders: Prisma.CardholderCreateManyInput[] = [];
    if (app.type !== "JUNIOR") {
      holders.push({
        membershipId: membership.id, suffix: "", cardNumber: number, fullName: app.fullName, displayName: app.fullName,
        relationship: "Primary", dateOfBirth: app.dateOfBirth, photoId: app.photoId, verifyToken: randomToken(18),
      });
      app.dependants.forEach((d, i) => {
        const suffix = FAMILY_SUFFIXES[i];
        holders.push({
          membershipId: membership.id, suffix, cardNumber: cardNumberOf(number, suffix), fullName: d.fullName, displayName: d.fullName,
          relationship: d.relationship, dateOfBirth: d.dateOfBirth, photoId: d.photoId, verifyToken: randomToken(18),
        });
      });
    } else {
      const c = app.dependants[0];
      holders.push({
        membershipId: membership.id, suffix: "J", cardNumber: cardNumberOf(number, "J"), fullName: c.fullName,
        displayName: firstName(c.fullName), relationship: "Junior member", dateOfBirth: c.dateOfBirth,
        photoId: c.photoId, dobProofId: c.dobProofId, verifyToken: randomToken(18),
      });
    }
    // Files move from the application to the cards (each file has a single owner).
    await tx.application.update({ where: { id: app.id }, data: { photoId: null } });
    await tx.applicationDependant.updateMany({ where: { applicationId: app.id }, data: { photoId: null, dobProofId: null } });
    await tx.cardholder.createMany({ data: holders });

    await tx.application.update({
      where: { id: app.id },
      data: { status: "APPROVED", accountId: account.id, reviewedById: actor.id, reviewedAt: new Date(), adminNote: note || app.adminNote },
    });
    return { app, account, membership, holders };
  });

  await audit(actor, "application.approve", "Application", applicationId, { number: result.membership.number });
  const payLink = `${appUrl()}/account/login?next=${encodeURIComponent(`/account/pay/${result.membership.id}`)}`;
  await notifyAccount(
    result.account,
    mails.applicationApproved({
      name: result.app.fullName,
      number: result.membership.number,
      pkg: result.app.package.name,
      amount: result.app.package.annualFeeKes,
      payLink,
      cardholders: result.holders.map((h) => ({ name: h.displayName, cardNumber: h.cardNumber })),
      junior: result.app.type === "JUNIOR",
    }),
    "application.approved",
  );
  return result.membership;
}

export async function rejectApplication(applicationId: string, actor: Actor, reason: string, note?: string) {
  const app = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!app) throw new MembershipError("Application not found.");
  if (app.status !== "PENDING" && app.status !== "INFO_REQUESTED") throw new MembershipError("This application has already been decided.");
  await prisma.application.update({
    where: { id: applicationId },
    data: { status: "REJECTED", messageToApplicant: reason, adminNote: note || app.adminNote, reviewedById: actor.id, reviewedAt: new Date() },
  });
  await audit(actor, "application.reject", "Application", applicationId, { reason });
  await notifyAccount(app, mails.applicationRejected(app.fullName, reason), "application.rejected", ["EMAIL"]);
}

export async function requestInfo(applicationId: string, actor: Actor, message: string) {
  const app = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!app) throw new MembershipError("Application not found.");
  if (app.status !== "PENDING" && app.status !== "INFO_REQUESTED") throw new MembershipError("This application has already been decided.");
  await prisma.application.update({
    where: { id: applicationId },
    data: { status: "INFO_REQUESTED", messageToApplicant: message, reviewedById: actor.id, reviewedAt: new Date() },
  });
  await audit(actor, "application.request_info", "Application", applicationId, { message });
  await notifyAccount(app, mails.infoRequested(app.fullName, app.ref, message), "application.info_requested", ["EMAIL", "SMS"]);
}

// ─── Payments ────────────────────────────────────────────────────────────

export type Quote = { purpose: PaymentPurpose; pkg: Package; amount: number; note?: string };

/** What paying now would buy for this membership, optionally switching package. */
export async function quote(membershipId: string, targetPackageId?: string): Promise<Quote> {
  const settings = await getSettings();
  const m = await prisma.membership.findUnique({
    where: { id: membershipId },
    include: { package: true, cardholders: true },
  });
  if (!m) throw new MembershipError("Membership not found.");
  if (m.status === "SUSPENDED" || m.status === "CANCELLED") throw new MembershipError("This membership is not open for payment. Please contact the club.");

  // A converted junior pays for their chosen adult tier, starting today.
  if (m.convertedFromJuniorAt && m.package.kind === "JUNIOR") {
    const t = await prisma.package.findUnique({ where: { id: targetPackageId ?? m.nextPackageId ?? "" } });
    if (!t || !t.active || t.kind !== "MAIN") throw new MembershipError("Please choose one of the main membership tiers.");
    return { purpose: "RENEWAL", pkg: t, amount: t.annualFeeKes, note: "Your first adult membership year starts on payment." };
  }

  const target = targetPackageId ? await prisma.package.findUnique({ where: { id: targetPackageId } }) : m.nextPackageId ? await prisma.package.findUnique({ where: { id: m.nextPackageId } }) : m.package;
  if (!target || !target.active) throw new MembershipError("That package is not available.");

  // Junior rules: the child must still be in range; an adult package needs the hand-over first.
  if (m.isJunior) {
    if (target.kind !== "JUNIOR") throw new MembershipError("A Junior membership converts to an adult package through the hand-over at 18.");
    const child = m.cardholders.find((c) => c.suffix === "J");
    if (child && ageOn(child.dateOfBirth) > settings.juniorMaxAge)
      throw new MembershipError("This Junior member has aged out. Please complete the adult hand-over instead of renewing.");
  } else if (target.kind === "JUNIOR") {
    throw new MembershipError("Junior membership is only for under-18s.");
  }
  if (target.kind === "FAMILY" && m.package.kind !== "FAMILY") throw new MembershipError("Family membership needs a new family application.");
  if (m.package.kind === "FAMILY" && target.kind !== "FAMILY") {
    const linked = m.cardholders.filter((c) => c.suffix && c.active).length;
    if (linked > 0) throw new MembershipError("Please contact the club to move a family membership to an individual package.");
  }

  if (m.status === "PENDING_PAYMENT") return { purpose: "NEW", pkg: target, amount: target.annualFeeKes };

  const now = new Date();
  const renewalDue = !m.expiresAt || m.expiresAt.getTime() - now.getTime() < 60 * 86400000 || m.status !== "ACTIVE";
  if (!renewalDue && target.id !== m.packageId) {
    if (target.kind === "MAIN" && m.package.kind === "MAIN" && target.rank > m.package.rank) {
      return { purpose: "UPGRADE", pkg: target, amount: upgradePrice(m.package, target, m.expiresAt, now), note: "Pro-rated difference for the rest of this membership year." };
    }
    throw new MembershipError("Downgrades take effect at renewal (from 60 days before expiry).");
  }
  if (!renewalDue) throw new MembershipError("Renewal opens 60 days before your membership expires.");
  return { purpose: "RENEWAL", pkg: target, amount: target.annualFeeKes };
}

export async function createPayment(membershipId: string, q: Quote, method: PaymentMethod, extra: Partial<Prisma.PaymentUncheckedCreateInput> = {}) {
  // Reuse a still-pending payment of the same kind instead of piling up duplicates.
  await prisma.payment.updateMany({
    where: { membershipId, status: "PENDING", method: { in: ["MPESA", "CARD"] }, createdAt: { lt: new Date(Date.now() - 2 * 60 * 1000) } },
    data: { status: "CANCELLED", failureReason: "Superseded by a new payment attempt" },
  });
  return prisma.payment.create({
    data: { membershipId, packageId: q.pkg.id, purpose: q.purpose, method, amountKes: q.amount, ...extra },
  });
}

/**
 * Marks a payment paid and applies it to the membership. Idempotent: the PENDING → PAID
 * transition is a conditional update, so duplicate callbacks change nothing.
 * Returns false if the payment was not pending.
 */
export async function confirmPayment(
  paymentId: string,
  opts: { providerTxnId?: string | null; confirmedBy?: Actor; note?: string; rawCallback?: Prisma.InputJsonValue; amountKes?: number },
) {
  const done = await prisma.$transaction(async (tx) => {
    const pay = await tx.payment.findUnique({ where: { id: paymentId } });
    if (!pay) throw new MembershipError("Payment not found.");
    if (opts.amountKes != null && opts.amountKes !== pay.amountKes) throw new MembershipError(`Amount mismatch: expected ${pay.amountKes}, got ${opts.amountKes}.`);
    if (opts.providerTxnId) {
      const dup = await tx.payment.findUnique({ where: { providerTxnId: opts.providerTxnId } });
      if (dup && dup.id !== pay.id) throw new MembershipError("That transaction reference was already used for another payment.");
    }
    const flipped = await tx.payment.updateMany({
      where: { id: paymentId, status: { in: ["PENDING", "FAILED"] } },
      data: { status: "PAID", paidAt: new Date() },
    });
    if (flipped.count === 0) return null;

    const m = await tx.membership.findUniqueOrThrow({ where: { id: pay.membershipId }, include: { package: true } });
    const now = new Date();
    // First adult payment after a junior hand-over starts a fresh year today.
    const converting = !!m.convertedFromJuniorAt && m.package.kind === "JUNIOR";
    let periodStart: Date;
    let periodEnd: Date;
    const data: Prisma.MembershipUpdateInput = {};
    if (pay.purpose === "UPGRADE") {
      periodStart = now;
      periodEnd = m.expiresAt ?? addYears(now, 1);
      data.package = { connect: { id: pay.packageId } };
    } else {
      // NEW, or RENEWAL: a renewal paid before expiry extends from the current expiry
      // (no lost days); a lapsed one starts today.
      const fromExpiry = pay.purpose === "RENEWAL" && m.expiresAt && m.expiresAt > now && !converting;
      periodStart = fromExpiry ? m.expiresAt! : now;
      periodEnd = addYears(periodStart, 1);
      data.status = "ACTIVE";
      data.expiresAt = periodEnd;
      data.activatedAt = m.activatedAt ?? now;
      data.memberSince = m.memberSince ?? now;
      data.package = { connect: { id: pay.packageId } };
      data.nextPackageId = null;
    }
    await tx.membership.update({ where: { id: m.id }, data });
    const receiptNo = await nextReceiptNo(tx);
    return tx.payment.update({
      where: { id: paymentId },
      data: {
        receiptNo,
        periodStart,
        periodEnd,
        providerTxnId: opts.providerTxnId ?? pay.providerTxnId,
        confirmedById: opts.confirmedBy?.id,
        note: opts.note ?? pay.note,
        rawCallback: opts.rawCallback ?? undefined,
        failureReason: null,
      },
      include: { membership: { include: { account: true } }, package: true },
    });
  });
  if (!done) return false;

  await audit(opts.confirmedBy ?? "system", opts.confirmedBy ? "payment.confirm_manual" : "payment.confirm", "Payment", done.id, {
    receiptNo: done.receiptNo, amount: done.amountKes, method: done.method, number: done.membership.number,
  });
  const acct = done.membership.account;
  await notifyAccount(
    acct,
    mails.paymentReceipt({
      name: acct.fullName, receiptNo: done.receiptNo!, amount: done.amountKes, method: done.method, providerTxnId: done.providerTxnId,
      number: done.membership.number, pkg: done.package.name, purpose: done.purpose, periodStart: done.periodStart, periodEnd: done.periodEnd, paidAt: done.paidAt!,
    }),
    "payment.receipt",
    ["EMAIL", "SMS"],
  );
  return true;
}

export async function failPayment(paymentId: string, reason: string, raw?: Prisma.InputJsonValue) {
  await prisma.payment.updateMany({
    where: { id: paymentId, status: "PENDING" },
    data: { status: "FAILED", failureReason: reason.slice(0, 300), rawCallback: raw ?? undefined },
  });
}

// ─── Admin membership actions ────────────────────────────────────────────

export async function setSuspended(membershipId: string, actor: Actor, suspend: boolean, reason: string) {
  const m = await prisma.membership.findUniqueOrThrow({ where: { id: membershipId }, include: { account: true } });
  if (suspend && m.status === "SUSPENDED") return;
  let status = m.status;
  if (suspend) status = "SUSPENDED";
  else status = !m.activatedAt ? "PENDING_PAYMENT" : m.expiresAt && m.expiresAt > new Date() ? "ACTIVE" : "EXPIRED";
  await prisma.membership.update({ where: { id: membershipId }, data: { status, suspendedReason: suspend ? reason : null } });
  await audit(actor, suspend ? "membership.suspend" : "membership.reinstate", "Membership", membershipId, { reason, from: m.status, to: status });
  await notifyAccount(m.account, mails.statusChanged(m.account.fullName, m.number, STATUS_LABEL[status], suspend ? reason : null), "membership.status", ["EMAIL"]);
}

export async function extendMembership(membershipId: string, actor: Actor, days: number, reason: string) {
  const m = await prisma.membership.findUniqueOrThrow({ where: { id: membershipId } });
  if (!m.expiresAt) throw new MembershipError("This membership hasn't been activated yet.");
  const base = m.expiresAt > new Date() ? m.expiresAt : new Date();
  const expiresAt = addDays(base, days);
  await prisma.membership.update({
    where: { id: membershipId },
    data: { expiresAt, status: m.status === "EXPIRED" || m.status === "LAPSED" ? "ACTIVE" : m.status },
  });
  await audit(actor, "membership.extend", "Membership", membershipId, { days, reason, from: m.expiresAt.toISOString(), to: expiresAt.toISOString() });
}

// ─── Junior → adult hand-over ────────────────────────────────────────────

/** Step 1 (guardian): name the young adult's own email and phone; creates their account. */
export async function startJuniorHandover(membershipId: string, guardianId: string, email: string, phone: string) {
  const m = await prisma.membership.findUnique({ where: { id: membershipId }, include: { cardholders: true } });
  if (!m || m.accountId !== guardianId || !m.isJunior) throw new MembershipError("Membership not found.");
  const child = m.cardholders.find((c) => c.suffix === "J");
  if (!child || ageOn(child.dateOfBirth) < 18) throw new MembershipError("The hand-over opens on the member's 18th birthday.");
  const eIdx = toEmailIdx(email);
  const pIdx = toPhoneIdx(phone);
  const { encrypt, normEmail, normPhone } = await import("./crypto");
  const existing = await prisma.account.findFirst({ where: { OR: [{ emailIdx: eIdx }, { phoneIdx: pIdx }] } });
  if (existing && existing.id === guardianId) throw new MembershipError("Please use the young member's own email and phone, not the guardian's.");
  const acct =
    existing ??
    (await prisma.account.create({
      data: { fullName: child.fullName, emailEnc: encrypt(normEmail(email)), emailIdx: eIdx, phoneEnc: encrypt(normPhone(phone)), phoneIdx: pIdx },
    }));
  await prisma.membership.update({ where: { id: m.id }, data: { handoverAccountId: acct.id } });
  await audit("member", "junior.handover_start", "Membership", m.id, {});
  await sendEmail({
    to: normEmail(email),
    subject: "Your Lord Erroll membership is ready for you",
    html: `<p>Congratulations on turning 18. Your Junior membership ${m.number} can now become your own adult membership. Sign in at <a href="${appUrl()}/account/login">${appUrl()}/account/login</a> with this email to accept the club's terms and choose your package.</p>`,
    text: `Congratulations on turning 18. Sign in at ${appUrl()}/account/login with this email to take over membership ${m.number}.`,
    kind: "junior.handover",
  });
}

/** Step 2 (the young adult): accept terms, pick an adult tier, take over the account. */
export async function acceptJuniorHandover(membershipId: string, accountId: string, packageId: string) {
  const pkg = await prisma.package.findUnique({ where: { id: packageId } });
  if (!pkg || !pkg.active || pkg.kind !== "MAIN") throw new MembershipError("Please choose one of the main membership tiers.");
  const m = await prisma.membership.findUnique({ where: { id: membershipId }, include: { cardholders: true } });
  if (!m || m.handoverAccountId !== accountId || !m.isJunior) throw new MembershipError("Hand-over not found.");
  const child = m.cardholders.find((c) => c.suffix === "J")!;
  await prisma.$transaction([
    prisma.cardholder.update({
      where: { id: child.id },
      data: { suffix: "", cardNumber: m.number, displayName: child.fullName, relationship: "Primary", dobProofId: null, verifyToken: randomToken(18) },
    }),
    prisma.membership.update({
      where: { id: m.id },
      data: { accountId, isJunior: false, handoverAccountId: null, convertedFromJuniorAt: new Date(), nextPackageId: pkg.id },
    }),
  ]);
  // The adult period starts on payment of the new tier.
  await audit("member", "junior.handover_accept", "Membership", m.id, { package: pkg.slug });
}

// ─── Daily job ───────────────────────────────────────────────────────────

/** Reminders, expiry, junior ageing-out and housekeeping. Safe to run more than once a day. */
export async function runDaily(now = new Date()) {
  const s = await getSettings();
  const report = { reminders: 0, expired: 0, juniorNotices: 0, juniorLapsed: 0, purged: 0 };

  // 1. Renewal reminders: send only the nearest threshold not yet sent for this expiry.
  const thresholds = [...s.reminderDays].sort((a, b) => a - b);
  const maxT = thresholds[thresholds.length - 1] ?? 30;
  const upcoming = await prisma.membership.findMany({
    where: { status: "ACTIVE", expiresAt: { gt: now, lte: addDays(now, maxT) } },
    include: { account: true, reminders: true },
  });
  for (const m of upcoming) {
    const daysLeft = Math.ceil((m.expiresAt!.getTime() - now.getTime()) / 86400000);
    const t = thresholds.find((x) => daysLeft <= x);
    if (t == null) continue;
    const kind = `expiry-${t}`;
    const forDate = new Date(m.expiresAt!.toISOString().slice(0, 10));
    const sentSmaller = m.reminders.some((r) => r.forDate.getTime() === forDate.getTime() && r.kind.startsWith("expiry-") && Number(r.kind.slice(7)) <= t);
    if (sentSmaller) continue;
    try {
      await prisma.reminderLog.create({ data: { membershipId: m.id, kind, forDate } });
    } catch {
      continue; // already sent (unique constraint)
    }
    await notifyAccount(m.account, mails.renewalReminder(m.account.fullName, m.number, m.expiresAt!, daysLeft), `reminder.${kind}`, s.reminderChannels);
    report.reminders++;
  }

  // 2. Expire memberships past expiry + grace; the card is deactivated with them.
  const toExpire = await prisma.membership.findMany({
    where: { status: "ACTIVE", expiresAt: { lt: addDays(now, -s.graceDays) } },
    include: { account: true },
  });
  for (const m of toExpire) {
    const r = await prisma.membership.updateMany({ where: { id: m.id, status: "ACTIVE" }, data: { status: "EXPIRED" } });
    if (!r.count) continue;
    report.expired++;
    await audit("system", "membership.expire", "Membership", m.id, { expiresAt: m.expiresAt?.toISOString() });
    const forDate = new Date(m.expiresAt!.toISOString().slice(0, 10));
    try {
      await prisma.reminderLog.create({ data: { membershipId: m.id, kind: "expired", forDate } });
      await notifyAccount(m.account, mails.renewalReminder(m.account.fullName, m.number, m.expiresAt!, 0), "reminder.expired", s.reminderChannels);
    } catch {
      /* already told */
    }
  }

  // 3. Juniors: 60-day notice to the guardian, and lapse after the conversion grace.
  const juniors = await prisma.membership.findMany({
    where: { isJunior: true, status: { in: ["ACTIVE", "PENDING_PAYMENT", "EXPIRED"] } },
    include: { account: true, cardholders: { where: { suffix: "J" } }, reminders: true },
  });
  for (const m of juniors) {
    const child = m.cardholders[0];
    if (!child) continue;
    const b18 = birthdayAt(child.dateOfBirth, 18);
    const daysTo18 = Math.ceil((b18.getTime() - now.getTime()) / 86400000);
    if (daysTo18 <= s.juniorAgeOutNoticeDays && daysTo18 > 0) {
      try {
        await prisma.reminderLog.create({ data: { membershipId: m.id, kind: `junior-18-${s.juniorAgeOutNoticeDays}`, forDate: b18 } });
        await notifyAccount(m.account, mails.juniorAgeOutNotice(m.account.fullName, child.displayName, m.number, b18), "junior.age_out", ["EMAIL", "SMS"]);
        report.juniorNotices++;
      } catch {
        /* sent before */
      }
    }
    if (now > addDays(b18, s.juniorConvertGraceDays)) {
      await prisma.membership.update({ where: { id: m.id }, data: { status: "LAPSED" } });
      await audit("system", "junior.lapse", "Membership", m.id, { turned18: b18.toISOString().slice(0, 10) });
      report.juniorLapsed++;
    }
  }

  // 4. Privacy policy: declined and withdrawn applications are deleted after 12 months.
  const stale = await prisma.application.findMany({
    where: { status: { in: ["REJECTED", "WITHDRAWN"] }, updatedAt: { lt: addDays(now, -365) } },
    include: { dependants: true, photo: true },
  });
  if (stale.length) {
    const { deleteUpload } = await import("./uploads");
    const fileIds = stale.flatMap((a) => [a.photoId, ...a.dependants.flatMap((d) => [d.photoId, d.dobProofId])]).filter(Boolean) as string[];
    const files = await prisma.storedFile.findMany({ where: { id: { in: fileIds } } });
    await prisma.application.deleteMany({ where: { id: { in: stale.map((a) => a.id) } } });
    await prisma.storedFile.deleteMany({ where: { id: { in: fileIds } } });
    await Promise.all(files.map((f) => deleteUpload(f.path)));
    await audit("system", "application.purge_declined", "Application", null, { count: stale.length });
  }

  // 5. Housekeeping.
  const purged = await prisma.$transaction([
    prisma.otpCode.deleteMany({ where: { expiresAt: { lt: addDays(now, -1) } } }),
    prisma.memberSession.deleteMany({ where: { expiresAt: { lt: now } } }),
    prisma.adminSession.deleteMany({ where: { expiresAt: { lt: now } } }),
    prisma.rateBucket.deleteMany({ where: { resetAt: { lt: now } } }),
    prisma.payment.updateMany({
      where: { status: "PENDING", method: { in: ["MPESA", "CARD"] }, createdAt: { lt: addDays(now, -1) } },
      data: { status: "CANCELLED", failureReason: "Not completed within 24 hours" },
    }),
  ]);
  report.purged = purged.reduce((n, r) => n + r.count, 0);
  return report;
}

export type { Payment };
