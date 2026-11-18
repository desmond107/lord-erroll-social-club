import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdmin, twoFactorRequired } from "@/lib/admin-auth";
import { can } from "@/lib/roles";
import { getAccount } from "@/lib/member-auth";
import { readUpload } from "@/lib/uploads";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

/**
 * Private file access.
 *  - Photos: staff with verify / applications / members permissions, or the account that owns the card.
 *  - Date-of-birth documents: Super Admin only; every view is written to the audit log.
 */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const f = await prisma.storedFile.findUnique({
    where: { id },
    include: { cardholderPhoto: { include: { membership: true } }, cardholderProof: true, dependantProof: true },
  });
  if (!f) return new NextResponse("Not found", { status: 404 });

  const admin = await getAdmin();
  const adminOk = !!admin && (!twoFactorRequired() || admin.totpEnabled);
  let allowed = false;
  if (f.kind === "DOB_PROOF") {
    allowed = adminOk && can(admin, "documents.sensitive");
    if (allowed) await audit(admin!, "document.view_junior_dob", "StoredFile", f.id, { cardholder: f.cardholderProof?.id ?? null, dependant: f.dependantProof?.id ?? null });
  } else if (adminOk && (can(admin, "verify") || can(admin, "applications") || can(admin, "members.view"))) {
    allowed = true;
  } else {
    const acct = await getAccount();
    allowed = !!acct && f.cardholderPhoto?.membership.accountId === acct.id;
  }
  if (!allowed) return new NextResponse("Not found", { status: 404 });

  const buf = await readUpload(f.path);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": f.mime,
      "Cache-Control": "private, no-store",
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
