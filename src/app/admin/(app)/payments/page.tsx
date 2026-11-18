import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { can } from "@/lib/roles";
import { prisma } from "@/lib/db";
import { ledgerRows, ledgerWhere } from "@/lib/ledger";
import { fmtDateTime, kes } from "@/lib/format";
import { PageTitle, Empty, Pager, Stat } from "@/components/admin/ui";
import { StatusBadge } from "@/components/StatusBadge";
import { ActionForm } from "@/components/ActionForm";
import { confirmPending, cancelPending } from "./actions";

const PER = 50;

export default async function Payments({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireAdmin("payments.view");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const where = ledgerWhere(sp);
  const [rows, total, sum] = await Promise.all([
    ledgerRows(where, PER, (page - 1) * PER),
    prisma.payment.count({ where }),
    prisma.payment.aggregate({ where: { AND: [where, { status: "PAID" }] }, _sum: { amountKes: true }, _count: true }),
  ]);
  const qs = new URLSearchParams(Object.entries(sp).filter(([k, v]) => v && k !== "page") as [string, string][]);
  const exp = (f: string) => `/api/admin/export?type=payments&format=${f}&${qs}`;
  const confirmOk = can(user, "payments.confirm");

  return (
    <div>
      <PageTitle
        title="Payment ledger"
        actions={<><a className="btn btn-outline btn-sm" href={exp("csv")}>CSV</a><a className="btn btn-outline btn-sm" href={exp("xlsx")}>Excel</a><a className="btn btn-outline btn-sm" href={exp("pdf")}>PDF</a></>}
      />
      <form className="mb-5 grid gap-3 border border-line-light bg-white p-4 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr_1fr_auto]" role="search">
        <input name="q" defaultValue={sp.q} placeholder="Receipt, M-Pesa ref, number or name" aria-label="Search" className="input" />
        <select name="status" defaultValue={sp.status ?? ""} aria-label="Status" className="input">
          <option value="">Any status</option>{["PAID", "PENDING", "FAILED", "CANCELLED"].map((s) => <option key={s} value={s}>{s.toLowerCase()}</option>)}
        </select>
        <select name="method" defaultValue={sp.method ?? ""} aria-label="Method" className="input">
          <option value="">Any method</option>{["MPESA", "CARD", "CASH", "BANK"].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <input type="date" name="from" defaultValue={sp.from} aria-label="From" className="input" />
        <input type="date" name="to" defaultValue={sp.to} aria-label="To" className="input" />
        <button className="btn btn-green btn-sm">Filter</button>
      </form>
      <div className="mb-5 grid grid-cols-2 gap-4 sm:max-w-md">
        <Stat label="Paid (filtered)" value={kes(sum._sum.amountKes ?? 0)} />
        <Stat label="Payments" value={sum._count} />
      </div>
      {rows.length === 0 ? <Empty>No payments match.</Empty> : (
        <div className="overflow-x-auto border border-line-light bg-white">
          <table className="tbl min-w-[980px]">
            <thead><tr><th>Date</th><th>Receipt</th><th>Member</th><th>Purpose</th><th>Method / ref</th><th>Status</th><th className="text-right">Amount</th><th /></tr></thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td className="whitespace-nowrap">{fmtDateTime(p.paidAt ?? p.createdAt)}</td>
                  <td className="font-mono text-xs">{p.receiptNo ? <a className="link-gold" href={`/api/receipts/${p.id}`}>{p.receiptNo}</a> : "—"}</td>
                  <td>{can(user, "members.view") ? <Link className="link-gold" href={`/admin/members/${p.membershipId}`}>{p.membership.account.fullName}</Link> : p.membership.account.fullName}<div className="font-mono text-xs text-ink-soft">{p.membership.number}</div></td>
                  <td>{p.purpose.toLowerCase()} · {p.package.name}</td>
                  <td>{p.method}<div className="font-mono text-[0.7rem] text-ink-soft">{p.providerTxnId ?? ""}</div>{p.confirmedBy && <div className="text-[0.7rem] text-ink-soft">confirmed by {p.confirmedBy.name}</div>}</td>
                  <td><StatusBadge light status={p.status} />{p.failureReason && <div className="max-w-[14rem] text-[0.7rem] text-ink-soft">{p.failureReason}</div>}</td>
                  <td className="text-right whitespace-nowrap">{kes(p.amountKes)}</td>
                  <td>
                    {confirmOk && (p.status === "PENDING" || p.status === "FAILED") && (
                      <details>
                        <summary className="cursor-pointer text-xs font-semibold text-gold-ink">Resolve</summary>
                        <div className="mt-2 w-56 space-y-2">
                          <ActionForm action={confirmPending} submit="Confirm received" buttonClass="btn btn-green btn-sm" confirm="Confirm this payment was received? Only do this after checking the M-Pesa statement or bank.">
                            <input type="hidden" name="id" value={p.id} />
                            <input name="reference" required placeholder="M-Pesa / bank ref" className="input" />
                          </ActionForm>
                          {p.status === "PENDING" && <ActionForm action={cancelPending} submit="Cancel" buttonClass="btn btn-outline btn-sm"><input type="hidden" name="id" value={p.id} /></ActionForm>}
                        </div>
                      </details>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={page} pages={Math.ceil(total / PER)} href={(n) => `/admin/payments?${qs}&page=${n}`} />
    </div>
  );
}
