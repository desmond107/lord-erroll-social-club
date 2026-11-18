import { NextResponse } from "next/server";
import { destroyAdminSession, getAdmin } from "@/lib/admin-auth";
import { sameOrigin } from "@/lib/request";
import { audit } from "@/lib/audit";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return new NextResponse("Forbidden", { status: 403 });
  const u = await getAdmin();
  if (u) await audit(u, "admin.logout", "AdminUser", u.id);
  await destroyAdminSession();
  return NextResponse.redirect(new URL("/admin/login", req.url), 303);
}
