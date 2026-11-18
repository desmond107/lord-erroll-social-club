import { NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";
import { prisma } from "@/lib/db";
import { getAccount } from "@/lib/member-auth";
import { getAdmin } from "@/lib/admin-auth";
import { can } from "@/lib/roles";
import { getSettings } from "@/lib/settings";
import { cardDataFor, qrPng } from "@/lib/cards";
import { renderCardPng } from "@/lib/card-image";

export const dynamic = "force-dynamic";

/**
 * /api/cards/:cardholderId/front.png | back.png | card.pdf
 * Owner (the account holding the membership) or staff with members.view.
 */
export async function GET(_: Request, { params }: { params: Promise<{ id: string; face: string }> }) {
  const { id, face } = await params;
  const holder = await prisma.cardholder.findUnique({
    where: { id },
    include: { membership: { include: { package: true, cardholders: true } } },
  });
  if (!holder) return new NextResponse("Not found", { status: 404 });
  const acct = await getAccount();
  const admin = acct ? null : await getAdmin();
  if (!(acct && acct.id === holder.membership.accountId) && !(admin && can(admin, "members.view"))) return new NextResponse("Not found", { status: 404 });
  if (!holder.membership.activatedAt) return new NextResponse("The card is issued once the membership is activated.", { status: 409 });

  const { graceDays } = await getSettings();
  const data = await cardDataFor(holder, holder.membership, graceDays);
  const qr = `data:image/png;base64,${(await qrPng(holder.verifyToken, 520)).toString("base64")}`;
  const fileBase = holder.cardNumber;

  if (face === "front.png" || face === "back.png") {
    const img = await renderCardPng(data, face === "front.png" ? "front" : "back", qr);
    const buf = Buffer.from(await img.arrayBuffer());
    return new NextResponse(new Uint8Array(buf), {
      headers: { "Content-Type": "image/png", "Content-Disposition": `attachment; filename="${fileBase}-${face}"`, "Cache-Control": "private, no-store" },
    });
  }

  if (face === "card.pdf") {
    const [fr, bk] = await Promise.all([renderCardPng(data, "front", qr), renderCardPng(data, "back", qr)]);
    const pdf = await PDFDocument.create();
    pdf.setTitle(`${fileBase} · The Lord Erroll Social Club`);
    // True card size: 85.6 × 54 mm.
    const W = (85.6 / 25.4) * 72;
    const H = (54 / 25.4) * 72;
    for (const r of [fr, bk]) {
      const png = await pdf.embedPng(Buffer.from(await r.arrayBuffer()));
      pdf.addPage([W, H]).drawImage(png, { x: 0, y: 0, width: W, height: H });
    }
    return new NextResponse(new Uint8Array(await pdf.save()), {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${fileBase}.pdf"`, "Cache-Control": "private, no-store" },
    });
  }
  return new NextResponse("Not found", { status: 404 });
}
