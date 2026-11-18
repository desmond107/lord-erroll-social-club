import "server-only";
import { prisma } from "./db";

/** Owner-configurable rules. Defaults apply until changed in Admin → Settings. */
export const SETTING_DEFAULTS = {
  /** Days after expiry before the status becomes Expired and the card is deactivated. */
  graceDays: 14,
  /** Junior age range (inclusive) at application and renewal. */
  juniorMinAge: 8,
  juniorMaxAge: 17,
  /** Days after turning 18 for a junior to convert before the membership lapses. */
  juniorConvertGraceDays: 60,
  /** Days before expiry when reminders go out. */
  reminderDays: [30, 14, 3] as number[],
  /** Days before a junior's 18th birthday when the guardian is told. */
  juniorAgeOutNoticeDays: 60,
  /** Minimum age an accompanying adult must be (owner can change). */
  juniorAccompanyRule: "Junior members must be accompanied by their parent/guardian or another approved adult at all times on the premises.",
  /** Remind via these channels. */
  reminderChannels: ["EMAIL", "SMS"] as string[],
  /** Payment instructions shown for manual (cash/bank) payment. */
  paybillNumber: "",
  bankDetails: "",
};

export type Settings = {
  graceDays: number;
  juniorMinAge: number;
  juniorMaxAge: number;
  juniorConvertGraceDays: number;
  reminderDays: number[];
  juniorAgeOutNoticeDays: number;
  juniorAccompanyRule: string;
  reminderChannels: string[];
  paybillNumber: string;
  bankDetails: string;
};

export async function getSettings(): Promise<Settings> {
  const rows = await prisma.setting.findMany();
  const out: Settings = { ...SETTING_DEFAULTS, reminderDays: [...SETTING_DEFAULTS.reminderDays], reminderChannels: [...SETTING_DEFAULTS.reminderChannels] };
  for (const r of rows) if (r.key in out) (out as Record<string, unknown>)[r.key] = r.value;
  return out;
}

export async function saveSettings(patch: Partial<Settings>) {
  await prisma.$transaction(
    Object.entries(patch).map(([key, value]) =>
      prisma.setting.upsert({ where: { key }, create: { key, value: value as never }, update: { value: value as never } }),
    ),
  );
}
