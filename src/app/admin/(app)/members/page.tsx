import Link from "next/link";
import type { Prisma, MembershipStatus } from "@prisma/client";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { phoneIdx } from "@/lib/crypto";
import { getSettings } from "@/lib/settings";
import { effectiveStatus, EFFECTIVE_LABEL } from "@/lib/membership";
import { birthdayAt } from "@/lib/age";
import { fmtDate } from "@/lib/format";
import { PageTitle, Empty, Pager } from "@/components/admin/ui";
import { StatusBadge } from "@/components/StatusBadge";

const PER = 40;
const STATUSES: MembershipStatus[] = ["ACTIVE", "PENDING_PAYMENT", "EXPIRED", "SUSPENDED", "LAPSED", "CANCELLED"];

export default async function Members({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; pkg?: string; junior?: string; page?: string }> }) {
  await requireAdmin("members.view");
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 80);
  const page = Math.max(1, Number(sp.page) || 1);
  const { graceDays, juniorAgeOutNoticeDays } = await getSettings();

  const and: Prisma.MembershipWhereInput[] = [];
  if (q) {
    const digits = q.replace(/\D/g, "");
    and.push({
      OR: [
        { number: { contains: q.toUpperCase() } },
        { cardholders: { some: { OR: [{ fullName: { contains: q, mode: "insensitive" } }, { cardNumber: { contains: q.toUpperCase() } }] } } },
        { account: { fullName: { contains: q, mode: "insensitive" } } },
        ...(digits.length >= 9 ? [{ account: { phoneIdx: phoneIdx(q) } }] : []),
      ],
    });
  }
  if (STATUSES.includes(sp.status as MembershipStatus)) and.push({ status: sp.status as MembershipStatus });
  if (sp.pkg) and.push({ package: { slug: sp.pkg } });
  if (sp.junior === "1") and.push({ isJunior: true });
  const where: Prisma.MembershipWhereInput = and.length ? { AND: and } : {};

  const [rows, total, pkgs] = await Promise.all([
    prisma.membership.findMany({
      where,
      include: { account: true, package: true, cardholders: { orderBy: { suffix: "asc" } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PER,
      take: PER,
    }),
    prisma.membership.count({ where }),
    prisma.package.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);
  const link = (o: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ q: sp.q, status: sp.status, pkg: sp.pkg, junior: sp.junior, ...o })) if (v) p.set(k, v);
    return `/admin/members?${p}`;
  };

  return (
    <div>
      <PageTitle title="Members" sub={`${total} membership${total === 1 ? "" : "s"}`} actions={<a href="/api/admin/export?type=members&format=csv" className="btn btn-outline btn-sm">Export CSV</a>} />
      <form className="mb-5 grid gap-3 border border-line-light bg-white p-4 sm:grid-cols-[1fr_auto_auto_auto_auto]" role="search">
        <input name="q" defaultValue={q} placeholder="Name, number or phone" aria-label="Search" className="input" />
        <select name="status" defaultValue={sp.status ?? ""} aria-label="Status" className="input">
          <option value="">Any status</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ").toLowerCase()}</option>)}
        </select>
        <select name="pkg" defaultValue={sp.pkg ?? ""} aria-label="Package" className="input">
          <option value="">Any package</option>
          {pkgs.map((p) => <option key={p.id} value={p.slug}>{p.name}</option>)}
        </select>
        <label className="flex items-center gap-2 px-2 text-sm"><input type="checkbox" name="junior" value="1" defaultChecked={sp.junior === "1"} className="accent-[var(--emerald)]" /> Junior only</label>
        <button className="btn btn-green btn-sm">Search</button>
      </form>

      {rows.length === 0 ? <Empty>No members match.</Empty> : (
        <div className="overflow-x-auto border border-line-light bg-white">
          <table className="tbl min-w-[860px]">
            <thead><tr><th>Number</th><th>Member</th><th>Package</th><th>Status</th><th>Expires</th><th>Cards</th></tr></thead>
            <tbody>
              {rows.map((m) => {
                const st = effectiveStatus(m, graceDays);
                const child = m.isJunior ? m.cardholders.find((c) => c.suffix === "J") : null;
                const b18 = child ? birthdayAt(child.dateOfBirth, 18) : null;
                const nearing = b18 && b18.getTime() - Date.now() < juniorAgeOutNoticeDays * 86400000;
                return (
                  <tr key={m.id}>
                    <td className="font-mono text-xs whitespace-nowrap"><Link className="link-gold" href={`/admin/members/${m.id}`}>{m.number}</Link></td>
                    <td>
                      <Link className="link-gold font-semibold" href={`/admin/members/${m.id}`}>{m.isJunior ? child?.displayName : m.account.fullName}</Link>
                      {m.isJunior && <div className="text-xs text-ink-soft">Guardian: {m.account.fullName}</div>}
                      {nearing && <div className="text-xs font-semibold text-warn">Turns 18 {fmtDate(b18)}</div>}
                    </td>
                    <td>{m.isJunior ? <span className="font-semibold text-crimson">Junior</span> : m.package.name}</td>
                    <td><StatusBadge light status={st === "GRACE" ? "GRACE" : m.status} label={st === "GRACE" ? EFFECTIVE_LABEL.GRACE : undefined} /></td>
                    <td className="whitespace-nowrap">{fmtDate(m.expiresAt)}</td>
                    <td>{m.cardholders.length}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={page} pages={Math.ceil(total / PER)} href={(p) => link({ page: String(p) })} />
    </div>
  );
}
