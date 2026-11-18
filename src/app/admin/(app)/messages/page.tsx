import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { fmtDateTime } from "@/lib/format";
import { PageTitle, Card, Empty } from "@/components/admin/ui";
import { ActionForm } from "@/components/ActionForm";
import { sendAnnouncement, sendReminders } from "./actions";

function AudienceFields({ pkgs, defaultAudience, adultDefault }: { pkgs: { slug: string; name: string }[]; defaultAudience: string; adultDefault?: boolean }) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
        <label className="field block"><span className="label">Send to</span>
          <select name="audience" defaultValue={defaultAudience} className="input">
            <option value="active">All active members</option>
            <option value="expiring">Expiring within…</option>
            <option value="expired">Expired members</option>
            <option value="pending_payment">Approved, awaiting payment</option>
          </select>
        </label>
        <label className="field block"><span className="label">Days</span><input name="days" type="number" min={1} max={90} defaultValue={30} className="input" /></label>
      </div>
      <fieldset>
        <legend className="label">Packages (none ticked = all)</legend>
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">{pkgs.map((p) => <label key={p.slug} className="flex items-center gap-2"><input type="checkbox" name="packages" value={p.slug} className="accent-[var(--emerald)]" />{p.name}</label>)}</div>
      </fieldset>
      <fieldset>
        <legend className="label">Channels</legend>
        <div className="flex flex-wrap gap-5 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" name="channels" value="EMAIL" defaultChecked className="accent-[var(--emerald)]" />Email</label>
          <label className="flex items-center gap-2"><input type="checkbox" name="channels" value="SMS" className="accent-[var(--emerald)]" />SMS</label>
          <label className="flex items-center gap-2"><input type="checkbox" name="channels" value="WHATSAPP" className="accent-[var(--emerald)]" />WhatsApp</label>
        </div>
      </fieldset>
      <div className="flex flex-wrap gap-5 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" name="adultOnly" defaultChecked={adultDefault} className="accent-[var(--emerald)]" />Adult-only content (exclude Junior memberships)</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="marketing" className="accent-[var(--emerald)]" />Marketing: only members who opted in</label>
      </div>
    </div>
  );
}

export default async function Messages() {
  await requireAdmin("messaging");
  const [pkgs, sent] = await Promise.all([
    prisma.package.findMany({ orderBy: { sortOrder: "asc" }, select: { slug: true, name: true } }),
    prisma.announcement.findMany({ orderBy: { createdAt: "desc" }, take: 15, include: { createdBy: { select: { name: true } } } }),
  ]);
  return (
    <div className="max-w-5xl">
      <PageTitle title="Messages" sub="Messages go to the account holder. For Junior memberships that is the parent or guardian, never the child." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Bulk renewal reminder">
          <p className="mb-4 text-sm text-ink-soft">Automatic reminders already go out 30, 14 and 3 days before expiry. Use this for an extra nudge.</p>
          <ActionForm action={sendReminders} submit="Send reminders" confirm="Send renewal reminders to everyone in this audience?">
            <AudienceFields pkgs={pkgs} defaultAudience="expiring" />
          </ActionForm>
        </Card>
        <Card title="Announcement or event invitation">
          <ActionForm action={sendAnnouncement} submit="Send announcement" confirm="Send this announcement now?">
            <div className="mb-4 grid gap-3">
              <label className="field block"><span className="label">Title</span><input name="title" required maxLength={120} className="input" /></label>
              <label className="field block"><span className="label">Message</span><textarea name="body" required rows={6} maxLength={4000} className="input" /></label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="portal" defaultChecked className="accent-[var(--emerald)]" />Also show in the member portal</label>
            </div>
            <AudienceFields pkgs={pkgs} defaultAudience="active" adultDefault />
          </ActionForm>
        </Card>
      </div>
      <Card title="Sent announcements" className="mt-6">
        {sent.length === 0 ? <Empty>Nothing sent yet.</Empty> : (
          <table className="tbl">
            <thead><tr><th>Sent</th><th>Title</th><th>Audience</th><th>Recipients</th><th>By</th></tr></thead>
            <tbody>{sent.map((a) => (
              <tr key={a.id}><td className="whitespace-nowrap">{fmtDateTime(a.sentAt)}</td><td>{a.title}</td><td className="text-xs">{a.packageSlugs.length ? a.packageSlugs.join(", ") : "All"}{a.adultOnly ? " · adults" : ""} · {a.channels.join("/")}</td><td>{a.recipients}</td><td>{a.createdBy.name}</td></tr>
            ))}</tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
