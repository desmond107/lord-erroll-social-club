import "server-only";
import type { Channel, DeliveryStatus } from "@prisma/client";
import { prisma } from "./db";
import { rateLimit } from "./ratelimit";
import { normPhone } from "./crypto";
import { CLUB } from "./site";

/**
 * Outbound messaging. Each provider is optional: without credentials, messages are
 * logged to the console and recorded as SKIPPED, so local dev and the e2e test run
 * without accounts. `lastMessages` keeps recent dev messages for the e2e test.
 *
 * Recipient addresses are stored masked in NotificationLog (no plain personal data).
 */

export type SendResult = { status: DeliveryStatus; error?: string };
type Attachment = { filename: string; content: Buffer };

const mask = (to: string) => (to.includes("@") ? `${to[0]}•••@${to.split("@")[1]}` : `•••${to.slice(-3)}`);

const g = globalThis as unknown as { __outbox?: { to: string; channel: string; text: string; at: number }[] };
export function devOutbox() {
  return (g.__outbox ??= []);
}
function keepDev(channel: string, to: string, text: string) {
  if (process.env.NODE_ENV === "production") return;
  const box = devOutbox();
  box.push({ channel, to, text, at: Date.now() });
  // Dev convenience: show sign-in codes in the server log (never in production).
  const code = /\b(\d{6})\b/.exec(text)?.[1];
  if (code && /code/i.test(text)) console.info(`[dev] ${channel} code for ${mask(to)}: ${code}`);
  if (box.length > 200) box.shift();
}


async function record(channel: Channel, kind: string, to: string, subject: string | null, r: SendResult) {
  await prisma.notificationLog
    .create({ data: { channel, kind, to: mask(to), subject, status: r.status, error: r.error?.slice(0, 500) } })
    .catch((e) => console.error("[notify] could not record delivery", e));
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
  kind: string;
  attachments?: Attachment[];
}): Promise<SendResult> {
  const to = opts.to.trim();
  if (!to) return { status: "SKIPPED", error: "No recipient" };
  let result: SendResult;
  const key = process.env.RESEND_API_KEY;
  keepDev("EMAIL", to, `${opts.subject}\n${opts.text}`);
  if (!key) {
    console.info(`[email:not-configured] ${opts.kind} → ${mask(to)} · ${opts.subject}`);
    result = { status: "SKIPPED", error: "RESEND_API_KEY not set" };
  } else {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || `${CLUB.name} <membership@lord-erroll.com>`,
          to: [to],
          subject: opts.subject,
          html: opts.html,
          text: opts.text,
          reply_to: process.env.EMAIL_REPLY_TO || CLUB.email,
          attachments: opts.attachments?.map((a) => ({ filename: a.filename, content: a.content.toString("base64") })),
        }),
        signal: AbortSignal.timeout(15000),
      });
      result = res.ok ? { status: "SENT" } : { status: "FAILED", error: `${res.status} ${await res.text()}` };
    } catch (e) {
      result = { status: "FAILED", error: String(e) };
    }
  }
  await record("EMAIL", opts.kind, to, opts.subject, result);
  return result;
}

async function underCap(channel: "sms" | "whatsapp") {
  const cap = Number(process.env.PAID_MESSAGES_HOURLY_CAP) || 500;
  return (await rateLimit(`paid-msg:${channel}`, cap, 3600)).ok;
}

/** SMS through Africa's Talking (AT_*) or Twilio (TWILIO_*), whichever is configured. */
export async function sendSms(rawTo: string, message: string, kind: string): Promise<SendResult> {
  const to = normPhone(rawTo);
  let result: SendResult;
  keepDev("SMS", to, message);
  const { AT_USERNAME, AT_API_KEY, AT_SENDER_ID, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM } = process.env;
  if (!to) result = { status: "SKIPPED", error: "No phone number" };
  else if (!(AT_USERNAME && AT_API_KEY) && !(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_FROM)) {
    console.info(`[sms:not-configured] ${kind} → ${mask(to)}`);
    result = { status: "SKIPPED", error: "No SMS provider configured" };
  } else if (!(await underCap("sms"))) {
    result = { status: "SKIPPED", error: "Hourly SMS cap reached" };
  } else {
    try {
      let res: Response;
      if (AT_USERNAME && AT_API_KEY) {
        const host = AT_USERNAME === "sandbox" ? "api.sandbox.africastalking.com" : "api.africastalking.com";
        const body = new URLSearchParams({ username: AT_USERNAME, to: `+${to}`, message });
        if (AT_SENDER_ID) body.set("from", AT_SENDER_ID);
        res = await fetch(`https://${host}/version1/messaging`, {
          method: "POST",
          headers: { apiKey: AT_API_KEY, Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
          body,
          signal: AbortSignal.timeout(15000),
        });
      } else {
        res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`, {
          method: "POST",
          headers: {
            Authorization: `Basic ${Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64")}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({ To: `+${to}`, From: TWILIO_FROM!, Body: message }),
          signal: AbortSignal.timeout(15000),
        });
      }
      result = res.ok ? { status: "SENT" } : { status: "FAILED", error: `${res.status} ${await res.text()}` };
    } catch (e) {
      result = { status: "FAILED", error: String(e) };
    }
  }
  await record("SMS", kind, to || "-", null, result);
  return result;
}

/**
 * WhatsApp via the Meta Cloud API. Business-initiated messages need an approved template
 * (WHATSAPP_TEMPLATE) with one body variable {{1}} that receives the message text.
 */
export async function sendWhatsApp(rawTo: string, text: string, kind: string): Promise<SendResult> {
  const to = normPhone(rawTo);
  const { WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_TEMPLATE } = process.env;
  let result: SendResult;
  keepDev("WHATSAPP", to, text);
  if (!to) result = { status: "SKIPPED", error: "No phone number" };
  else if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
    console.info(`[whatsapp:not-configured] ${kind} → ${mask(to)}`);
    result = { status: "SKIPPED", error: "WhatsApp Cloud API not configured" };
  } else if (!(await underCap("whatsapp"))) {
    result = { status: "SKIPPED", error: "Hourly WhatsApp cap reached" };
  } else {
    try {
      const res = await fetch(`https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "template",
          template: {
            name: WHATSAPP_TEMPLATE || "club_notice",
            language: { code: "en" },
            components: [{ type: "body", parameters: [{ type: "text", text: text.slice(0, 1000) }] }],
          },
        }),
        signal: AbortSignal.timeout(15000),
      });
      result = res.ok ? { status: "SENT" } : { status: "FAILED", error: `${res.status} ${await res.text()}` };
    } catch (e) {
      result = { status: "FAILED", error: String(e) };
    }
  }
  await record("WHATSAPP", kind, to || "-", null, result);
  return result;
}

export function adminNotifyEmails() {
  return (process.env.ADMIN_NOTIFY_EMAILS || "").split(",").map((s) => s.trim()).filter(Boolean);
}
