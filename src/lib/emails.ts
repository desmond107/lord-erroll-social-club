import "server-only";
import { CLUB } from "./site";
import { appUrl } from "./request";
import { kes, fmtDate } from "./format";

/** Branded transactional templates: deep green header, gold rule, ivory body. */
const C = { green: "#14432b", deep: "#0b2a1b", crimson: "#8e1f24", gold: "#c9a24b", ivory: "#faf5ea", ink: "#1f2421", muted: "#6b6a63", line: "#e8dfc9" };

export const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export type Mail = { subject: string; html: string; text: string };

function layout(preheader: string, heading: string, body: string): string {
  const crest = `${appUrl()}/brand/crest-240.png`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="color-scheme" content="light only"></head>
<body style="margin:0;padding:0;background:${C.ivory};font-family:Helvetica,Arial,sans-serif;color:${C.ink}">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.ivory}"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid ${C.line}">
<tr><td align="center" style="background:${C.deep};padding:30px 24px 22px;border-bottom:3px solid ${C.gold}">
<img src="${crest}" width="64" alt="The Lord Erroll crest" style="display:block;border:0;height:auto">
<div style="font-family:Georgia,'Times New Roman',serif;font-size:24px;color:#f3dc8e;margin-top:12px;letter-spacing:.5px">The Lord Erroll</div>
<div style="font-size:10px;letter-spacing:4px;text-transform:uppercase;color:${C.gold};margin-top:4px">Social Club</div></td></tr>
<tr><td style="padding:30px 32px 8px"><div style="font-family:Georgia,serif;font-size:22px;color:${C.green}">${esc(heading)}</div>
<div style="height:1px;background:${C.gold};width:56px;margin:14px 0 0"></div></td></tr>
<tr><td style="padding:12px 32px 30px;font-size:15px;line-height:1.65">${body}</td></tr>
<tr><td style="padding:18px 28px;border-top:1px solid ${C.line};font-size:12px;color:${C.muted};text-align:center;line-height:1.6">
${esc(CLUB.name)} · ${esc(CLUB.address)}<br>${esc(CLUB.phone)} · <a href="mailto:${CLUB.email}" style="color:${C.green}">${CLUB.email}</a> · <a href="${CLUB.websiteHref}" style="color:${C.green}">${CLUB.website}</a>
</td></tr></table></td></tr></table></body></html>`;
}

const button = (href: string, label: string) =>
  `<p style="margin:22px 0"><a href="${href}" style="display:inline-block;background:${C.green};color:#f3dc8e;text-decoration:none;font-weight:bold;padding:13px 24px;border:1px solid ${C.gold};font-size:14px;letter-spacing:.5px">${esc(label)}</a></p>`;

const row = (k: string, v: string) =>
  `<tr><td style="padding:7px 0;color:${C.muted};font-size:13px;width:42%;border-bottom:1px solid ${C.line}">${esc(k)}</td><td style="padding:7px 0;font-size:14px;border-bottom:1px solid ${C.line}">${v}</td></tr>`;
const table = (rows: string) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:14px 0">${rows}</table>`;
const p = (s: string) => `<p style="margin:0 0 14px">${s}</p>`;

export function applicationReceived(name: string, ref: string, pkg: string): Mail {
  return {
    subject: "Your application is under review · The Lord Erroll Social Club",
    html: layout("Thank you for applying.", "Your application is under review", [
      p(`Dear ${esc(name)},`),
      p(`Thank you for applying to join The Lord Erroll Social Club. Your application for <strong>${esc(pkg)}</strong> membership has been received and is now under review by our membership committee.`),
      table(row("Application reference", `<strong>${esc(ref)}</strong>`) + row("Status", "Pending approval")),
      p("We will write to you as soon as a decision has been made. There is nothing further you need to do for now."),
      p("With warm regards,<br>The Membership Secretary"),
    ].join("")),
    text: `Dear ${name}, thank you for applying to The Lord Erroll Social Club (${pkg}). Your application ${ref} is under review. We will be in touch soon.`,
  };
}

export function adminNewApplication(ref: string, name: string, pkg: string, type: string, id: string): Mail {
  const link = `${appUrl()}/admin/applications/${id}`;
  return {
    subject: `New ${type.toLowerCase()} application · ${pkg} · ${ref}`,
    html: layout("A new membership application is waiting.", "New application", [
      table(row("Reference", esc(ref)) + row("Applicant", esc(name)) + row("Package", esc(pkg)) + row("Type", esc(type))),
      button(link, "Review application"),
    ].join("")),
    text: `New ${type} application ${ref} from ${name} for ${pkg}. Review: ${link}`,
  };
}

