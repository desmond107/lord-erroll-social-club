import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { fmtDateTime } from "@/lib/format";
import { PageTitle, Empty, Pager } from "@/components/admin/ui";
import { StatusBadge } from "@/components/StatusBadge";

const PER = 30;
const STATUSES = ["PENDING", "INFO_REQUESTED", "APPROVED", "REJECTED"] as const;

export default async function Applications({ searchParams }: { searchParams: Promise<{ status?: string; type?: string; page?: string }> }) {
  await requireAdmin("applications");
  const sp = await searchParams;
  const status = STATUSES.includes(sp.status as never) ? (sp.status as (typeof STATUSES)[number]) : sp.status === "ALL" ? undefined : "PENDING";
  const type = ["INDIVIDUAL", "FAMILY", "JUNIOR"].includes(sp.type ?? "") ? (sp.type as "INDIVIDUAL" | "FAMILY" | "JUNIOR") : undefined;
  const page = Math.max(1, Number(sp.page) || 1);
  const where: Prisma.ApplicationWhereInput = { ...(status ? { status } : {}), ...(type ? { type } : {}) };
  const [rows, total] = await Promise.all([
    prisma.application.findMany({ where, include: { package: true, dependants: true }, orderBy: { createdAt: status === "PENDING" ? "asc" : "desc" }, skip: (page - 1) * PER, take: PER }),
    prisma.application.count({ where }),
  ]);
  const q = (o: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { status: sp.status, type: sp.type, ...o };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    return `/admin/applications?${p}`;
  };

  return (
    <div>
      <PageTitle title="Applications" sub={`${total} ${status ? status.replace("_", " ").toLowerCase() : ""} application${total === 1 ? "" : "s"}`} />
      <div className="mb-5 flex flex-wrap gap-2 text-xs font-semibold tracking-wider uppercase">
        {[...STATUSES, "ALL"].map((s) => (
          <Link key={s} href={q({ status: s, page: undefined })} className={`border px-3 py-1.5 ${(status ?? "ALL") === s ? "border-emerald bg-emerald text-gold-light" : "border-line-light bg-white"}`}>{s.replace("_", " ").toLowerCase()}</Link>
        ))}
        <span className="mx-2 border-l border-line-light" />
        {["", "INDIVIDUAL", "FAMILY", "JUNIOR"].map((t) => (
          <Link key={t || "any"} href={q({ type: t || undefined, page: undefined })} className={`border px-3 py-1.5 ${(type ?? "") === t ? "border-gold-ink bg-gold/20" : "border-line-light bg-white"}`}>{t ? t.toLowerCase() : "any type"}</Link>
        ))}
      </div>
      {rows.length === 0 ? <Empty>No applications here.</Empty> : (
        <div className="overflow-x-auto border border-line-light bg-white">
          <table className="tbl min-w-[760px]">
            <thead><tr><th>Ref</th><th>Applicant</th><th>Type</th><th>Package</th><th>Received</th><th>Status</th></tr></thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id}>
                  <td className="font-mono text-xs"><Link className="link-gold" href={`/admin/applications/${a.id}`}>{a.ref}</Link></td>
                  <td>
                    <Link className="link-gold font-semibold" href={`/admin/applications/${a.id}`}>{a.fullName}</Link>
                    {a.type === "JUNIOR" && <div className="text-xs text-ink-soft">Guardian of {a.dependants[0]?.fullName.split(" ")[0]}</div>}
                    {a.type === "FAMILY" && <div className="text-xs text-ink-soft">+ {a.dependants.length} linked</div>}
                  </td>
                  <td>{a.type === "JUNIOR" ? <span className="font-semibold text-crimson">Junior</span> : a.type.toLowerCase()}</td>
                  <td>{a.package.name}</td>
                  <td className="whitespace-nowrap">{fmtDateTime(a.createdAt)}</td>
                  <td><StatusBadge light status={a.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={page} pages={Math.ceil(total / PER)} href={(p) => q({ page: String(p) })} />
    </div>
  );
}
