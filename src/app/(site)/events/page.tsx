import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/PageHero";
import { Fleur, SectionHead } from "@/components/brand";
import { Reveal } from "@/components/motion";
import { publishedEvents } from "@/lib/public-data";
import { CLUB } from "@/lib/site";

export const metadata: Metadata = {
  title: "Events and Experiences",
  description: "Ladies Night on Wednesdays, Cigar Night on Thursdays, After Dinner at the Highlander Bar on Fridays and Saturdays, and members-only evenings.",
};

export default async function EventsPage() {
  const events = await publishedEvents();
  const weekly = events.filter((e) => !e.membersOnly);
  const members = events.filter((e) => e.membersOnly);
  return (
    <>
      <PageHero eyebrow="Events and Experiences" title="The Week at the Club" intro="Each evening has its own character. Members enjoy reserved tables and invitations to evenings that are never advertised." photo="bar" />

      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-5xl divide-y divide-line-dark border-y border-line-dark px-4 sm:px-6">
          {weekly.map((e, i) => (
            <Reveal key={e.id} delay={i * 80} className="grid gap-4 py-10 sm:grid-cols-[14rem_1fr] sm:gap-10">
              <div>
                <div className="eyebrow">{e.schedule}</div>
                {e.adultOnly && <div className="mt-3 inline-block border border-crimson-bright/60 px-2 py-0.5 text-[0.6rem] font-bold tracking-[0.2em] text-crimson-bright uppercase">18+ only</div>}
              </div>
              <div>
                <h2 className="display text-[2.1rem]">{e.title}</h2>
                <p className="mt-3 max-w-2xl leading-relaxed text-on-dark/80">{e.description}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {members.length > 0 && (
        <section className="bg-vignette py-20 sm:py-28">
          <SectionHead eyebrow="Members Only" title="Exclusive evenings" intro="Invitations are sent through the member portal and by email, sometimes to particular tiers." />
          <div className="mx-auto mt-14 grid max-w-5xl gap-6 px-4 sm:px-6 md:grid-cols-2">
            {members.map((e, i) => (
              <Reveal key={e.id} delay={i * 100} className="gold-frame bg-charcoal/50 p-8">
                <Fleur className="h-5 w-5 text-gold" />
                <h3 className="display mt-4 text-[1.8rem]">{e.title}</h3>
                <div className="mt-2 text-[0.68rem] font-semibold tracking-[0.2em] text-gold uppercase">{e.schedule}</div>
                <p className="mt-4 leading-relaxed text-on-dark/75">{e.description}</p>
                {!e.adultOnly && <p className="mt-4 text-xs text-gold-light">Junior and Family members welcome.</p>}
              </Reveal>
            ))}
          </div>
        </section>
      )}

      <section className="on-paper py-16 text-center">
        <p className="text-ink-soft">To reserve for any evening, call <a className="link-gold font-semibold" href={CLUB.phoneHref}>{CLUB.phone}</a> or message us on WhatsApp.</p>
        <div className="mt-6 flex flex-col justify-center gap-3 px-4 sm:flex-row">
          <a href={CLUB.whatsappHref} target="_blank" rel="noopener noreferrer" className="btn btn-green">WhatsApp reservations</a>
          <Link href="/apply" className="btn btn-outline">Become a member</Link>
        </div>
        <p className="mx-auto mt-8 max-w-xl px-4 text-xs text-ink-soft">Ladies Night, Cigar Night and After Dinner at the Highlander Bar are for guests aged 18 and over. Junior members are not admitted to adult-only events.</p>
      </section>
    </>
  );
}
