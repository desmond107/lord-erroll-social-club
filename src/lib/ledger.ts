import "server-only";
import type { Prisma, PaymentStatus, PaymentMethod } from "@prisma/client";
import { prisma } from "./db";

export type LedgerFilter = { q?: string; status?: string; method?: string; from?: string; to?: string };

export function ledgerWhere(f: LedgerFilter): Prisma.PaymentWhereInput {
  const and: Prisma.PaymentWhereInput[] = [];
  if (f.q) {
    const q = f.q.trim().slice(0, 60);
    and.push({ OR: [{ receiptNo: { contains: q.toUpperCase() } }, { providerTxnId: { contains: q.toUpperCase() } }, { membership: { number: { contains: q.toUpperCase() } } }, { membership: { account: { fullName: { contains: q, mode: "insensitive" } } } }] });
  }
  if (["PENDING", "PAID", "FAILED", "CANCELLED"].includes(f.status ?? "")) and.push({ status: f.status as PaymentStatus });
  if (["MPESA", "CARD", "CASH", "BANK"].includes(f.method ?? "")) and.push({ method: f.method as PaymentMethod });
  const from = f.from && /^\d{4}-\d{2}-\d{2}$/.test(f.from) ? new Date(`${f.from}T00:00:00+03:00`) : null;
  const to = f.to && /^\d{4}-\d{2}-\d{2}$/.test(f.to) ? new Date(`${f.to}T23:59:59+03:00`) : null;
  if (from || to) and.push({ OR: [{ paidAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }, { paidAt: null, createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }] });
  return and.length ? { AND: and } : {};
}

export function ledgerRows(where: Prisma.PaymentWhereInput, take?: number, skip?: number) {
  return prisma.payment.findMany({
    where,
    include: { membership: { include: { account: { select: { fullName: true } } } }, package: { select: { name: true } }, confirmedBy: { select: { name: true } } },
    orderBy: [{ paidAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
    take,
    skip,
  });
}
