import { NextResponse } from "next/server";
import { rgb } from "pdf-lib";
import { prisma } from "@/lib/db";
import { getAccount } from "@/lib/member-auth";
import { getAdmin } from "@/lib/admin-auth";
import { can } from "@/lib/roles";
import { brandedPdf, clean, COL, textCenter, textRight } from "@/lib/pdf";
import { CLUB } from "@/lib/site";
import { fmtDate, kes } from "@/lib/format";

export const dynamic = "force-dynamic";

/** PDF receipt for a paid payment. Owner, or staff with payments.view. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await prisma.payment.findUnique({ where: { id }, include: { membership: { include: { account: true } }, package: true } });
  if (!p || p.status !== "PAID" || !p.receiptNo) return new NextResponse("Not found", { status: 404 });
  const acct = await getAccount();
  const admin = acct ? null : await getAdmin();
  if (!(acct && acct.id === p.membership.accountId) && !(admin && can(admin, "payments.view"))) return new NextResponse("Not found", { status: 404 });

  const { pdf, fonts, crest } = await brandedPdf(`Receipt ${p.receiptNo}`);
  const page = pdf.addPage([420, 595]); // A5
  const W = 420;
  page.drawRectangle({ x: 0, y: 505, width: W, height: 90, color: COL.green });
  page.drawRectangle({ x: 0, y: 502, width: W, height: 3, color: COL.gold });
  page.drawImage(crest, { x: 28, y: 518, width: 52, height: 59 });
  page.drawText("The Lord Erroll", { x: 92, y: 552, size: 24, font: fonts.black, color: COL.gold });
  page.drawText("SOCIAL CLUB", { x: 93, y: 534, size: 8, font: fonts.sansBold, color: COL.gold });
  textRight(page, "RECEIPT", W - 28, 552, fonts.sansBold, 10, COL.gold);
  textRight(page, p.receiptNo, W - 28, 536, fonts.sans, 10, COL.gold);

  let y = 465;
  page.drawText("Received with thanks from", { x: 28, y, size: 9, font: fonts.sans, color: COL.soft });
  y -= 20;
  page.drawText(clean(p.membership.account.fullName), { x: 28, y, size: 18, font: fonts.serif, color: COL.ink });
  y -= 30;
  const rows: [string, string][] = [
    ["Date", fmtDate(p.paidAt)],
    ["Membership number", p.membership.number],
    ["Package", p.package.name],
    ["Description", { NEW: "Annual subscription", RENEWAL: "Annual renewal", UPGRADE: "Package upgrade" }[p.purpose]],
    ["Period", `${fmtDate(p.periodStart)} to ${fmtDate(p.periodEnd)}`],
    ["Payment method", { MPESA: "M-Pesa", CARD: "Card", CASH: "Cash", BANK: "Bank transfer" }[p.method]],
    ...(p.providerTxnId ? [["Transaction reference", p.providerTxnId] as [string, string]] : []),
  ];
  for (const [k, v] of rows) {
    page.drawText(k, { x: 28, y, size: 9, font: fonts.sans, color: COL.soft });
    textRight(page, v, W - 28, y, fonts.sans, 10, COL.ink);
    y -= 8;
    page.drawLine({ start: { x: 28, y }, end: { x: W - 28, y }, thickness: 0.5, color: COL.line });
    y -= 16;
  }
  y -= 8;
  page.drawRectangle({ x: 28, y: y - 14, width: W - 56, height: 40, color: rgb(0.965, 0.937, 0.878) });
  page.drawText("Amount paid", { x: 40, y: y + 2, size: 10, font: fonts.sansBold, color: COL.green });
  textRight(page, kes(p.amountKes), W - 40, y, fonts.serif, 20, COL.green);

  textCenter(page, "Thank you for your membership.", W / 2, 90, fonts.serif, 13, COL.goldInk);
  page.drawLine({ start: { x: 160, y: 78 }, end: { x: 260, y: 78 }, thickness: 0.6, color: COL.gold });
  textCenter(page, `${CLUB.name} · ${CLUB.address}`, W / 2, 56, fonts.sans, 8, COL.soft);
  textCenter(page, `${CLUB.phone} · ${CLUB.email} · ${CLUB.website}`, W / 2, 44, fonts.sans, 8, COL.soft);

  return new NextResponse(new Uint8Array(await pdf.save()), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${p.receiptNo}.pdf"`, "Cache-Control": "private, no-store" },
  });
}
