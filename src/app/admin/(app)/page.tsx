import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { overviewStats } from "@/lib/stats";
import { prisma } from "@/lib/db";
import { fmtDate, kes } from "@/lib/format";
import { PageTitle, Card, Stat, Empty } from "@/components/admin/ui";

export default async function Overview({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  await requireAdmin("overview");
  const [s, unconfirmed, { denied }] = await Promise.all([overviewStats(), prisma.package.count({ where: { confirmed: false, active: true } }), searchParams]);
  const max = Math.max(1, ...s.months.map((m) => m.total));
  const maxPkg = Math.max(1, ...s.byPackage.map((p) => p.total));

  return (
    <div>
      <PageTitle title="Overview" sub="The state of the club today." />
      {denied && <div className="mb-6 border-l-4 border-bad bg-white px-4 py-3 text-sm text-bad">Your role doesn&apos;t have access to that page.</div>}
      {unconfirmed > 0 && (
        <div className="mb-6 border-l-4 border-warn bg-white px-4 py-3 text-sm">
          {unconfirmed} package{unconfirmed > 1 ? "s still show" : " still shows"} sample prices and benefits. <Link href="/admin/packages" className="link-gold font-semibold">Review packages</Link> before launch.
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Total members" value={s.total} hint={`${s.suspended} suspended`} href="/admin/members" />
        <Stat label="Pending applications" value={s.pendingApps} hint={s.infoApps ? `${s.infoApps} awaiting information` : undefined} href="/admin/applications" tone={s.pendingApps ? "warn" : undefined} />
        <Stat label="Active" value={s.active} hint={`${s.pendingPayment} approved, awaiting payment`} href="/admin/members?status=ACTIVE" tone="ok" />
        <Stat label="Expired" value={s.expired} href="/admin/members?status=EXPIRED" tone={s.expired ? "bad" : undefined} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Card title="Revenue by month" actions={<span className="text-sm text-ink-soft">12 months: <strong className="text-ink">{kes(s.revenue12)}</strong></span>}>
          <div className="flex h-56 items-end gap-2" role="img" aria-label="Bar chart of revenue by month; the table below lists the values">
            {s.months.map((m) => (
              <div key={m.key} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                <div className="w-full bg-emerald transition-all" style={{ height: `${(m.total / max) * 100}%`, minHeight: m.total ? 2 : 0 }} title={`${m.label}: ${kes(m.total)}`} />
                <div className="text-[0.62rem] text-ink-soft">{m.label}</div>
              </div>
            ))}
          </div>
          <details className="mt-3 text-xs text-ink-soft">
            <summary className="cursor-pointer">Show as table</summary>
            <table className="tbl mt-2"><tbody>{s.months.map((m) => <tr key={m.key}><td>{m.key}</td><td className="text-right">{kes(m.total)}</td></tr>)}</tbody></table>
          </details>
        </Card>
        <Card title="Revenue by package (12 months)">
          {s.byPackage.length === 0 ? <Empty>No payments yet.</Empty> : (
            <ul className="space-y-3">
              {s.byPackage.map((p) => (
                <li key={p.name}>
                  <div className="flex justify-between text-sm"><span>{p.name}</span><span className="font-semibold">{kes(p.total)}</span></div>
                  <div className="mt-1 h-2 bg-cream"><div className="h-2 bg-gold" style={{ width: `${(p.total / maxPkg) * 100}%` }} /></div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card title="Upcoming renewals (30 days)">
          {s.upcoming.length === 0 ? <Empty>No renewals due in the next 30 days.</Empty> : (
            <table className="tbl">
              <thead><tr><th>Member</th><th>Package</th><th>Expires</th></tr></thead>
              <tbody>
                {s.upcoming.map((m) => (
                  <tr key={m.id}>
                    <td><Link className="link-gold" href={`/admin/members/${m.id}`}>{m.account.fullName}</Link><div className="font-mono text-xs text-ink-soft">{m.number}</div></td>
                    <td>{m.package.name}</td>
                    <td className={m.expiresAt! < new Date() ? "text-bad" : ""}>{fmtDate(m.expiresAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
        <Card title="Junior members nearing 18">
          {s.nearing18.length === 0 ? <Empty>No Junior members are within the notice period.</Empty> : (
            <table className="tbl">
              <thead><tr><th>Junior</th><th>Turns 18</th></tr></thead>
              <tbody>
                {s.nearing18.map(({ j, b }) => (
                  <tr key={j.id}>
                    <td><Link className="link-gold" href={`/admin/members/${j.membershipId}`}>{j.displayName}</Link><div className="font-mono text-xs text-ink-soft">{j.cardNumber}</div></td>
                    <td className={b < new Date() ? "font-semibold text-bad" : "text-warn"}>{fmtDate(b)}{b < new Date() ? " (aged out)" : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </div>
  );
}
