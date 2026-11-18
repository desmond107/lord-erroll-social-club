import { NextResponse } from "next/server";
import crypto from "crypto";
import { runDaily } from "@/lib/membership";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Daily job: reminders, expiry, junior age-out, housekeeping. Authorization: Bearer $CRON_SECRET. */
async function handle(req: Request) {
  const want = `Bearer ${process.env.CRON_SECRET || ""}`;
  const got = req.headers.get("authorization") || "";
  if (!process.env.CRON_SECRET || got.length !== want.length || !crypto.timingSafeEqual(Buffer.from(got), Buffer.from(want)))
    return new NextResponse("Forbidden", { status: 403 });
  const report = await runDaily();
  await audit("system", "cron.daily", "System", null, report);
  return NextResponse.json(report);
}
export const GET = handle;
export const POST = handle;
