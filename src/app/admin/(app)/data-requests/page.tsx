import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { can } from "@/lib/roles";
import { prisma } from "@/lib/db";
import { fmtDateTime } from "@/lib/format";
import { PageTitle, Card, Empty } from "@/components/admin/ui";
import { StatusBadge } from "@/components/StatusBadge";
import { ActionForm } from "@/components/ActionForm";
import { erase, resolveRequest } from "./actions";

export default async function DataRequests() {
  const user = await requireAdmin("members.edit");
  const reqs = await prisma.dataRequest.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 100,
    include: { account: { include: { memberships: { select: { id: true, number: true } } } } },
  });
  const holders = await prisma.cardholder.findMany({ where: { id: { in: reqs.map((r) => r.subject).filter((s) => s !== "self") } }, select: { id: true, displayName: true, relationship: true } });
  const superAdmin = can(user, "documents.sensitive");
  return (
    <div className="max-w-5xl">
      <PageTitle title="Data requests" sub="Correction, export and deletion requests under the Kenya Data Protection Act. Respond within 14 days." />
      {reqs.length === 0 ? <Empty>No requests.</Empty> : (
        <div className="space-y-4">
          {reqs.map((r) => {
            const h = holders.find((x) => x.id === r.subject);
            const daysOpen = Math.floor((Date.now() - r.createdAt.getTime()) / 86400000);
            return (
              <Card key={r.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold">{r.type.toLowerCase()} · {r.account.fullName}{h && <> on behalf of <span className="text-crimson">{h.displayName} ({h.relationship})</span></>}</div>
                    <div className="text-xs text-ink-soft">{fmtDateTime(r.createdAt)} · {r.account.memberships.map((m) => <Link key={m.id} className="link-gold mr-2" href={`/admin/members/${m.id}`}>{m.number}</Link>)}</div>
                    {r.details && <p className="mt-2 text-sm whitespace-pre-line">{r.details}</p>}
                    {r.resolution && <p className="mt-2 text-sm text-ok">Resolved: {r.resolution}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    {r.status === "OPEN" && daysOpen >= 10 && <span className="text-xs font-semibold text-bad">{daysOpen} days open</span>}
                    <StatusBadge light status={r.status === "OPEN" ? "PENDING" : "APPROVED"} label={r.status.toLowerCase()} />
                  </div>
                </div>
                {r.status === "OPEN" && (
                  <div className="mt-4 grid gap-4 border-t border-line-light pt-4 md:grid-cols-2">
                    <ActionForm action={resolveRequest} submit="Mark done" buttonClass="btn btn-outline btn-sm">
                      <input type="hidden" name="id" value={r.id} />
                      <input name="resolution" required placeholder={r.type === "EXPORT" ? "e.g. Export emailed on …" : "What was changed"} className="input" />
                      {r.type === "EXPORT" && <p className="hint">Download the export: <a className="link-gold" href={`/api/admin/data-export/${r.id}`}>JSON file</a>, then send it to the member&apos;s registered email.</p>}
                    </ActionForm>
                    {r.type === "DELETION" && (superAdmin ? (
                      <ActionForm action={erase} submit="Erase personal data" buttonClass="btn btn-sm border border-bad text-bad" confirm="This cannot be undone. Erase this personal data now?">
                        <input type="hidden" name="id" value={r.id} />
                        <input name="confirm" required placeholder="Type ERASE to confirm" className="input" />
                      </ActionForm>
                    ) : <p className="text-sm text-ink-soft">Erasure is carried out by a Super Admin.</p>)}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
