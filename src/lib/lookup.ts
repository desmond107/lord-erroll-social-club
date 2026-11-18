import "server-only";
import { prisma } from "./db";
import { baseOf, parseCardNumber } from "./numbers";
import { effectiveStatus, EFFECTIVE_LABEL, type EffectiveStatus } from "./membership";
import { getSettings } from "./settings";
import { fmtDate, publicName } from "./format";
import { isMinor } from "./age";

export type PublicHolder = { label: string; cardNumber: string; relationship: string; minor: boolean };

export type PublicLookup =
  | { kind: "none" }
  | { kind: "junior"; status: EffectiveStatus; statusLabel: string }
  | {
      kind: "member";
      number: string;
      packageName: string;
      status: EffectiveStatus;
      statusLabel: string;
      expires: string;
      holders: PublicHolder[];
      family: boolean;
    };

/**
 * The privacy-limited public view: first name + surname initial, package, status, expiry.
 * Junior numbers reveal only validity. Under-18 family members are never named.
 */
export async function publicLookup(input: string): Promise<PublicLookup> {
  const card = parseCardNumber(input);
  if (!card) return { kind: "none" };
  const m = await prisma.membership.findUnique({
    where: { number: baseOf(card) },
    include: { package: true, cardholders: { where: { active: true }, orderBy: { suffix: "asc" } } },
  });
  if (!m || m.status === "CANCELLED") return { kind: "none" };
  const holder = m.cardholders.find((c) => c.cardNumber === card);
  // A suffixed number must match a real card; the base number must not be a junior's -J.
  if (card !== m.number && !holder) return { kind: "none" };
  const { graceDays } = await getSettings();
  const status = effectiveStatus(m, graceDays);

  if (m.isJunior) return { kind: "junior", status, statusLabel: status === "ACTIVE" || status === "GRACE" ? "Active" : EFFECTIVE_LABEL[status] };

  const show = card === m.number ? m.cardholders : [holder!];
  return {
    kind: "member",
    number: card,
    packageName: m.package.name,
    status,
    statusLabel: EFFECTIVE_LABEL[status],
    expires: fmtDate(m.expiresAt),
    family: m.package.kind === "FAMILY",
    holders: show.map((c) => {
      const minor = isMinor(c.dateOfBirth);
      return { label: minor ? "Family member (under 18)" : publicName(c.fullName), cardNumber: c.cardNumber, relationship: c.relationship, minor };
    }),
  };
}
