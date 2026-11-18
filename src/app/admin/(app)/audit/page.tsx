import type { Prisma } from "@prisma/client";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { fmtDateTime } from "@/lib/format";
import { PageTitle, Empty, Pager } from "@/components/admin/ui";

const PER = 100;

export default async function AuditLog({ searchParams }: { searchParams: Promise<{ q?: string; actor?: string; page?: string }> }) {
  await requireAdmin("audit");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const and: Prisma.AuditLogWhereInput[] = [];
  if (sp.q) and.push({ OR: [{ action: { contains: sp.q } }, { entity: { contains: sp.q } }, { entityId: sp.q }] });
  if (sp.actor) and.push({ actorLabel: { contains: sp.actor, mode: "insensitive" } });
  const where = and.length ? { AND: and } : {};
  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PER, take: PER }),
    prisma.auditLog.count({ where }),
  ]);
  const qs = new URLSearchParams(Object.entries({ q: sp.q, actor: sp.actor }).filter(([, v]) => v) as [string, string][]);
  return (
    <div>
      <PageTitle title="Audit log" sub="Every staff action, sign-in, verification, export and sensitive-document view. Entries cannot be edited." />
      <form className="mb-5 grid gap-3 border border-line-light bg-white p-4 sm:grid-cols-[1fr_1fr_auto]" role="search">
        <input name="q" defaultValue={sp.q} placeholder="Action (e.g. approve, document.view) or record id" aria-label="Action" className="input" />
        <input name="actor" defaultValue={sp.actor} placeholder="Who (email, system, member)" aria-label="Actor" className="input" />
        <button className="btn btn-green btn-sm">Filter</button>
      </form>
      {rows.length === 0 ? <Empty>No entries.</Empty> : (
        <div className="overflow-x-auto border border-line-light bg-white">
          <table className="tbl min-w-[860px]">
            <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Record</th><th>Detail</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap">{fmtDateTime(r.createdAt)}</td>
                  <td className="text-xs">{r.actorLabel}</td>
                  <td className={`font-mono text-xs ${r.action.includes("document") ? "font-bold text-crimson" : ""}`}>{r.action}</td>
                  <td className="font-mono text-[0.7rem] text-ink-soft">{r.entity}{r.entityId ? ` · ${r.entityId.slice(0, 12)}` : ""}</td>
                  <td className="max-w-md font-mono text-[0.7rem] break-all text-ink-soft">{r.detail ? JSON.stringify(r.detail) : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={page} pages={Math.ceil(total / PER)} href={(p) => `/admin/audit?${qs}&page=${p}`} />
    </div>
  );
}
