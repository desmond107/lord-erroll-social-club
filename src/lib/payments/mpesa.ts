import "server-only";
import crypto from "crypto";
import { appUrl } from "../request";

/**
 * M-Pesa Daraja (Lipa na M-Pesa Online / STK Push).
 *
 * Safaricom does not sign STK callbacks, so a callback is never trusted on its own:
 *  1. the callback URL carries a secret path segment (MPESA_CALLBACK_SECRET);
 *  2. optionally the source IP must be in MPESA_ALLOWED_IPS;
 *  3. the CheckoutRequestID must match a PENDING payment we created, and the amount must match;
 *  4. the result is re-confirmed with the STK Push Query API before the payment is marked paid;
 *  5. the M-Pesa receipt number is unique in the database, so it can't confirm two payments.
 */

export function mpesaConfigured() {
  const e = process.env;
  return !!(e.MPESA_CONSUMER_KEY && e.MPESA_CONSUMER_SECRET && e.MPESA_SHORTCODE && e.MPESA_PASSKEY);
}

/** Dev-only simulator: on when PAYMENTS_SIMULATE=1, never in production. */
export function simulateEnabled() {
  return process.env.PAYMENTS_SIMULATE === "1" && process.env.NODE_ENV !== "production";
}

const base = () => (process.env.MPESA_ENV === "production" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke");

let tokenCache: { token: string; exp: number } | null = null;
async function accessToken() {
  if (tokenCache && tokenCache.exp > Date.now()) return tokenCache.token;
  const auth = Buffer.from(`${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`).toString("base64");
  const res = await fetch(`${base()}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${auth}` },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`M-Pesa auth failed (${res.status})`);
  const j = (await res.json()) as { access_token: string; expires_in: string };
  tokenCache = { token: j.access_token, exp: Date.now() + (Number(j.expires_in) - 60) * 1000 };
  return j.access_token;
}

function timestamp() {
  const d = new Date(Date.now() + 3 * 3600 * 1000); // EAT
  return d.toISOString().replace(/[-:T]/g, "").slice(0, 14);
}

function password(ts: string) {
  return Buffer.from(`${process.env.MPESA_SHORTCODE}${process.env.MPESA_PASSKEY}${ts}`).toString("base64");
}

export function callbackUrl() {
  return `${process.env.MPESA_CALLBACK_BASE || appUrl()}/api/payments/mpesa/callback/${process.env.MPESA_CALLBACK_SECRET || "dev"}`;
}

export function callbackSecretOk(given: string) {
  const want = process.env.MPESA_CALLBACK_SECRET || "dev";
  const a = Buffer.from(given);
  const b = Buffer.from(want);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function ipAllowed(ip: string) {
  const list = (process.env.MPESA_ALLOWED_IPS || "").split(",").map((s) => s.trim()).filter(Boolean);
  return list.length === 0 || list.includes(ip);
}

export async function stkPush(opts: { phone: string; amount: number; accountRef: string; description: string }) {
  if (!mpesaConfigured()) {
    if (simulateEnabled()) return { checkoutRequestId: `SIM-${crypto.randomUUID()}`, simulated: true as const };
    throw new Error("M-Pesa is not configured.");
  }
  const ts = timestamp();
  const type = process.env.MPESA_TRANSACTION_TYPE || "CustomerPayBillOnline";
  const res = await fetch(`${base()}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: { Authorization: `Bearer ${await accessToken()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      BusinessShortCode: process.env.MPESA_SHORTCODE,
      Password: password(ts),
      Timestamp: ts,
      TransactionType: type,
      Amount: opts.amount,
      PartyA: opts.phone,
      PartyB: process.env.MPESA_PARTY_B || process.env.MPESA_SHORTCODE,
      PhoneNumber: opts.phone,
      CallBackURL: callbackUrl(),
      AccountReference: opts.accountRef.slice(0, 12),
      TransactionDesc: opts.description.slice(0, 13),
    }),
    signal: AbortSignal.timeout(20000),
  });
  const j = (await res.json()) as { ResponseCode?: string; CheckoutRequestID?: string; errorMessage?: string; CustomerMessage?: string };
  if (!res.ok || j.ResponseCode !== "0" || !j.CheckoutRequestID) throw new Error(j.errorMessage || j.CustomerMessage || "M-Pesa request failed");
  return { checkoutRequestId: j.CheckoutRequestID, simulated: false as const };
}

/** STK Push Query. Returns the ResultCode as a string ("0" = paid), or null if not final yet. */
export async function stkQuery(checkoutRequestId: string): Promise<string | null> {
  if (checkoutRequestId.startsWith("SIM-")) return simulateEnabled() ? "0" : null;
  const ts = timestamp();
  const res = await fetch(`${base()}/mpesa/stkpushquery/v1/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${await accessToken()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ BusinessShortCode: process.env.MPESA_SHORTCODE, Password: password(ts), Timestamp: ts, CheckoutRequestID: checkoutRequestId }),
    signal: AbortSignal.timeout(20000),
  });
  const j = (await res.json()) as { ResultCode?: string | number; errorCode?: string };
  if (j.ResultCode === undefined || j.ResultCode === null) return null; // still processing
  return String(j.ResultCode);
}

export type StkCallback = {
  Body?: {
    stkCallback?: {
      MerchantRequestID?: string;
      CheckoutRequestID?: string;
      ResultCode?: number;
      ResultDesc?: string;
      CallbackMetadata?: { Item?: { Name: string; Value?: string | number }[] };
    };
  };
};

export function parseCallback(body: StkCallback) {
  const cb = body.Body?.stkCallback;
  if (!cb?.CheckoutRequestID || cb.ResultCode === undefined) return null;
  const item = (n: string) => cb.CallbackMetadata?.Item?.find((i) => i.Name === n)?.Value;
  return {
    checkoutRequestId: cb.CheckoutRequestID,
    resultCode: Number(cb.ResultCode),
    resultDesc: cb.ResultDesc || "",
    amount: item("Amount") != null ? Number(item("Amount")) : null,
    receipt: item("MpesaReceiptNumber") != null ? String(item("MpesaReceiptNumber")) : null,
    phone: item("PhoneNumber") != null ? String(item("PhoneNumber")) : null,
  };
}
