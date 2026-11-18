import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getAdmin, twoFactorRequired } from "@/lib/admin-auth";
import { can } from "@/lib/roles";
import { prisma } from "@/lib/db";
import { ledgerRows, ledgerWhere } from "@/lib/ledger";
import { audit } from "@/lib/audit";
import { getSettings } from "@/lib/settings";
import { effectiveStatus, EFFECTIVE_LABEL } from "@/lib/membership";
import { brandedPdf, clean, COL, textRight } from "@/lib/pdf";
import { fmtDate, kes } from "@/lib/format";

export const dynamic = "force-dynamic";

type Table = { title: string; columns: string[]; rows: (string | number)[][] };

/** Exports the payment ledger (payments.view) or member directory (members.view) as CSV, Excel or PDF. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const type = url.searchParams.get("type") === "members" ? "members" : "payments";
  const format = url.searchParams.get("format") ?? "csv";
  const user = await getAdmin();
  if (!user || (twoFactorRequired() && !user.totpEnabled) || !can(user, type === "members" ? "members.view" : "payments.view"))
    return new NextResponse("Forbidden", { status: 403 });

  const t = type === "payments" ? await paymentsTable(Object.fromEntries(url.searchParams)) : await membersTable();
  await audit(user, "export", type === "payments" ? "Payment" : "Membership", null, { format, rows: t.rows.length });
  const stamp = new Date().toISOString().slice(0, 10);
  const name = `lord-erroll-${type}-${stamp}`;

  if (format === "xlsx") {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(t.title);
    ws.addRow(t.columns).font = { bold: true };
    t.rows.forEach((r) => ws.addRow(r));
    ws.columns.forEach((c) => (c.width = 20));
    const buf = await wb.xlsx.writeBuffer();
    return new NextResponse(new Uint8Array(buf as ArrayBuffer), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${name}.xlsx"` } });
  }
  if (format === "pdf") {
    return new NextResponse(new Uint8Array(await tablePdf(t)), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${name}.pdf"` } });
  }
  // CSV, with formula-injection protection for spreadsheet apps.
  const cell = (v: string | number) => {
    let s = String(v ?? "");
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [t.columns, ...t.rows].map((r) => r.map(cell).join(",")).join("\r\n");
  return new NextResponse(`﻿${csv}`, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}.csv"` } });
}

async function paymentsTable(sp: Record<string, string>): Promise<Table> {
  const rows = await ledgerRows(ledgerWhere(sp), 20000);
  return {
    title: "Payments",
    columns: ["Date", "Receipt", "Membership", "Member", "Package", "Purpose", "Method", "Reference", "Status", "Amount (KES)", "Period start", "Period end", "Confirmed by"],
    rows: rows.map((p) => [
      (p.paidAt ?? p.createdAt).toISOString().slice(0, 16).replace("T", " "), p.receiptNo ?? "", p.membership.number, p.membership.account.fullName,
      p.package.name, p.purpose, p.method, p.providerTxnId ?? "", p.status, p.amountKes, p.periodStart?.toISOString().slice(0, 10) ?? "",
      p.periodEnd?.toISOString().slice(0, 10) ?? "", p.confirmedBy?.name ?? "",
    ]),
  };
}

async function membersTable(): Promise<Table> {
  const { graceDays } = await getSettings();
  const ms = await prisma.membership.findMany({ include: { account: { select: { fullName: true } }, package: true, cardholders: true }, orderBy: { number: "asc" } });
  return {
    title: "Members",
    columns: ["Number", "Name", "Package", "Status", "Junior", "Member since", "Expires", "Cards"],
    // Contact details are deliberately left out of exports.
    rows: ms.map((m) => [m.number, m.isJunior ? `${m.cardholders[0]?.displayName ?? ""} (guardian ${m.account.fullName})` : m.account.fullName, m.package.name, EFFECTIVE_LABEL[effectiveStatus(m, graceDays)], m.isJunior ? "Yes" : "", fmtDate(m.memberSince), fmtDate(m.expiresAt), m.cardholders.length]),
  };
}

async function tablePdf(t: Table) {
  const { pdf, fonts, crest } = await brandedPdf(`${t.title} export`);
  const W = 842, H = 595; // A4 landscape
  const cols = t.columns.length;
  const colW = (W - 60) / cols;
  let page = pdf.addPage([W, H]);
  let y = H - 40;
  const header = () => {
    page.drawImage(crest, { x: 30, y: H - 62, width: 26, height: 30 });
    page.drawText(`The Lord Erroll Social Club · ${t.title}`, { x: 64, y: H - 48, size: 14, font: fonts.serif, color: COL.green });
    textRight(page, `Exported ${fmtDate(new Date())}`, W - 30, H - 48, fonts.sans, 8, COL.soft);
    y = H - 84;
    t.columns.forEach((c, i) => page.drawText(clean(c).slice(0, 18), { x: 30 + i * colW, y, size: 7, font: fonts.sansBold, color: COL.soft }));
    y -= 6;
    page.drawLine({ start: { x: 30, y }, end: { x: W - 30, y }, thickness: 0.6, color: COL.gold });
    y -= 12;
  };
  header();
  let total = 0;
  for (const r of t.rows) {
    if (y < 40) {
      page = pdf.addPage([W, H]);
      header();
    }
    r.forEach((v, i) => {
      const s = clean(typeof v === "number" ? v.toLocaleString("en-KE") : String(v));
      const max = Math.floor(colW / 4.2);
      page.drawText(s.length > max ? `${s.slice(0, max - 1)}…` : s, { x: 30 + i * colW, y, size: 7, font: fonts.sans, color: COL.ink });
    });
    if (t.title === "Payments" && r[8] === "PAID") total += Number(r[9]);
    y -= 13;
  }
  if (t.title === "Payments") {
    y -= 6;
    page.drawText(`Total paid: ${kes(total)}`, { x: 30, y: Math.max(y, 30), size: 10, font: fonts.sansBold, color: COL.green });
  }
  return pdf.save();
}
