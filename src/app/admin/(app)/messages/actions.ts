"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { guarded, str, InputError, type ActionResult } from "@/lib/admin-action";
import { sendToAudience, type Audience, type AudienceFilter } from "@/lib/messaging";
import * as mails from "@/lib/emails";
import { audit } from "@/lib/audit";

function filterFrom(fd: FormData): { f: AudienceFilter; channels: string[] } {
  const audience = str(fd, "audience") as Audience;
  if (!["active", "expiring", "expired", "pending_payment"].includes(audience)) throw new InputError("Choose who to send to.");
  const channels = fd.getAll("channels").map(String).filter((c) => ["EMAIL", "SMS", "WHATSAPP"].includes(c));
  if (!channels.length) throw new InputError("Choose at least one channel.");
  return {
    f: {
      audience,
      days: Math.max(1, Math.min(90, Number(fd.get("days")) || 30)),
      packageSlugs: fd.getAll("packages").map(String).filter(Boolean),
      adultOnly: fd.get("adultOnly") === "on",
      marketingOnly: fd.get("marketing") === "on",
    },
    channels,
  };
}

export async function sendReminders(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return guarded("messaging", async (u) => {
    const { f, channels } = filterFrom(fd);
    const n = await sendToAudience(
      f,
      (m) => mails.renewalReminder(m.account.fullName, m.number, m.expiresAt ?? new Date(), m.expiresAt ? Math.ceil((m.expiresAt.getTime() - Date.now()) / 86400000) : 0),
      "bulk.reminder",
      channels,
    );
    await audit(u, "messaging.bulk_reminder", "Membership", null, { audience: f.audience, packages: f.packageSlugs, channels, recipients: n });
    return `Renewal reminder sent to ${n} account holder(s).`;
  });
}

export async function sendAnnouncement(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return guarded("messaging", async (u) => {
    const title = str(fd, "title", 120);
    const body = str(fd, "body", 4000);
    if (title.length < 3 || body.length < 10) throw new InputError("Write a title and a message.");
    const { f, channels } = filterFrom(fd);
    const n = await sendToAudience(f, () => mails.announcementMail(title, body), "announcement", channels);
    await prisma.announcement.create({
      data: { title, body, packageSlugs: f.packageSlugs, channels, adultOnly: f.adultOnly, showInPortal: fd.get("portal") === "on", sentAt: new Date(), recipients: n, createdById: u.id },
    });
    await audit(u, "messaging.announcement", "Announcement", null, { title, packages: f.packageSlugs, channels, recipients: n });
    revalidatePath("/admin/messages");
    return `Sent to ${n} account holder(s).`;
  });
}
