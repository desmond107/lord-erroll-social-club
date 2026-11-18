import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/PageHero";
import { Crest, Filigree, Photo } from "@/components/brand";
import { Reveal } from "@/components/motion";

export const metadata: Metadata = {
  title: "About the Club",
  description: "The heritage of The Lord Erroll and what it means to belong to its private social club.",
};

/*
 * CONFIRM with the client: the heritage copy below is written in the house voice from
 * what is publicly known of the restaurant. Replace or adjust any historical detail.
 */
export default function AboutPage() {
  return (
    <>
      <PageHero eyebrow="About the Club" title="A Heritage of Hospitality" intro="Named for an age of grand houses and long evenings, The Lord Erroll keeps an old-world welcome alive in Nairobi." photo="verandah" />

      <section className="on-paper py-20 sm:py-28">
        <div className="mx-auto grid max-w-6xl gap-14 px-4 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:items-center">
          <Reveal className="prose-club text-[1.06rem] text-ink-soft">
            <div className="eyebrow mb-4">The Story</div>
            <h2 className="!mt-0 text-[2.4rem] text-emerald">The house and its name</h2>
            <p>
              The Lord Erroll takes its name and its spirit from the colonial-era country houses of the Kenyan highlands: panelled
              rooms, deep verandahs, gardens laid out for long afternoons and evenings that ran late into the night.
            </p>
            <p>
              Today it is one of Nairobi&apos;s most storied tables, set among gardens off Ruaka Road where peacocks still wander at dusk.
              The dining room, the conservatory, the verandah and the Highlander Bar each keep their own character and their own regulars.
            </p>
            <p>
              The Social Club gives those regulars, and those who would like to become regulars, a home within the house.
            </p>
          </Reveal>
          <Reveal delay={150}>
            <Photo k="garden" className="aspect-[4/5]" sizes="(min-width:1024px) 45vw, 100vw" />
          </Reveal>
        </div>
      </section>

      <section className="bg-vignette py-20 sm:py-28">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <Crest size={70} className="mx-auto" />
          <h2 className="display mt-8 text-[2.4rem] sm:text-[3rem]">The experience of belonging</h2>
          <Filigree className="mt-7" />
        </div>
        <div className="mx-auto mt-14 grid max-w-6xl gap-px border border-line-dark bg-line-dark sm:grid-cols-3">
          {[
            ["Recognition", "Your name is known at the door. Your table is held. Your preferences, from the wine you favour to the corner you prefer, are remembered."],
            ["Privilege", "Priority reservations, private dining, member pricing and evenings that are simply not open to the public."],
            ["Company", "Cigar nights, whisky tastings, the Highlander Bar after dinner: the pleasure of good conversation among people who value it."],
          ].map(([t, d], i) => (
            <Reveal key={t} delay={i * 120} className="bg-emerald-deep p-10">
              <div className="eyebrow">{`0${i + 1}`}</div>
              <h3 className="display mt-4 text-[1.8rem]">{t}</h3>
              <p className="mt-4 leading-relaxed text-on-dark/75">{d}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="py-20 sm:py-28">
        <div className="mx-auto grid max-w-6xl gap-4 px-4 sm:grid-cols-3 sm:px-6">
          {(["bar", "wine", "cigar"] as const).map((k, i) => (
            <Reveal key={k} delay={i * 100}>
              <Photo k={k} className="aspect-square" sizes="(min-width:640px) 33vw, 100vw" />
            </Reveal>
          ))}
        </div>
        <div className="mt-14 text-center">
          <Link href="/membership" className="btn btn-gold">View membership packages</Link>
        </div>
      </section>
    </>
  );
}
