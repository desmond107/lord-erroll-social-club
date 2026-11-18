import Link from "next/link";
import { Crest, Filigree, Fleur, Photo, SectionHead } from "@/components/brand";
import { Parallax, Reveal } from "@/components/motion";
import { MembershipCard3D } from "@/components/card/MembershipCard3D";
import { activePackages, publishedEvents } from "@/lib/public-data";
import { finishFor } from "@/lib/finishes";
import { CLUB } from "@/lib/site";
import { kes, validThru, addYears } from "@/lib/format";

export default async function Home() {
  const [{ main }, events] = await Promise.all([activePackages(), publishedEvents()]);
  const year = new Date().getFullYear();
  const showcase = main.find((p) => p.slug === "gold") ?? main[main.length - 1];

  return (
    <>
      {/* ── HERO ── */}
      <section className="relative isolate flex min-h-[100svh] items-center justify-center overflow-hidden" aria-labelledby="hero-title">
        <Parallax speed={0.35} className="absolute inset-0 -z-20">
          <Photo k="hero" className="absolute inset-0" priority />
        </Parallax>
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(70%_60%_at_50%_45%,rgba(10,38,24,.35)_0%,rgba(8,12,10,.82)_70%,#0e0f0d_100%)]" />
        <div className="fleur-pattern absolute inset-0 -z-10 opacity-60" />

        <div className="mx-auto flex max-w-4xl flex-col items-center px-4 pt-28 pb-20 text-center sm:px-6">
          <div className="crest-reveal crest-glint">
            <Crest size={150} priority className="h-auto w-[118px] sm:w-[150px]" />
          </div>
          <h1 id="hero-title" className="fade-rise mt-8" style={{ animationDelay: ".9s" }}>
            <span className="blackletter block text-[3.1rem] leading-none text-on-dark sm:text-[4.6rem] lg:text-[5.4rem]">The Lord Erroll</span>
            <span className="mt-4 block text-[0.78rem] font-semibold tracking-[0.55em] text-gold uppercase sm:text-[0.9rem]">Social Club</span>
          </h1>
          <Filigree className="fade-rise mt-8 w-full max-w-sm" />
          <p className="display fade-rise mt-7 text-[1.65rem] text-on-dark/90 italic sm:text-[2.1rem]" style={{ animationDelay: "1.3s" }}>
            {CLUB.tagline}
          </p>
          <div className="fade-rise mt-11 flex w-full flex-col items-center justify-center gap-4 sm:flex-row" style={{ animationDelay: "1.7s" }}>
            <Link href="/apply" className="btn btn-gold w-full sm:w-auto">
              Apply for Membership
            </Link>
            <Link href="/lookup" className="btn btn-outline w-full sm:w-auto">
              Check My Membership
            </Link>
          </div>
        </div>
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-[0.6rem] tracking-[0.4em] text-on-dark-soft uppercase" aria-hidden>
          Scroll
          <div className="mx-auto mt-3 h-10 w-px bg-gradient-to-b from-gold to-transparent" />
        </div>
      </section>

      {/* ── INVITATION ── */}
      <section className="on-paper fleur-pattern py-24 sm:py-32">
        <Reveal className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <div className="eyebrow mb-5">A Private House in Nairobi</div>
          <h2 className="display text-[2.4rem] text-emerald sm:text-[3.2rem]">Where the old world keeps its table</h2>
          <Filigree className="mt-7" />
          <p className="mt-8 text-[1.12rem] leading-[1.9] text-ink-soft">
            Behind the verandah of The Lord Erroll lies a club in the grand tradition: panelled rooms, the glow of the Highlander Bar,
            gardens where peacocks wander at dusk. Membership opens its doors to priority tables, private dining, cigar and whisky
            evenings, and the company of those who appreciate them.
          </p>
          <Link href="/about" className="link-gold mt-8 inline-block text-[0.75rem] font-bold tracking-[0.25em] uppercase">
            Discover the heritage
          </Link>
        </Reveal>
      </section>

      {/* ── CARD SHOWCASE ── */}
      <section className="bg-vignette relative overflow-hidden py-24 sm:py-32">
        <div className="fleur-pattern absolute inset-0 opacity-50" aria-hidden />
        <div className="relative mx-auto grid max-w-7xl items-center gap-16 px-4 sm:px-6 lg:grid-cols-[1fr_1.1fr] lg:px-10">
          <Reveal>
            <div className="eyebrow mb-5">The Membership Card</div>
            <h2 className="display text-[2.4rem] sm:text-[3.2rem]">Carried with quiet pride</h2>
            <p className="mt-6 max-w-lg text-[1.05rem] leading-relaxed text-on-dark/80">
              Every member receives a personal digital card, finished in the material of their tier, from deep emerald to
              cool platinum. Show it at the door, download it, or let our staff scan its seal to confirm your standing.
            </p>
            <div className="mt-8 flex flex-wrap gap-2.5">
              {main.map((p) => (
                <span key={p.id} className="inline-flex items-center gap-2 border border-line-dark px-3 py-1.5 text-[0.7rem] font-semibold tracking-[0.18em] uppercase">
                  <span className="h-3 w-3 rounded-full" style={{ background: finishFor(p.finish).swatch }} aria-hidden />
                  {p.name}
                </span>
              ))}
            </div>
            <p className="mt-6 text-xs text-on-dark-soft">Drag the card to turn it.</p>
          </Reveal>
          <Reveal delay={200}>
            {showcase && (
              <MembershipCard3D
                autoSpin
                card={{
                  finish: showcase.finish, packageName: showcase.name, displayName: "Your Name Here", cardNumber: `LE-${year}-000000`,
                  memberSince: String(year), validThru: validThru(addYears(new Date(), 1)), status: "ACTIVE",
                }}
                className="mx-auto max-w-[560px]"
              />
            )}
          </Reveal>
        </div>
      </section>

      {/* ── LADDER TEASER ── */}
      <section className="py-24 sm:py-32">
        <SectionHead eyebrow="Membership" title="An ascending order of privilege" intro="Five tiers, each including all that comes before it. Junior and Family memberships are offered alongside." className="px-4" />
        <Reveal className="mx-auto mt-16 max-w-6xl px-4 sm:px-6">
          <ol className="grid gap-3 sm:grid-cols-5 sm:items-end">
            {main.map((p, i) => {
              const F = finishFor(p.finish);
              return (
                <li key={p.id} className="relative flex flex-col justify-end border border-line-dark bg-charcoal-2 p-6 sm:min-h-[var(--h)]" style={{ ["--h" as string]: `${9 + i * 2.2}rem`, background: `linear-gradient(180deg, ${F.swatch}22, transparent 70%)` }}>
                  <div className="h-1.5 w-12" style={{ background: F.base }} aria-hidden />
                  <div className="mt-4 text-[0.6rem] font-semibold tracking-[0.3em] text-on-dark-soft uppercase">Tier {i + 1}</div>
                  <div className="display mt-1 text-[1.7rem]">{p.name}</div>
                  <div className="mt-2 text-sm text-gold-light">{kes(p.annualFeeKes)}</div>
                </li>
              );
            })}
          </ol>
          <div className="mt-10 text-center">
            <Link href="/membership" className="btn btn-outline">Compare packages</Link>
          </div>
        </Reveal>
      </section>

      {/* ── SPACES ── */}
      <section className="on-paper py-24 sm:py-32">
        <SectionHead eyebrow="The House" title="Rooms for every hour" className="px-4 text-ink" />
        <div className="mx-auto mt-16 grid max-w-7xl gap-4 px-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-10">
          {(["verandah", "bar", "dining", "garden"] as const).map((k, i) => (
            <Reveal key={k} delay={i * 120}>
              <Photo k={k} className="aspect-[3/4]" sizes="(min-width:1024px) 25vw, (min-width:640px) 50vw, 100vw" />
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── EVENTS ── */}
      <section className="bg-vignette py-24 sm:py-32">
        <SectionHead eyebrow="The Week at the Club" title="Evenings worth dressing for" className="px-4" />
        <div className="mx-auto mt-16 grid max-w-6xl gap-px border border-line-dark bg-line-dark px-0 sm:grid-cols-2 lg:grid-cols-4">
          {events.filter((e) => !e.membersOnly).concat(events.filter((e) => e.membersOnly && e.adultOnly)).slice(0, 4).map((e, i) => (
            <Reveal key={e.id} delay={i * 100} className="bg-emerald-deep p-8">
              <Fleur className="h-5 w-5 text-gold" />
              <h3 className="display mt-5 text-[1.6rem]">{e.title}</h3>
              <div className="mt-2 text-[0.68rem] font-semibold tracking-[0.2em] text-gold uppercase">{e.schedule}</div>
              <p className="mt-4 text-sm leading-relaxed text-on-dark/75">{e.description}</p>
            </Reveal>
          ))}
        </div>
        <div className="mt-12 text-center">
          <Link href="/events" className="link-gold text-[0.75rem] font-bold tracking-[0.25em] uppercase">All events and experiences</Link>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="relative overflow-hidden py-28 text-center sm:py-36">
        <div className="fleur-pattern absolute inset-0" aria-hidden />
        <Reveal className="relative mx-auto max-w-2xl px-4">
          <Crest size={72} className="mx-auto" />
          <h2 className="display mt-8 text-[2.4rem] sm:text-[3.2rem]">Your seat is waiting</h2>
          <p className="mt-5 text-on-dark/80">Applications are reviewed personally by the membership committee.</p>
          <div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
            <Link href="/apply" className="btn btn-gold">Apply for Membership</Link>
            <a href={CLUB.whatsappHref} target="_blank" rel="noopener noreferrer" className="btn btn-outline">Speak to us on WhatsApp</a>
          </div>
        </Reveal>
      </section>
    </>
  );
}
