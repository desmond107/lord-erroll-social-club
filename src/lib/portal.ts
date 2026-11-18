import "server-only";
import type { Account } from "@prisma/client";
import { prisma } from "./db";
import { getSettings } from "./settings";
import { effectiveStatus } from "./membership";
import { cardDataFor } from "./cards";
import { allBenefits } from "./packages";
import { ageOn, birthdayAt } from "./age";

/** Everything the member dashboard shows for one account. */
export async function portalData(account: Account) {
  const settings = await getSettings();
  const [memberships, handovers, allPkgs, pendingApps] = await Promise.all([
    prisma.membership.findMany({
      where: { accountId: account.id },
      include: {
        package: true,
        cardholders: { where: { active: true }, orderBy: { suffix: "asc" } },
        payments: { orderBy: { createdAt: "desc" }, take: 20 },
      },
      orderBy: [{ isJunior: "asc" }, { createdAt: "asc" }],
    }),
    prisma.membership.findMany({ where: { handoverAccountId: account.id }, include: { package: true, cardholders: true } }),
    prisma.package.findMany({ where: { active: true } }),
    prisma.application.findMany({
      where: { emailIdx: account.emailIdx, status: { in: ["PENDING", "INFO_REQUESTED"] } },
      include: { package: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const items = await Promise.all(
    memberships.map(async (m) => {
      const status = effectiveStatus(m, settings.graceDays);
      const cards = await Promise.all(m.cardholders.map(async (c) => ({ id: c.id, holder: c, data: await cardDataFor(c, m, settings.graceDays) })));
      const child = m.isJunior ? m.cardholders.find((c) => c.suffix === "J") : null;
      const childAge = child ? ageOn(child.dateOfBirth) : null;
      const daysLeft = m.expiresAt ? Math.ceil((m.expiresAt.getTime() - Date.now()) / 86400000) : null;
      return {
        m,
        status,
        cards,
        daysLeft,
        benefits: allBenefits(m.package, allPkgs),
        child,
        childAge,
        child18: child ? birthdayAt(child.dateOfBirth, 18) : null,
        canHandover: !!child && childAge! >= 18,
        renewOpen: m.status === "PENDING_PAYMENT" || status !== "ACTIVE" || (daysLeft != null && daysLeft <= 60) || (!!m.convertedFromJuniorAt && m.package.kind === "JUNIOR"),
      };
    }),
  );

  const anyAdult = items.some((i) => !i.m.isJunior);
  const slugs = items.filter((i) => i.status === "ACTIVE" || i.status === "GRACE").map((i) => i.m.package.slug);
  const [events, announcements] = await Promise.all([
    prisma.event.findMany({
      // Junior-only accounts never see adult-only events.
      where: { published: true, ...(anyAdult ? {} : { adultOnly: false }) },
      orderBy: { sortOrder: "asc" },
    }),
    slugs.length
      ? prisma.announcement.findMany({
          where: {
            showInPortal: true,
            sentAt: { not: null },
            OR: [{ packageSlugs: { isEmpty: true } }, { packageSlugs: { hasSome: slugs } }],
            ...(anyAdult ? {} : { adultOnly: false }),
          },
          orderBy: { sentAt: "desc" },
          take: 6,
        })
      : Promise.resolve([]),
  ]);

  return { items, handovers, events, announcements, pendingApps, settings, allPkgs };
}
