import { CLUB } from "./site";

export const kes = (n: number) => `KES ${n.toLocaleString("en-KE")}`;

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: CLUB.timezone });
const shortFmt = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: CLUB.timezone });
const dtFmt = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: CLUB.timezone,
});

export const fmtDate = (d: Date | null | undefined) => (d ? dateFmt.format(d) : "—");
export const fmtShort = (d: Date | null | undefined) => (d ? shortFmt.format(d) : "—");
export const fmtDateTime = (d: Date | null | undefined) => (d ? dtFmt.format(d) : "—");

/** MM/YY for "Valid thru". */
export function validThru(d: Date | null | undefined) {
  if (!d) return "--/--";
  const parts = new Intl.DateTimeFormat("en-GB", { month: "2-digit", year: "2-digit", timeZone: CLUB.timezone }).formatToParts(d);
  return `${parts.find((p) => p.type === "month")?.value}/${parts.find((p) => p.type === "year")?.value}`;
}

export const DAY_MS = 24 * 3600 * 1000;
export const daysBetween = (a: Date, b: Date) => Math.ceil((b.getTime() - a.getTime()) / DAY_MS);

export function addYears(d: Date, n: number) {
  const x = new Date(d);
  x.setUTCFullYear(x.getUTCFullYear() + n);
  return x;
}

export function addDays(d: Date, n: number) {
  return new Date(d.getTime() + n * DAY_MS);
}

/** "Jane W." for public displays. */
export function publicName(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

export const firstName = (fullName: string) => fullName.trim().split(/\s+/)[0];

export const STATUS_LABEL: Record<string, string> = {
  PENDING_PAYMENT: "Pending",
  ACTIVE: "Active",
  EXPIRED: "Expired",
  SUSPENDED: "Suspended",
  LAPSED: "Expired",
  CANCELLED: "Cancelled",
};
