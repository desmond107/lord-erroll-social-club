import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAccount } from "@/lib/member-auth";
import { ageOn } from "@/lib/age";
import { kes } from "@/lib/format";
import { ActionForm } from "@/components/ActionForm";
import { handoverAccept, handoverStart } from "../../actions";

export const metadata: Metadata = { title: "Junior to adult membership", robots: { index: false } };

/**
 * Two sides of the Junior → adult hand-over:
 *  - the guardian names the young adult's own email and phone;
 *  - the young adult (signed in to their new account) accepts the terms and picks a tier.
 */
export default async function HandoverPage({ params }: { params: Promise<{ id: string }> }) {
  const a = await requireAccount();
  const { id } = await params;
  const m = await prisma.membership.findUnique({ where: { id }, include: { cardholders: { where: { suffix: "J" } } } });
  if (!m || !m.isJunior) notFound();
  const child = m.cardholders[0];

  if (m.handoverAccountId === a.id) {
    const tiers = await prisma.package.findMany({ where: { kind: "MAIN", active: true }, orderBy: { rank: "asc" } });
    return (
      <Shell title="Your own membership">
        <p className="text-ink-soft">Welcome, {a.fullName.split(" ")[0]}. Membership <strong className="text-ink">{m.number}</strong> becomes yours, without the “-J”. Please accept the club&apos;s terms and choose your package. Emerald is the natural first step.</p>
        <ActionForm action={handoverAccept} submit="Accept and continue to payment" className="mt-6">
          <input type="hidden" name="membershipId" value={m.id} />
          <fieldset className="space-y-2">
            {tiers.map((t, i) => (
              <label key={t.id} className="flex items-center justify-between gap-3 border border-line-light bg-white p-3">
                <span className="flex items-center gap-3"><input type="radio" name="packageId" value={t.id} defaultChecked={i === 0} required className="accent-[var(--emerald)]" /> <span className="font-serif text-lg">{t.name}</span>{i === 0 && <span className="text-xs text-gold-ink">Suggested</span>}</span>
                <span className="text-sm">{kes(t.annualFeeKes)}</span>
              </label>
            ))}
          </fieldset>
          <label className="mt-5 flex items-start gap-3 text-sm text-ink-soft"><input type="checkbox" name="terms" required className="mt-1 accent-[var(--emerald)]" /> <span>I accept the <Link href="/terms" target="_blank" className="link-gold font-semibold">Terms and Conditions</Link> personally.</span></label>
          <label className="mt-2 flex items-start gap-3 text-sm text-ink-soft"><input type="checkbox" name="privacy" required className="mt-1 accent-[var(--emerald)]" /> <span>I consent to the <Link href="/privacy" target="_blank" className="link-gold font-semibold">Privacy Policy</Link>.</span></label>
        </ActionForm>
      </Shell>
    );
  }

  if (m.accountId !== a.id || !child) notFound();
  const age = ageOn(child.dateOfBirth);
  return (
    <Shell title={`Hand over ${child.displayName}'s membership`}>
      {age < 18 ? (
        <p className="text-ink-soft">The hand-over opens on {child.displayName}&apos;s 18th birthday.</p>
      ) : (
        <>
          <p className="text-ink-soft">{child.displayName} is now 18. Enter their <strong className="text-ink">own</strong> email and mobile number. We will invite them to sign in, accept the terms and choose an adult package. The membership number stays the same.</p>
          {m.handoverAccountId && <p className="mt-3 text-sm text-gold-ink">An invitation has already been sent. You can send it again to different details below.</p>}
          <ActionForm action={handoverStart} submit="Send invitation" className="mt-6">
            <input type="hidden" name="membershipId" value={m.id} />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="field"><label htmlFor="email">Their email</label><input id="email" name="email" type="email" required className="input" /></div>
              <div className="field"><label htmlFor="phone">Their mobile</label><input id="phone" name="phone" type="tel" required className="input" /></div>
            </div>
          </ActionForm>
        </>
      )}
    </Shell>
  );
}

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-vignette min-h-screen pt-[72px]">
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        <Link href="/account" className="text-xs tracking-[0.2em] text-on-dark-soft uppercase hover:text-gold-light">← My account</Link>
        <h1 className="display mt-6 text-[2.4rem]">{title}</h1>
        <div className="on-paper gold-frame mt-8 p-6 sm:p-8">{children}</div>
      </div>
    </section>
  );
}
