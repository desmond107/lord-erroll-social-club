import { NextResponse } from "next/server";
import { devOutbox } from "@/lib/notify";

export const dynamic = "force-dynamic";

/** DEVELOPMENT ONLY: recent outbound messages (OTP codes etc.) for the e2e test. Needs the cron secret. */
export async function GET(req: Request) {
  if (process.env.NODE_ENV === "production") return new NextResponse("Not found", { status: 404 });
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return new NextResponse("Forbidden", { status: 403 });
  return NextResponse.json(devOutbox().slice(-80));
}
