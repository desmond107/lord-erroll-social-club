import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth";
import { can } from "@/lib/roles";
import { prisma } from "@/lib/db";
import { decryptOr } from "@/lib/crypto";
import { getSettings } from "@/lib/settings";
import { effectiveStatus, EFFECTIVE_LABEL, quote, MembershipError } from "@/lib/membership";
import { cardDataFor } from "@/lib/cards";
import { ageOn, birthdayAt } from "@/lib/age";
import { fmtDate, fmtDateTime, kes } from "@/lib/format";
import { audit } from "@/lib/audit";
import { PageTitle, Card } from "@/components/admin/ui";
import { StatusBadge } from "@/components/StatusBadge";
import { ActionForm } from "@/components/ActionForm";
import { MembershipCard3D } from "@/components/card/MembershipCard3D";
import { editAccount, editCardholder, extend, recordManualPayment, reinstate, rotateQr, suspend, toggleCard } from "../actions";

export default async function MemberDetail({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin("members.view");
  const { id } = await params;
  const m = await prisma.membership.findUnique({
    where: { id },
    include: {
      account: true,
      package: true,
      cardholders: { orderBy: { suffix: "asc" } },
      payments: { orderBy: { createdAt: "desc" }, include: { confirmedBy: true, package: true } },
      application: true,
      reminders: { orderBy: { sentAt: "desc" }, take: 10 },
    },
  });
  if (!m) notFound();
  await audit(user, "member.view", "Membership", m.id);
  const settings = await getSettings();
  const status = effectiveStatus(m, settings.graceDays);
  const edit = can(user, "members.edit");
  const pay = can(user, "payments.confirm");
  const sensitive = can(user, "documents.sensitive");
  const card = m.cardholders[0] ? await cardDataFor(m.cardholders[0], m, settings.graceDays) : null;
  let due: Awaited<ReturnType<typeof quote>> | null = null;
  try {
    due = await quote(m.id);
  } catch (e) {
    if (!(e instanceof MembershipError)) throw e;
  }
  const pkgs = await prisma.package.findMany({ where: { active: true }, orderBy: [{ kind: "asc" }, { rank: "asc" }] });
  const email = decryptOr(m.account.emailEnc);
  const phone = decryptOr(m.account.phoneEnc);

  return (
    <div>
      <Link href="/admin/members" className="text-xs tracking-wider text-ink-soft uppercase">← Members</Link>
      <PageTitle
        title={m.isJunior ? `${m.cardholders[0]?.displayName ?? "Junior"} (Junior)` : m.account.fullName}
        sub={<span className="font-mono">{m.number}</span>}
        actions={<StatusBadge light status={status === "GRACE" ? "GRACE" : m.status} label={status === "GRACE" ? EFFECTIVE_LABEL.GRACE : undefined} />}
      />
      {m.suspendedReason && m.status === "SUSPENDED" && <div className="mb-6 border-l-4 border-bad bg-white px-4 py-3 text-sm">Suspended: {m.suspendedReason}</div>}

      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <div className="space-y-6">
          <Card title="Membership">
            <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
              <div><dt className="label">Package</dt><dd>{m.package.name}</dd></div>
              <div><dt className="label">Member since</dt><dd>{fmtDate(m.memberSince)}</dd></div>
              <div><dt className="label">Expires</dt><dd>{fmtDate(m.expiresAt)}</dd></div>
              <div><dt className="label">Activated</dt><dd>{fmtDate(m.activatedAt)}</dd></div>
              <div><dt className="label">Application</dt><dd>{m.application ? <Link className="link-gold" href={`/admin/applications/${m.application.id}`}>{m.application.ref}</Link> : "—"}</dd></div>
              <div><dt className="label">Next due</dt><dd>{due ? `${kes(due.amount)} (${due.purpose.toLowerCase()})` : "—"}</dd></div>
            </dl>
          </Card>

          <Card title={m.isJunior ? "Guardian (account holder)" : "Account holder"}>
            {edit ? (
              <ActionForm action={editAccount} submit="Save details" buttonClass="btn btn-outline btn-sm">
                <input type="hidden" name="membershipId" value={m.id} />
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="field"><label htmlFor="fullName">Name</label><input id="fullName" name="fullName" defaultValue={m.account.fullName} className="input" /></div>
                  <div className="field"><label htmlFor="email">Email</label><input id="email" name="email" type="email" defaultValue={email} className="input" /></div>
                  <div className="field"><label htmlFor="phone">Phone</label><input id="phone" name="phone" defaultValue={phone} className="input" /></div>
                </div>
              </ActionForm>
            ) : (
              <p className="text-sm">{m.account.fullName} · {email} · {phone}</p>
            )}
            {m.application && <p className="mt-3 text-xs text-ink-soft">ID / passport on application: {decryptOr(m.application.idNumberEnc)} · Marketing: {m.account.marketingOk ? "opted in" : "no"}</p>}
          </Card>

          <Card title={`Cards (${m.cardholders.length})`}>
            <ul className="divide-y divide-line-light">
              {m.cardholders.map((c) => {
                const age = ageOn(c.dateOfBirth);
                return (
                  <li key={c.id} className="py-4">
                    <div className="flex flex-wrap items-start gap-4">
                      {c.photoId && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={`/api/files/${c.photoId}`} alt="" className="h-16 w-16 border border-line-light object-cover" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold">{c.fullName} {!c.active && <span className="text-xs text-bad">(card deactivated)</span>}</div>
                        <div className="font-mono text-xs text-ink-soft">{c.cardNumber}</div>
                        <div className="text-sm text-ink-soft">{c.relationship} · born {fmtDate(c.dateOfBirth)} · <span className={age < 18 ? "font-semibold text-crimson" : ""}>age {age}</span>{c.suffix === "J" && <> · turns 18 {fmtDate(birthdayAt(c.dateOfBirth, 18))}</>}</div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <a className="btn btn-outline btn-sm" href={`/verify/${c.verifyToken}`} target="_blank" rel="noopener noreferrer">Verify page</a>
                        {c.dobProofId && sensitive && <a className="btn btn-outline btn-sm" href={`/api/files/${c.dobProofId}`} target="_blank" rel="noopener noreferrer">DOB document</a>}
                      </div>
                    </div>
                    {edit && (
                      <details className="mt-3">
                        <summary className="cursor-pointer text-xs font-semibold tracking-wider text-gold-ink uppercase">Edit card holder</summary>
                        <div className="mt-3 grid gap-4 sm:grid-cols-[1fr_auto]">
                          <ActionForm action={editCardholder} submit="Save" buttonClass="btn btn-outline btn-sm">
                            <input type="hidden" name="cardholderId" value={c.id} />
                            <div className="grid gap-3 sm:grid-cols-3">
                              <input name="fullName" defaultValue={c.fullName} aria-label="Full name" className="input" />
                              <input name="relationship" defaultValue={c.relationship} aria-label="Relationship" className="input" />
                              <input name="dateOfBirth" type="date" defaultValue={c.dateOfBirth.toISOString().slice(0, 10)} aria-label="Date of birth" className="input" />
                            </div>
                          </ActionForm>
                          <div className="flex flex-col gap-2">
                            <ActionForm action={toggleCard} submit={c.active ? "Deactivate card" : "Reactivate card"} buttonClass="btn btn-outline btn-sm"><input type="hidden" name="cardholderId" value={c.id} /></ActionForm>
                            <ActionForm action={rotateQr} submit="Issue new QR" buttonClass="btn btn-outline btn-sm" confirm="Issue a new QR code? Old copies of the card will stop verifying."><input type="hidden" name="cardholderId" value={c.id} /></ActionForm>
                          </div>
                        </div>
                      </details>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card title="Payments" actions={<Link href={`/admin/payments?q=${m.number}`} className="link-gold text-xs font-semibold uppercase">Ledger</Link>}>
            {m.payments.length === 0 ? <p className="text-sm text-ink-soft">No payments.</p> : (
              <div className="overflow-x-auto">
                <table className="tbl min-w-[620px]">
                  <thead><tr><th>Date</th><th>Purpose</th><th>Package</th><th>Method</th><th>Status</th><th className="text-right">Amount</th></tr></thead>
                  <tbody>
                    {m.payments.map((p) => (
                      <tr key={p.id}>
                        <td className="whitespace-nowrap">{fmtDate(p.paidAt ?? p.createdAt)}{p.receiptNo && <div className="font-mono text-[0.7rem] text-ink-soft"><a className="link-gold" href={`/api/receipts/${p.id}`}>{p.receiptNo}</a></div>}</td>
                        <td>{p.purpose.toLowerCase()}</td>
                        <td>{p.package.name}</td>
                        <td>{p.method}{p.confirmedBy && <div className="text-[0.7rem] text-ink-soft">by {p.confirmedBy.name}</div>}</td>
                        <td><StatusBadge light status={p.status} />{p.failureReason && <div className="text-[0.7rem] text-ink-soft">{p.failureReason}</div>}</td>
                        <td className="text-right whitespace-nowrap">{kes(p.amountKes)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          {card && <Card title="Card preview"><MembershipCard3D card={card} interactive={false} /></Card>}

          {pay && due && (
            <Card title="Record cash / bank payment">
              <ActionForm action={recordManualPayment} submit="Record payment" confirm="Record this payment as received? The membership will be updated and a receipt sent.">
                <input type="hidden" name="id" value={m.id} />
                <div className="grid gap-3">
                  <select name="packageId" defaultValue={due.pkg.id} aria-label="Package" className="input">
                    {pkgs.map((p) => <option key={p.id} value={p.id}>{p.name} · {kes(p.annualFeeKes)}</option>)}
                  </select>
                  <div className="grid grid-cols-2 gap-3">
                    <select name="method" aria-label="Method" className="input"><option value="CASH">Cash</option><option value="BANK">Bank transfer</option></select>
                    <input name="amount" type="number" defaultValue={due.amount} aria-label="Amount (KES)" className="input" />
                  </div>
                  <input name="reference" required placeholder="Bank ref / cash receipt no." className="input" />
                  <input name="note" placeholder="Note (optional)" className="input" />
                </div>
                <p className="hint">Due now: {kes(due.amount)} for {due.pkg.name} ({due.purpose.toLowerCase()}). For a different package, change it above; the amount must match.</p>
              </ActionForm>
            </Card>
          )}

          {edit && (
            <>
              <Card title="Extend membership">
                <ActionForm action={extend} submit="Extend" buttonClass="btn btn-outline btn-sm">
                  <input type="hidden" name="id" value={m.id} />
                  <div className="grid grid-cols-[6rem_1fr] gap-3">
                    <input name="days" type="number" min={1} max={730} defaultValue={30} aria-label="Days" className="input" />
                    <input name="reason" required placeholder="Reason" className="input" />
                  </div>
                </ActionForm>
              </Card>
              {m.status === "SUSPENDED" ? (
                <Card title="Reinstate">
                  <ActionForm action={reinstate} submit="Reinstate membership" buttonClass="btn btn-green btn-sm">
                    <input type="hidden" name="id" value={m.id} />
                    <input name="reason" placeholder="Note (optional)" className="input" />
                  </ActionForm>
                </Card>
              ) : (
                <Card title="Suspend">
                  <ActionForm action={suspend} submit="Suspend membership" buttonClass="btn btn-sm border border-bad text-bad" confirm="Suspend this membership? All its cards will stop verifying.">
                    <input type="hidden" name="id" value={m.id} />
                    <input name="reason" required placeholder="Reason (shared with the member)" className="input" />
                  </ActionForm>
                </Card>
              )}
            </>
          )}

          <Card title="Reminders sent">
            {m.reminders.length === 0 ? <p className="text-sm text-ink-soft">None yet.</p> : (
              <ul className="space-y-1 text-sm">{m.reminders.map((r) => <li key={r.id}>{r.kind} · {fmtDateTime(r.sentAt)}</li>)}</ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
