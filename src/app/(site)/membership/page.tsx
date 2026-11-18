import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/PageHero";
import { PackageCard } from "@/components/PackageCard";
import { SectionHead } from "@/components/brand";
import { Reveal } from "@/components/motion";
import { activePackages } from "@/lib/public-data";
import { ladderBenefits } from "@/lib/packages";

export const metadata: Metadata = {
  title: "Membership Packages",
  description: "Compare the Emerald, Bronze, Silver, Gold and Platinum tiers of The Lord Erroll Social Club, plus Junior and Family memberships.",
};

export default async function MembershipPage() {
  const { all, main, special } = await activePackages();
  return (
    <>
      <PageHero eyebrow="Membership" title="Membership Packages" intro="Five tiers rising from Emerald to Platinum, each including everything in the tier below. Upgrade at any time and pay only the difference." photo="dining" />

      <section className="py-20 sm:py-28">
        <SectionHead eyebrow="The Ladder" title="From Emerald to Platinum" />
        <div className="mx-auto mt-16 max-w-[1500px] px-4 sm:px-6 lg:px-8">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 xl:items-end">
            {main.map((p, i) => (
              <Reveal key={p.id} delay={i * 90} className="h-full xl:h-auto" >
                <div className="h-full" style={{ marginTop: 0 }}>
                  <PackageCard pkg={p} step={i + 1} inheritsFrom={ladderBenefits(p, all).inherited} />
                </div>
              </Reveal>
            ))}
          </div>
          <p className="mx-auto mt-10 max-w-2xl text-center text-sm text-on-dark-soft">
            Upgrading mid-year? You pay only the difference in fee for the months that remain. Downgrades take effect at renewal.
          </p>
        </div>
      </section>

      {special.length > 0 && (
        <section className="bg-vignette py-20 sm:py-28">
          <SectionHead eyebrow="Special Memberships" title="For families and the next generation" intro="Offered alongside the main tiers." />
          <div className="mx-auto mt-16 grid max-w-4xl gap-8 px-4 sm:px-6 md:grid-cols-2">
            {special.map((p, i) => (
              <Reveal key={p.id} delay={i * 120}>
                <PackageCard pkg={p} />
              </Reveal>
            ))}
          </div>
          <div className="mx-auto mt-12 max-w-3xl px-4 text-sm leading-relaxed text-on-dark/75 sm:px-6">
            <p>
              <strong className="text-gold-light">Junior</strong> membership is for young people under 18 and is applied for and managed by a parent or legal
              guardian. Junior members enjoy child-appropriate privileges only and must be accompanied by an adult on the premises. At 18, a
              Junior membership converts to an adult package, keeping the same number.
            </p>
            <p className="mt-4">
              <strong className="text-gold-light">Family / Joint</strong> membership covers one primary adult and linked family members, each with their
              own card, all renewed together in a single payment.
            </p>
          </div>
        </section>
      )}

      <section className="on-paper py-20 text-center">
        <h2 className="display text-[2.2rem] text-emerald">Ready to apply?</h2>
        <p className="mt-3 text-ink-soft">The committee reviews every application personally, usually within a few days.</p>
        <div className="mt-8 flex flex-col justify-center gap-3 px-4 sm:flex-row">
          <Link href="/apply" className="btn btn-green">Begin your application</Link>
          <Link href="/faq" className="btn btn-outline">Read the FAQ</Link>
        </div>
      </section>
    </>
  );
}
