import type { Package } from "@prisma/client";

/** Benefits shown for a package: main tiers inherit every active lower tier's list. */
export function ladderBenefits(pkg: Package, all: Package[]) {
  if (pkg.kind !== "MAIN") return { inherited: null as Package | null, own: pkg.benefits };
  const lower = all
    .filter((p) => p.kind === "MAIN" && p.active && p.rank < pkg.rank)
    .sort((a, b) => b.rank - a.rank)[0];
  return { inherited: lower ?? null, own: pkg.benefits };
}

/** Full cumulative list (for the member portal). */
export function allBenefits(pkg: Package, all: Package[]) {
  if (pkg.kind !== "MAIN") return pkg.benefits;
  return all
    .filter((p) => p.kind === "MAIN" && p.rank <= pkg.rank)
    .sort((a, b) => a.rank - b.rank)
    .flatMap((p) => p.benefits);
}

/**
 * Mid-term upgrade price: the fee difference pro-rated over the days left in the
 * current period, rounded up to the nearest KES 10. At renewal the full new fee applies.
 */
export function upgradePrice(from: Package, to: Package, expiresAt: Date | null, now = new Date()) {
  const diff = to.annualFeeKes - from.annualFeeKes;
  if (diff <= 0) return 0;
  if (!expiresAt || expiresAt <= now) return diff;
  const daysLeft = Math.min(365, Math.ceil((expiresAt.getTime() - now.getTime()) / 86400000));
  return Math.ceil((diff * daysLeft) / 365 / 10) * 10;
}

export const isUpgrade = (from: Package, to: Package) => from.kind === "MAIN" && to.kind === "MAIN" && to.rank > from.rank;
