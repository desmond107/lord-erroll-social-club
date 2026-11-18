import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdmin, twoFactorRequired } from "@/lib/admin-auth";
import { can } from "@/lib/roles";
import { decryptOr } from "@/lib/crypto";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

/** Subject-access export (KDPA s.26): everything we hold about the requester, as JSON. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await getAdmin();
  if (!u || (twoFactorRequired() && !u.totpEnabled) || !can(u, "members.edit")) return new NextResponse("Forbidden", { status: 403 });
  const r = await prisma.dataRequest.findUnique({ where: { id } });
  if (!r || r.type !== "EXPORT") return new NextResponse("Not found", { status: 404 });
  const a = await prisma.account.findUniqueOrThrow({
    where: { id: r.accountId },
    include: { memberships: { include: { package: true, cardholders: true, payments: true } } },
  });
  const onlyHolder = r.subject !== "self" ? r.subject : null;
  const data = {
    exportedAt: new Date().toISOString(),
    controller: "The Lord Erroll Social Club",
    account: onlyHolder ? undefined : { name: a.fullName, email: decryptOr(a.emailEnc), phone: decryptOr(a.phoneEnc), marketingConsent: a.marketingOk, created: a.createdAt },
    memberships: a.memberships.map((m) => ({
      number: m.number, package: m.package.name, status: m.status, memberSince: m.memberSince, expires: m.expiresAt,
      cardholders: m.cardholders.filter((c) => !onlyHolder || c.id === onlyHolder).map((c) => ({ name: c.fullName, cardNumber: c.cardNumber, relationship: c.relationship, dateOfBirth: c.dateOfBirth.toISOString().slice(0, 10), hasPhoto: !!c.photoId })),
      payments: onlyHolder ? undefined : m.payments.map((p) => ({ date: p.paidAt ?? p.createdAt, amountKes: p.amountKes, method: p.method, status: p.status, receipt: p.receiptNo })),
    })),
  };
  await audit(u, "data_request.export", "DataRequest", id);
  return new NextResponse(JSON.stringify(data, null, 2), { headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="data-export-${id}.json"`, "Cache-Control": "no-store" } });
}
