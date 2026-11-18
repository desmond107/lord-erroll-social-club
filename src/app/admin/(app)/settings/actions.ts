"use server";

import { revalidatePath } from "next/cache";
import { guarded, int, str, InputError, type ActionResult } from "@/lib/admin-action";
import { getSettings, saveSettings } from "@/lib/settings";
import { audit } from "@/lib/audit";

export async function saveSettingsAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return guarded("settings", async (u) => {
    const graceDays = int(fd, "graceDays");
    const juniorMinAge = int(fd, "juniorMinAge");
    const juniorMaxAge = int(fd, "juniorMaxAge");
    const juniorConvertGraceDays = int(fd, "juniorConvertGraceDays");
    const reminderDays = str(fd, "reminderDays", 60).split(/[,\s]+/).map(Number).filter((n) => Number.isInteger(n) && n > 0 && n <= 120);
    const reminderChannels = fd.getAll("reminderChannels").map(String).filter((c) => ["EMAIL", "SMS", "WHATSAPP"].includes(c));
    if (graceDays < 0 || graceDays > 90) throw new InputError("Grace period must be 0–90 days.");
    if (juniorMaxAge > 17) throw new InputError("Junior membership is for under-18s: the maximum age is 17.");
    if (juniorMinAge < 0 || juniorMinAge > juniorMaxAge) throw new InputError("Check the Junior age range.");
    if (!reminderDays.length) throw new InputError("Enter at least one reminder day, e.g. 30, 14, 3.");
    if (!reminderChannels.length) throw new InputError("Choose at least one reminder channel.");
    const before = await getSettings();
    const patch = {
      graceDays, juniorMinAge, juniorMaxAge, juniorConvertGraceDays,
      reminderDays: [...new Set(reminderDays)].sort((a, b) => b - a), reminderChannels,
      juniorAccompanyRule: str(fd, "juniorAccompanyRule", 300) || before.juniorAccompanyRule,
      paybillNumber: str(fd, "paybillNumber", 20), bankDetails: str(fd, "bankDetails", 400),
    };
    await saveSettings(patch);
    await audit(u, "settings.update", "Setting", null, { graceDays, juniorMinAge, juniorMaxAge, reminderDays: patch.reminderDays });
    revalidatePath("/admin/settings");
    return "Settings saved.";
  });
}
