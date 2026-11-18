import Link from "next/link";
import type { Package } from "@prisma/client";
import { finishFor } from "@/lib/finishes";
import { kes } from "@/lib/format";
import { Fleur } from "./brand";

/** A tier card for the comparison ladder. `inheritsFrom` = the next tier down. */
export function PackageCard({ pkg, inheritsFrom, step }: { pkg: Package; inheritsFrom?: Package | null; step?: number }) {
  const F = finishFor(pkg.finish);
  const featured = !!pkg.ribbon;
  return (
    <article
      className={`group relative flex h-full flex-col border bg-charcoal-2/80 transition-[transform,border-color,box-shadow] duration-700 hover:-translate-y-1.5 hover:border-gold/70 hover:shadow-[0_30px_60px_-30px_rgba(201,162,75,.45)] ${featured ? "border-gold/60" : "border-line-dark"}`}
    >
      {featured && (
        <div className="absolute -top-3 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap bg-crimson px-4 py-1 text-[0.62rem] font-bold uppercase tracking-[0.25em] text-ivory shadow-lg">
          {pkg.ribbon}
        </div>
      )}
      {/* finish swatch: a sliver of the card material */}
      <div className="relative h-24 overflow-hidden" style={{ background: F.base }} aria-hidden>
        <div className="absolute inset-0 opacity-30 mix-blend-overlay" style={{ background: "repeating-linear-gradient(90deg,rgba(255,255,255,.2) 0 1px,transparent 1px 3px)" }} />
        <div className="absolute inset-0 translate-x-[-120%] bg-[linear-gradient(110deg,transparent_30%,rgba(255,245,210,.55)_50%,transparent_70%)] transition-transform duration-[1400ms] group-hover:translate-x-[120%]" />
        <div className="absolute right-4 bottom-3 px-2.5 py-0.5 text-[0.6rem] font-extrabold tracking-[0.25em] uppercase" style={{ background: F.foilGradient, color: pkg.finish === "gold" ? "#f3dc8e" : pkg.finish === "bronze" ? "#f0d2ad" : "#1a1407" }}>
          {pkg.name}
        </div>
        {step != null && <div className="absolute top-3 left-4 text-[0.6rem] font-semibold tracking-[0.25em] uppercase" style={{ color: F.inkSoft }}>Tier {step}</div>}
      </div>
      <div className="flex flex-1 flex-col p-6">
        <h3 className="display text-[2rem] text-on-dark">{pkg.name}</h3>
        {pkg.tagline && <p className="mt-1 text-sm text-on-dark-soft">{pkg.tagline}</p>}
        <div className="mt-5 flex items-baseline gap-2 border-y border-line-dark py-4">
          <span className="display text-[1.9rem] text-gold-light">{kes(pkg.annualFeeKes)}</span>
          <span className="text-xs tracking-wider text-on-dark-soft uppercase">/ year</span>
        </div>
        {pkg.kind === "FAMILY" && pkg.maxLinked > 0 && (
          <p className="mt-4 text-sm text-gold-light">Primary member + up to {pkg.maxLinked} linked members</p>
        )}
        {inheritsFrom && (
          <p className="mt-4 text-sm font-semibold text-gold">Everything in {inheritsFrom.name}, plus:</p>
        )}
        <ul className="mt-3 flex-1 space-y-2.5 text-[0.92rem] text-on-dark/90">
          {pkg.benefits.map((b) => (
            <li key={b} className="flex gap-2.5">
              <Fleur className="mt-1 h-3 w-3 flex-none text-gold" />
              <span>{b}</span>
            </li>
          ))}
        </ul>
        <Link href={`/apply?package=${pkg.slug}`} className={`btn mt-7 w-full ${featured ? "btn-gold" : "btn-outline"}`}>
          Apply for {pkg.name}
        </Link>
      </div>
    </article>
  );
}
