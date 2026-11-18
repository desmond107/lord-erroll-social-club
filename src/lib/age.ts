/** Age in whole years on a given date (default: today), using calendar dates. */
export function ageOn(dob: Date, on: Date = new Date()) {
  let age = on.getUTCFullYear() - dob.getUTCFullYear();
  const m = on.getUTCMonth() - dob.getUTCMonth();
  if (m < 0 || (m === 0 && on.getUTCDate() < dob.getUTCDate())) age--;
  return age;
}

export function birthdayAt(dob: Date, years: number) {
  const d = new Date(dob);
  d.setUTCFullYear(d.getUTCFullYear() + years);
  return d;
}

export const isMinor = (dob: Date, on: Date = new Date()) => ageOn(dob, on) < 18;

/** Parses a YYYY-MM-DD form value into a UTC date, or null. */
export function parseDob(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  if (d > new Date() || d.getUTCFullYear() < 1900) return null;
  return d;
}
