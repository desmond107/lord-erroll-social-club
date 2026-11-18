import Link from "next/link";

export function PageTitle({ title, sub, actions }: { title: string; sub?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-line-light pb-5">
      <div>
        <h1 className="font-serif text-[2.1rem] leading-tight text-emerald">{title}</h1>
        {sub && <div className="mt-1 text-sm text-ink-soft">{sub}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, children, className = "", actions }: { title?: string; children: React.ReactNode; className?: string; actions?: React.ReactNode }) {
  return (
    <section className={`border border-line-light bg-white p-5 ${className}`}>
      {(title || actions) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="font-serif text-xl text-emerald">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, hint, href, tone }: { label: string; value: React.ReactNode; hint?: string; href?: string; tone?: "warn" | "bad" | "ok" }) {
  const inner = (
    <div className={`h-full border bg-white p-5 ${tone === "warn" ? "border-warn/40" : tone === "bad" ? "border-bad/40" : "border-line-light"} ${href ? "transition-colors hover:border-gold-ink" : ""}`}>
      <div className="text-[0.65rem] font-bold tracking-[0.16em] text-ink-soft uppercase">{label}</div>
      <div className={`mt-2 font-serif text-[2.1rem] leading-none ${tone === "warn" ? "text-warn" : tone === "bad" ? "text-bad" : "text-ink"}`}>{value}</div>
      {hint && <div className="mt-2 text-xs text-ink-soft">{hint}</div>}
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="border border-dashed border-line-light p-8 text-center text-sm text-ink-soft">{children}</div>;
}

export function Denied() {
  return <div className="border-l-4 border-bad bg-white px-4 py-3 text-sm text-bad">Your role doesn&apos;t have access to that page.</div>;
}

export function Pager({ page, pages, href }: { page: number; pages: number; href: (p: number) => string }) {
  if (pages <= 1) return null;
  return (
    <nav aria-label="Pages" className="mt-4 flex items-center justify-between text-sm">
      {page > 1 ? <Link className="link-gold" href={href(page - 1)}>← Previous</Link> : <span />}
      <span className="text-ink-soft">Page {page} of {pages}</span>
      {page < pages ? <Link className="link-gold" href={href(page + 1)}>Next →</Link> : <span />}
    </nav>
  );
}
