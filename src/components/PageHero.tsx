import { Filigree } from "./brand";
import type { PhotoKey } from "@/lib/site";
import { Photo } from "./brand";
import { Parallax } from "./motion";

/** Inner-page hero: photo (or placeholder) behind a vignette, title and filigree. */
export function PageHero({ eyebrow, title, intro, photo }: { eyebrow: string; title: string; intro?: string; photo?: PhotoKey }) {
  return (
    <section className="relative isolate overflow-hidden pt-[72px]">
      {photo && (
        <Parallax speed={0.25} className="absolute inset-0 -z-20">
          <Photo k={photo} className="absolute inset-0" priority />
        </Parallax>
      )}
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(80%_80%_at_50%_30%,rgba(10,38,24,.55)_0%,rgba(8,12,10,.9)_75%,#0e0f0d_100%)]" />
      <div className="fleur-pattern absolute inset-0 -z-10 opacity-60" />
      <div className="mx-auto max-w-3xl px-4 py-24 text-center sm:px-6 sm:py-32">
        <div className="eyebrow fade-rise mb-5">{eyebrow}</div>
        <h1 className="display fade-rise text-[2.8rem] sm:text-[4rem]" style={{ animationDelay: ".2s" }}>{title}</h1>
        <Filigree className="fade-rise mt-7" />
        {intro && <p className="fade-rise mt-7 text-[1.08rem] leading-relaxed text-on-dark/80" style={{ animationDelay: ".4s" }}>{intro}</p>}
      </div>
    </section>
  );
}
