import { NextResponse } from "next/server";
import { destroyMemberSession } from "@/lib/member-auth";
import { sameOrigin } from "@/lib/request";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return new NextResponse("Forbidden", { status: 403 });
  await destroyMemberSession();
  return NextResponse.redirect(new URL("/", req.url), 303);
}
