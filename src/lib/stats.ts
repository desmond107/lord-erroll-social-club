import "server-only";
import { prisma } from "./db";
import { getSettings } from "./settings";
import { addDays } from "./format";
import { birthdayAt } from "./age";

/** Overview analytics for the admin dashboard. */
export async function overviewStats() {
  const now = new Date();
  const { graceDays, juniorAgeOutNoticeDays } = await getSettings();
  const yearAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));

  const [byStatus, pendingApps, infoApps, upcoming, paid, pkgs, juniors] = await Promise.all([
    prisma.membership.groupBy({ by: ["status"], _count: true }),
    prisma.application.count({ where: { status: "PENDING" } }),
    prisma.application.count({ where: { status: "INFO_REQUESTED" } }),
    prisma.membership.findMany({
      where: { status: "ACTIVE", expiresAt: { gte: addDays(now, -graceDays), lte: addDays(now, 30) } },
      include: { account: { select: { fullName: true } }, package: { select: { name: true } } },
      orderBy: { expiresAt: "asc" },
      take: 12,
    }),
    prisma.payment.findMany({ where: { status: "PAID", paidAt: { gte: yearAgo } }, select: { amountKes: true, paidAt: true, packageId: true } }),
    prisma.package.findMany({ orderBy: [{ sortOrder: "asc" }] }),
    prisma.cardholder.findMany({ where: { suffix: "J", membership: { isJunior: true, status: { in: ["ACTIVE", "PENDING_PAYMENT", "EXPIRED"] } } }, include: { membership: true } }),
  ]);

  const count = (s: string) => byStatus.find((b) => b.status === s)?._count ?? 0;
  const months: { key: string; label: string; total: number }[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(Date.UTC(yearAgo.getUTCFullYear(), yearAgo.getUTCMonth() + i, 1));
    months.push({ key: d.toISOString().slice(0, 7), label: d.toLocaleString("en-GB", { month: "short", timeZone: "UTC" }), total: 0 });
  }
  const byPkg = new Map<string, number>();
  for (const p of paid) {
    const k = p.paidAt!.toISOString().slice(0, 7);
    const m = months.find((x) => x.key === k);
    if (m) m.total += p.amountKes;
    byPkg.set(p.packageId, (byPkg.get(p.packageId) ?? 0) + p.amountKes);
  }
  const nearing18 = juniors
    .map((j) => ({ j, b: birthdayAt(j.dateOfBirth, 18) }))
    .filter(({ b }) => b.getTime() - now.getTime() <= juniorAgeOutNoticeDays * 86400000)
    .sort((a, b) => a.b.getTime() - b.b.getTime());

  return {
    total: byStatus.reduce((n, b) => n + b._count, 0),
    active: count("ACTIVE"),
    expired: count("EXPIRED") + count("LAPSED"),
    pendingPayment: count("PENDING_PAYMENT"),
    suspended: count("SUSPENDED"),
    pendingApps,
    infoApps,
    upcoming,
    months,
    revenue12: paid.reduce((n, p) => n + p.amountKes, 0),
    byPackage: pkgs.map((p) => ({ name: p.name, total: byPkg.get(p.id) ?? 0 })).filter((x) => x.total > 0).sort((a, b) => b.total - a.total),
    nearing18,
  };
}