export function applicationApproved(opts: {
  name: string; number: string; pkg: string; amount: number; payLink: string; cardholders: { name: string; cardNumber: string }[]; junior: boolean;
}): Mail {
  const cards = opts.cardholders.map((c) => row(c.name, `<strong>${esc(c.cardNumber)}</strong>`)).join("");
  return {
    subject: `Welcome to The Lord Erroll Social Club · ${opts.number}`,
    html: layout("Your membership has been approved.", "Your membership has been approved", [
      p(`Dear ${esc(opts.name)},`),
      p(opts.junior
        ? `We are delighted to confirm that the Junior membership you applied for has been approved.`
        : `It is our great pleasure to welcome you to The Lord Erroll Social Club. Your application for <strong>${esc(opts.pkg)}</strong> membership has been approved.`),
      table(row("Membership number", `<strong style="font-size:16px;letter-spacing:1px">${esc(opts.number)}</strong>`) + row("Package", esc(opts.pkg)) + row("Annual subscription", kes(opts.amount)) + cards),
      p("Your membership becomes active as soon as the annual subscription is received. You can pay by M-Pesa or card from your member account:"),
      button(opts.payLink, "Pay and activate membership"),
      p(`Once payment is confirmed, your digital membership card${opts.cardholders.length > 1 ? "s" : ""} will be live in your member account, ready to show at the door, download or share.`),
      p("We look forward to receiving you.<br>The Membership Secretary"),
    ].join("")),
    text: `Welcome to The Lord Erroll Social Club. Membership number ${opts.number} (${opts.pkg}). Pay ${kes(opts.amount)} to activate: ${opts.payLink}`,
  };
}

export function applicationRejected(name: string, reason: string): Mail {
  return {
    subject: "Your application · The Lord Erroll Social Club",
    html: layout("An update on your application.", "An update on your application", [
      p(`Dear ${esc(name)},`),
      p("Thank you for your interest in The Lord Erroll Social Club and for the time you took to apply."),
      p("After careful consideration, the membership committee is unable to offer membership at this time."),
      reason ? p(`<em>${esc(reason)}</em>`) : "",
      p("You remain most welcome to dine with us at The Lord Erroll, and we would be glad to hear from you again in future."),
      p("With kind regards,<br>The Membership Secretary"),
    ].join("")),
    text: `Dear ${name}, thank you for applying to The Lord Erroll Social Club. The committee is unable to offer membership at this time.${reason ? ` ${reason}` : ""}`,
  };
}

export function infoRequested(name: string, ref: string, message: string): Mail {
  return {
    subject: `More information needed · ${ref}`,
    html: layout("The committee has a question about your application.", "A little more information, please", [
      p(`Dear ${esc(name)},`),
      p(`Thank you for your application (${esc(ref)}). Before the committee can decide, we need a little more information:`),
      `<blockquote style="margin:0 0 16px;padding:12px 16px;border-left:3px solid ${C.gold};background:${C.ivory}">${esc(message).replace(/\n/g, "<br>")}</blockquote>`,
      p(`Please reply to this email or contact us on ${esc(CLUB.phone)}.`),
      p("The Membership Secretary"),
    ].join("")),
    text: `Dear ${name}, the committee needs more information about application ${ref}: ${message}. Reply to this email or call ${CLUB.phone}.`,
  };
}

export function paymentReceipt(opts: {
  name: string; receiptNo: string; amount: number; method: string; providerTxnId: string | null; number: string; pkg: string;
  purpose: string; periodStart: Date | null; periodEnd: Date | null; paidAt: Date;
}): Mail {
  return {
    subject: `Receipt ${opts.receiptNo} · The Lord Erroll Social Club`,
    html: layout(`Payment received: ${kes(opts.amount)}.`, "Payment received with thanks", [
      p(`Dear ${esc(opts.name)},`),
      p(opts.purpose === "NEW" ? "Your payment has been received and your membership is now <strong>active</strong>. Your digital card is waiting in your member account." : "Your payment has been received. Thank you."),
      table(
        row("Receipt number", `<strong>${esc(opts.receiptNo)}</strong>`) +
        row("Date", esc(fmtDate(opts.paidAt))) +
        row("Membership", esc(opts.number)) +
        row("Package", esc(opts.pkg)) +
        row("Description", esc({ NEW: "Annual subscription", RENEWAL: "Annual renewal", UPGRADE: "Package upgrade" }[opts.purpose] ?? opts.purpose)) +
        row("Period", `${esc(fmtDate(opts.periodStart))} to ${esc(fmtDate(opts.periodEnd))}`) +
        row("Method", esc(opts.method === "MPESA" ? "M-Pesa" : opts.method === "CARD" ? "Card" : opts.method === "BANK" ? "Bank transfer" : "Cash")) +
        (opts.providerTxnId ? row("Transaction reference", esc(opts.providerTxnId)) : "") +
        row("Amount paid", `<strong>${kes(opts.amount)}</strong>`),
      ),
      button(`${appUrl()}/account`, "Open my member account"),
    ].join("")),
    text: `Receipt ${opts.receiptNo}: ${kes(opts.amount)} received for ${opts.number} (${opts.pkg}), ${fmtDate(opts.periodStart)} to ${fmtDate(opts.periodEnd)}.`,
  };
}

