import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/PageHero";
import { Fleur, Photo, SectionHead } from "@/components/brand";
import { Reveal } from "@/components/motion";
import { activePackages } from "@/lib/public-data";
import { finishFor } from "@/lib/finishes";

export const metadata: Metadata = {
  title: "Member Benefits and Privileges",
  description: "Dining privileges, private dining, cigar and whisky evenings, events and partner offers for members of The Lord Erroll Social Club.",
};

const PILLARS = [
  {
    t: "Dining privileges",
    photo: "fineDining" as const,
    d: "Member pricing in the dining room and on the verandah, priority reservations and a birthday dessert with the chef's compliments. The more senior your tier, the greater the courtesy.",
  },
  {
    t: "Private dining",
    photo: "dining" as const,
    d: "Priority use of the private rooms for business lunches and family celebrations. Gold members enjoy one complimentary room hire a year; Platinum members an annual dinner for ten hosted by the chef.",
  },
  {
    t: "Cigar and whisky nights",
    photo: "cigar" as const,
    d: "Thursday Cigar Nights, whisky tastings and a personal locker or humidor for senior members. These privileges are for adult members only.",
  },
  {
    t: "Events and members' evenings",
    photo: "bar" as const,
    d: "Reserved tables at Ladies Night and After Dinner at the Highlander Bar, and invitations to evenings that are never advertised.",
  },
  {
    t: "Partner offers",
    photo: "wine" as const,
    d: "Courtesies at selected partner establishments, and reciprocal access at partner clubs for Platinum members. The current list is shared in the member portal.",
  },
];

export default async function BenefitsPage() {
  const { main } = await activePackages();
  return (
    <>
      <PageHero eyebrow="Privileges" title="Member Benefits" intro="The privileges of membership, from the first tier to the last." photo="fineDining" />

      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-6xl space-y-20 px-4 sm:px-6">
          {PILLARS.map((p, i) => (
            <Reveal key={p.t} className={`grid items-center gap-10 md:grid-cols-2 ${i % 2 ? "md:[&>*:first-child]:order-2" : ""}`}>
              <Photo k={p.photo} className="aspect-[4/3]" sizes="(min-width:768px) 50vw, 100vw" />
              <div>
                <div className="eyebrow">{`Privilege ${i + 1}`}</div>
                <h2 className="display mt-4 text-[2.2rem]">{p.t}</h2>
                <p className="mt-5 leading-relaxed text-on-dark/80">{p.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="on-paper py-20 sm:py-28">
        <SectionHead eyebrow="At a Glance" title="What each tier adds" className="px-4 text-ink" />
        <div className="mx-auto mt-14 grid max-w-6xl gap-6 px-4 sm:px-6 md:grid-cols-2 lg:grid-cols-3">
          {main.map((p, i) => (
            <Reveal key={p.id} delay={i * 80} className="gold-frame bg-white p-7">
              <div className="flex items-center gap-3">
                <span className="h-4 w-4 rounded-full" style={{ background: finishFor(p.finish).swatch }} aria-hidden />
                <h3 className="display text-[1.7rem] text-emerald">{p.name}</h3>
              </div>
              {i > 0 && <p className="mt-2 text-xs font-semibold tracking-wider text-gold-ink uppercase">All of {main[i - 1].name}, plus</p>}
              <ul className="mt-4 space-y-2 text-[0.93rem] text-ink-soft">
                {p.benefits.map((b) => (
                  <li key={b} className="flex gap-2.5">
                    <Fleur className="mt-1 h-3 w-3 flex-none text-gold-ink" />
                    {b}
                  </li>
                ))}
              </ul>
            </Reveal>
          ))}
        </div>
        <div className="mt-14 text-center">
          <Link href="/membership" className="btn btn-green">Compare and apply</Link>
        </div>
      </section>
    </>
  );
}
