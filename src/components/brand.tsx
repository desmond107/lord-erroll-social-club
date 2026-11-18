import Image from "next/image";
import { PHOTOS, type PhotoKey } from "@/lib/site";

/** The Lord Erroll crest, cut from the client's logo (source 328 × 372). */
export function Crest({ size = 96, priority = false, className = "", alt = "The Lord Erroll crest" }: { size?: number; priority?: boolean; className?: string; alt?: string }) {
  return (
    <Image
      src="/brand/crest.png"
      alt={alt}
      width={size}
      height={Math.round((size * 372) / 328)}
      priority={priority}
      className={className}
      sizes={`${size}px`}
    />
  );
}

export function Fleur({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="currentColor" aria-hidden="true">
      <path d="M32 3c-5 6-7 12-7 18 0 5 3 9 7 12 4-3 7-7 7-12 0-6-2-12-7-18Zm-2 32c-4-5-9-8-15-8-5 0-9 3-9 8 0 4 3 7 7 7 3 0 5-2 5-5-2 1-5 0-5-2 0-3 3-4 6-4 5 0 8 4 9 8h2Zm4 0c4-5 9-8 15-8 5 0 9 3 9 8 0 4-3 7-7 7-3 0-5-2-5-5 2 1 5 0 5-2 0-3-3-4-6-4-5 0-8 4-9 8h-2ZM20 38h24v4H20zm9 5h6c0 6 2 11 6 15H23c4-4 6-9 6-15Z" />
    </svg>
  );
}

/** Gold filigree divider with a fleur-de-lis. */
export function Filigree({ className = "" }: { className?: string }) {
  return (
    <div className={`filigree ${className}`} aria-hidden="true">
      <Fleur className="h-4 w-4" />
    </div>
  );
}

/** "The Lord Erroll" in blackletter, with a spaced serif sub-line. */
export function Wordmark({ sub = "Social Club", size = "md", className = "" }: { sub?: string; size?: "sm" | "md" | "lg" | "xl"; className?: string }) {
  const s = { sm: "text-[1.5rem]", md: "text-[2.2rem]", lg: "text-[2.8rem] sm:text-[3.6rem]", xl: "text-[3.1rem] sm:text-[4.6rem] lg:text-[5.4rem]" }[size];
  const sub2 = { sm: "text-[0.55rem]", md: "text-[0.68rem]", lg: "text-[0.78rem]", xl: "text-[0.8rem] sm:text-[0.95rem]" }[size];
  return (
    <div className={`text-center leading-none ${className}`}>
      <div className={`blackletter ${s}`}>The Lord Erroll</div>
      {sub && <div className={`mt-2 font-sans font-semibold uppercase tracking-[0.5em] text-gold ${sub2}`}>{sub}</div>}
    </div>
  );
}

/** Photo frame: the client's photo when supplied, otherwise a labelled placeholder. */
export function Photo({ k, className = "", priority = false, sizes = "100vw" }: { k: PhotoKey; className?: string; priority?: boolean; sizes?: string }) {
  const p = PHOTOS[k];
  if (p.ready) {
    return (
      <div className={`relative overflow-hidden ${className}`}>
        <Image src={p.file} alt={p.label} fill priority={priority} sizes={sizes} className="object-cover" />
      </div>
    );
  }
  return (
    <div className={`photo-slot flex items-end ${className}`} role="img" aria-label={`Photograph to come: ${p.label}`}>
      <div className="relative m-5 flex items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-gold/70">
        <Fleur className="h-3 w-3" /> {p.label}
      </div>
    </div>
  );
}

export function SectionHead({ eyebrow, title, intro, className = "", align = "center" }: { eyebrow?: string; title: React.ReactNode; intro?: React.ReactNode; className?: string; align?: "center" | "left" }) {
  return (
    <div className={`${align === "center" ? "mx-auto text-center" : ""} max-w-3xl ${className}`}>
      {eyebrow && <div className="eyebrow mb-4">{eyebrow}</div>}
      <h2 className="display text-[2.3rem] sm:text-[3rem]">{title}</h2>
      {align === "center" && <Filigree className="mt-6" />}
      {intro && <div className={`mt-6 text-[1.05rem] leading-relaxed opacity-80 ${align === "center" ? "" : ""}`}>{intro}</div>}
    </div>
  );
}
