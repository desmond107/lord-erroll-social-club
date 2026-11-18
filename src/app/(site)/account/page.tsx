import type { Metadata } from "next";
import Link from "next/link";
import { requireAccount } from "@/lib/member-auth";
import { portalData } from "@/lib/portal";
import { EFFECTIVE_LABEL } from "@/lib/membership";
import { fmtDate, kes } from "@/lib/format";
import { CLUB } from "@/lib/site";
import { MembershipCard3D } from "@/components/card/MembershipCard3D";
import { StatusBadge } from "@/components/StatusBadge";
import { Filigree, Fleur } from "@/components/brand";
import { AccountNav } from "./AccountNav";

export const metadata: Metadata = { title: "My Account", robots: { index: false } };

export default async function AccountHome() {
  const account = await requireAccount();
  const { items, handovers, events, announcements, pendingApps, settings } = await portalData(account);

  return (
    <div className="bg-vignette min-h-screen pt-[72px]">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <AccountNav name={account.fullName} />

        {handovers.map((h) => (
          <div key={h.id} className="gold-frame mt-8 bg-emerald p-6">
            <div className="eyebrow">Welcome to adult membership</div>
            <p className="mt-3 text-on-dark/90">Your Junior membership <strong>{h.number}</strong> is ready to become your own. Accept the club&apos;s terms and choose your package to take it over.</p>
            <Link href={`/account/handover/${h.id}`} className="btn btn-gold mt-5">Take over my membership</Link>
          </div>
        ))}

        {pendingApps.map((a) => (
          <div key={a.id} className="mt-8 border border-line-dark bg-charcoal-2 p-5 text-sm">
            Application <strong className="text-gold-light">{a.ref}</strong> for {a.package.name} is {a.status === "INFO_REQUESTED" ? "awaiting more information from you" : "under review"}.
            {a.status === "INFO_REQUESTED" && a.messageToApplicant && <p className="mt-2 text-on-dark-soft">“{a.messageToApplicant}” · please reply to our email or call {CLUB.phone}.</p>}
          </div>
        ))}

        {items.length === 0 && handovers.length === 0 && (
          <div className="mt-10 border border-line-dark p-10 text-center">
            <p className="text-on-dark/85">You don&apos;t have an active membership on this account yet.</p>
            <Link href="/apply" className="btn btn-gold mt-6">Apply for membership</Link>
          </div>
        )}

        {items.map(({ m, status, cards, daysLeft, benefits, child, childAge, child18, canHandover, renewOpen }) => {
          const primary = cards[0];
          const pending = m.status === "PENDING_PAYMENT";
          const converting = !!m.convertedFromJuniorAt && m.package.kind === "JUNIOR";
          return (
            <section key={m.id} className="mt-12" aria-labelledby={`m-${m.id}`}>
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <div className="eyebrow">{m.isJunior ? `Junior membership · ${child?.displayName}` : m.package.kind === "FAMILY" ? "Family membership" : "Membership"}</div>
                  <h1 id={`m-${m.id}`} className="display mt-2 text-[2.4rem] sm:text-[3rem]">{m.isJunior ? "Junior" : m.package.name}</h1>
                  <div className="mt-1 font-mono tracking-[0.15em] text-gold-light">{m.number}</div>
                </div>
                <StatusBadge status={status} label={EFFECTIVE_LABEL[status]} />
              </div>
              <Filigree className="mt-6 !justify-start [&::before]:hidden" />

              {pending && (
                <div className="mt-6 flex flex-col gap-4 border border-gold/60 bg-gold/10 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-on-dark/90">Your membership has been approved. Pay the annual subscription of <strong>{kes(m.package.annualFeeKes)}</strong> to activate it and your card.</p>
                  <Link href={`/account/pay/${m.id}`} className="btn btn-gold flex-none">Pay and activate</Link>
                </div>
              )}
              {converting && (
                <div className="mt-6 flex flex-col gap-4 border border-gold/60 bg-gold/10 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-on-dark/90">Pay for your chosen adult package to begin your first adult membership year.</p>
                  <Link href={`/account/pay/${m.id}`} className="btn btn-gold flex-none">Pay now</Link>
                </div>
              )}

              <div className="mt-8 grid gap-10 lg:grid-cols-[1.15fr_1fr]">
                <div>
                  {primary && <MembershipCard3D card={primary.data} className="mx-auto max-w-[540px]" />}
                  {primary && !pending && (
                    <div className="mt-6 flex flex-wrap justify-center gap-3">
                      <Link href={`/account/card/${primary.id}`} className="btn btn-outline btn-sm">Download &amp; share</Link>
                    </div>
                  )}
                  {cards.length > 1 && (
                    <div className="mt-8">
                      <div className="eyebrow mb-3">All cards on this membership</div>
                      <ul className="divide-y divide-line-dark border-y border-line-dark">
                        {cards.map((c) => (
                          <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                            <span>{c.holder.displayName} <span className="text-xs text-on-dark-soft">· {c.holder.relationship}</span></span>
                            <span className="flex items-center gap-4">
                              <span className="font-mono text-xs text-on-dark-soft">{c.holder.cardNumber}</span>
                              {!pending && <Link className="link-gold text-xs font-semibold tracking-wider uppercase" href={`/account/card/${c.id}`}>View</Link>}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-px border border-line-dark bg-line-dark">
                    <Stat label="Expires" value={m.expiresAt ? fmtDate(m.expiresAt) : "On activation"} />
                    <Stat label={daysLeft != null && daysLeft < 0 ? "Days since expiry" : "Days remaining"} value={daysLeft == null ? "—" : String(Math.abs(daysLeft))} />
                    <Stat label="Member since" value={m.memberSince ? fmtDate(m.memberSince) : "—"} />
                    <Stat label="Annual fee" value={kes(m.package.annualFeeKes)} />
                  </div>

                  {!pending && !converting && (
                    <div className="flex flex-wrap gap-3">
                      {renewOpen && <Link href={`/account/pay/${m.id}`} className="btn btn-gold">Renew membership</Link>}
                      {!m.isJunior && m.package.kind === "MAIN" && status === "ACTIVE" && (
                        <Link href={`/account/pay/${m.id}?mode=upgrade`} className="btn btn-outline">Upgrade package</Link>
                      )}
                    </div>
                  )}
                  {status === "GRACE" && <p className="text-sm text-gold-light">Your membership has passed its expiry date and is in the {settings.graceDays}-day grace period. Renew now to keep your card active.</p>}

                  {m.isJunior && child && (
                    <div className="border border-crimson-bright/50 bg-crimson/15 p-4 text-sm leading-relaxed">
                      <strong className="text-[#f0a0a3]">Junior member, age {childAge}.</strong> No alcohol, tobacco or adult-only events. {settings.juniorAccompanyRule}
                      {child18 && !canHandover && <> {child.displayName} turns 18 on {fmtDate(child18)}.</>}
                      {canHandover && (
                        <div className="mt-3">
                          {child.displayName} is now 18. <Link href={`/account/handover/${m.id}`} className="link-gold font-semibold">Hand the membership over</Link>.
                        </div>
                      )}
                    </div>
                  )}

                  <div>
                    <h2 className="display text-[1.6rem]">{m.isJunior ? "Junior privileges" : "Your privileges"}</h2>
                    <ul className="mt-3 space-y-2 text-[0.93rem] text-on-dark/85">
                      {benefits.map((b) => (
                        <li key={b} className="flex gap-2.5"><Fleur className="mt-1 h-3 w-3 flex-none text-gold" />{b}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              <div className="mt-10">
                <h2 className="display text-[1.6rem]">Payments and receipts</h2>
                {m.payments.length === 0 ? (
                  <p className="mt-3 text-sm text-on-dark-soft">No payments yet.</p>
                ) : (
                  <div className="mt-4 overflow-x-auto border border-line-dark">
                    <table className="w-full min-w-[620px] text-sm">
                      <thead className="text-left text-[0.65rem] tracking-[0.15em] text-on-dark-soft uppercase">
                        <tr><th className="p-3">Date</th><th className="p-3">For</th><th className="p-3">Method</th><th className="p-3">Status</th><th className="p-3 text-right">Amount</th><th className="p-3" /></tr>
                      </thead>
                      <tbody>
                        {m.payments.map((p) => (
                          <tr key={p.id} className="border-t border-line-dark">
                            <td className="p-3 whitespace-nowrap">{fmtDate(p.paidAt ?? p.createdAt)}</td>
                            <td className="p-3">{{ NEW: "New membership", RENEWAL: "Renewal", UPGRADE: "Upgrade" }[p.purpose]}</td>
                            <td className="p-3">{{ MPESA: "M-Pesa", CARD: "Card", CASH: "Cash", BANK: "Bank" }[p.method]}</td>
                            <td className="p-3"><StatusBadge status={p.status === "PAID" ? "ACTIVE" : p.status === "PENDING" ? "PENDING" : "CANCELLED"} label={p.status.toLowerCase()} /></td>
                            <td className="p-3 text-right whitespace-nowrap">{kes(p.amountKes)}</td>
                            <td className="p-3 text-right">{p.status === "PAID" && p.receiptNo && <a className="link-gold text-xs font-semibold" href={`/api/receipts/${p.id}`}>Receipt</a>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          );
        })}

        {(announcements.length > 0 || events.length > 0) && (
          <div className="mt-16 grid gap-10 border-t border-line-dark pt-12 lg:grid-cols-2">
            <div>
              <h2 className="display text-[1.8rem]">From the club</h2>
              {announcements.length === 0 ? <p className="mt-3 text-sm text-on-dark-soft">No announcements at present.</p> : (
                <ul className="mt-4 space-y-5">
                  {announcements.map((a) => (
                    <li key={a.id} className="border-l-2 border-gold pl-4">
                      <div className="text-xs text-on-dark-soft">{fmtDate(a.sentAt)}</div>
                      <div className="font-serif text-xl">{a.title}</div>
                      <p className="mt-1 text-sm whitespace-pre-line text-on-dark/80">{a.body}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h2 className="display text-[1.8rem]">Events</h2>
              <ul className="mt-4 space-y-4">
                {events.map((e) => (
                  <li key={e.id}>
                    <div className="font-serif text-xl">{e.title}</div>
                    <div className="text-[0.68rem] font-semibold tracking-[0.18em] text-gold uppercase">{e.schedule}</div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        <div className="mt-16 border-t border-line-dark pt-8 text-sm text-on-dark-soft">
          Need help? Call <a className="link-gold" href={CLUB.phoneHref}>{CLUB.phone}</a>, email <a className="link-gold" href={`mailto:${CLUB.email}`}>{CLUB.email}</a> or{" "}
          <a className="link-gold" href={CLUB.whatsappHref} target="_blank" rel="noopener noreferrer">message us on WhatsApp</a>.
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-charcoal-2 p-4">
      <div className="text-[0.62rem] tracking-[0.2em] text-on-dark-soft uppercase">{label}</div>
      <div className="display mt-1 text-[1.35rem]">{value}</div>
    </div>
  );
}
