import { NextResponse } from "next/server";
import { callbackSecretOk, ipAllowed } from "@/lib/payments/mpesa";
import { handleStkCallback } from "@/lib/payments/mpesa-handler";

export const dynamic = "force-dynamic";

/**
 * Safaricom STK Push callback. Answers 200 to well-formed requests (Safaricom retries
 * otherwise); the real decision is made in handleStkCallback, which re-confirms the
 * payment with the STK Query API before applying it.
 */
export async function POST(req: Request, { params }: { params: Promise<{ secret: string }> }) {
  const { secret } = await params;
  if (!callbackSecretOk(secret)) return new NextResponse("Not found", { status: 404 });
  const ip = (req.headers.get("x-forwarded-for")?.split(",")[0] || "").trim();
  if (!ipAllowed(ip)) {
    console.warn("[mpesa] callback from non-allowlisted IP", ip);
    return new NextResponse("Forbidden", { status: 403 });
  }
  const text = await req.text();
  if (text.length > 20000) return new NextResponse("Too large", { status: 413 });
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ ResultCode: 1, ResultDesc: "Bad JSON" }, { status: 400 });
  }
  const r = await handleStkCallback(body as never);
  if (!r.ok) console.warn("[mpesa] callback not applied:", r.message);
  return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
}
