import { PageHero } from "./PageHero";

export function LegalPage({ eyebrow, title, intro, updated, children }: { eyebrow: string; title: string; intro?: string; updated?: string; children: React.ReactNode }) {
  return (
    <>
      <PageHero eyebrow={eyebrow} title={title} intro={intro} />
      <section className="on-paper py-16 sm:py-24">
        <article className="prose-club mx-auto max-w-3xl px-4 text-[1.02rem] text-ink-soft sm:px-6 [&_h2]:text-emerald [&_strong]:text-ink">
          {updated && <p className="text-sm italic">Last updated {updated}</p>}
          {children}
        </article>
      </section>
    </>
  );
}