export function renewalReminder(name: string, number: string, expiresAt: Date, days: number): Mail {
  const link = `${appUrl()}/account/renew`;
  const when = days <= 0 ? "has expired" : `expires in ${days} day${days === 1 ? "" : "s"}`;
  return {
    subject: days <= 0 ? `Your membership has expired · ${number}` : `Your membership ${when} · ${number}`,
    html: layout(`Your membership ${when}.`, days <= 0 ? "Your membership has expired" : "Time to renew", [
      p(`Dear ${esc(name)},`),
      p(`Your Lord Erroll Social Club membership <strong>${esc(number)}</strong> ${when}${days > 0 ? ` on ${esc(fmtDate(expiresAt))}` : ""}. Renewing takes a moment and keeps the same membership number.`),
      button(link, "Renew my membership"),
      p("You may also change your package when you renew."),
    ].join("")),
    text: `Your Lord Erroll Social Club membership ${number} ${when}. Renew: ${link}`,
  };
}

export function juniorAgeOutNotice(guardian: string, child: string, number: string, birthday: Date): Mail {
  return {
    subject: `${child}'s Junior membership: turning 18 · ${number}`,
    html: layout("A Junior membership is approaching adulthood.", "Approaching eighteen", [
      p(`Dear ${esc(guardian)},`),
      p(`${esc(child)} turns 18 on <strong>${esc(fmtDate(birthday))}</strong>. On that day the Junior membership (${esc(number)}) can convert into an adult membership, keeping the same number without the “-J” marker.`),
      p(`${esc(child)} will need to accept the club's terms personally and choose an adult package. Emerald, our entry tier, is the natural next step.`),
      button(`${appUrl()}/account`, "Manage the membership"),
    ].join("")),
    text: `${child} turns 18 on ${fmtDate(birthday)}. The Junior membership ${number} can then convert to an adult package. Manage it at ${appUrl()}/account`,
  };
}

export function otpMail(code: string, purpose: "login" | "lookup"): Mail {
  const what = purpose === "login" ? "sign in to your member account" : "view your full membership details";
  return {
    subject: `${code} is your Lord Erroll verification code`,
    html: layout(`Your code is ${code}.`, "Your verification code", [
      p(`Use this code to ${what}. It expires in 10 minutes.`),
      `<div style="font-family:Georgia,serif;font-size:34px;letter-spacing:10px;color:${C.green};text-align:center;padding:16px;border:1px solid ${C.gold};margin:12px 0 18px">${esc(code)}</div>`,
      p(`If you didn't ask for this, you can ignore this email.`),
    ].join("")),
    text: `Your Lord Erroll verification code is ${code}. It expires in 10 minutes.`,
  };
}

export function announcementMail(title: string, body: string): Mail {
  return {
    subject: `${title} · The Lord Erroll Social Club`,
    html: layout(title, title, `${esc(body).split(/\n{2,}/).map((x) => p(x.replace(/\n/g, "<br>"))).join("")}${button(`${appUrl()}/account`, "Open my member account")}`),
    text: `${title}\n\n${body}`,
  };
}

export function statusChanged(name: string, number: string, status: string, note?: string | null): Mail {
  return {
    subject: `Membership update · ${number}`,
    html: layout(`Your membership status is now ${status}.`, "Membership update", [
      p(`Dear ${esc(name)},`),
      p(`The status of membership <strong>${esc(number)}</strong> is now <strong>${esc(status)}</strong>.`),
      note ? p(esc(note)) : "",
      p(`If you have any questions, please contact us on ${esc(CLUB.phone)} or ${esc(CLUB.email)}.`),
    ].join("")),
    text: `Membership ${number} is now ${status}.${note ? ` ${note}` : ""}`,
  };
}
