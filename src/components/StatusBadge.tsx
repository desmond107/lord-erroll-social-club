const STYLES: Record<string, string> = {
  ACTIVE: "border-emerald-bright/60 bg-emerald-bright/15 text-[#7fd1a2]",
  GRACE: "border-gold/60 bg-gold/15 text-gold-light",
  PENDING: "border-gold/60 bg-gold/10 text-gold-light",
  EXPIRED: "border-crimson-bright/60 bg-crimson/20 text-[#f0a0a3]",
  SUSPENDED: "border-crimson-bright/60 bg-crimson/20 text-[#f0a0a3]",
  CANCELLED: "border-white/30 bg-white/5 text-on-dark-soft",
};

const LIGHT: Record<string, string> = {
  ACTIVE: "border-ok/40 bg-ok/10 text-ok",
  GRACE: "border-warn/40 bg-warn/10 text-warn",
  PENDING: "border-warn/40 bg-warn/10 text-warn",
  PENDING_PAYMENT: "border-warn/40 bg-warn/10 text-warn",
  INFO_REQUESTED: "border-warn/40 bg-warn/10 text-warn",
  APPROVED: "border-ok/40 bg-ok/10 text-ok",
  PAID: "border-ok/40 bg-ok/10 text-ok",
  EXPIRED: "border-bad/40 bg-bad/10 text-bad",
  LAPSED: "border-bad/40 bg-bad/10 text-bad",
  SUSPENDED: "border-bad/40 bg-bad/10 text-bad",
  REJECTED: "border-bad/40 bg-bad/10 text-bad",
  FAILED: "border-bad/40 bg-bad/10 text-bad",
  CANCELLED: "border-ink/20 bg-ink/5 text-ink-soft",
  WITHDRAWN: "border-ink/20 bg-ink/5 text-ink-soft",
};

export function StatusBadge({ status, label, light = false }: { status: string; label?: string; light?: boolean }) {
  const cls = (light ? LIGHT : STYLES)[status] ?? (light ? LIGHT.CANCELLED : STYLES.CANCELLED);
  return (
    <span className={`inline-flex items-center gap-1.5 border px-2.5 py-0.5 text-[0.68rem] font-bold tracking-[0.14em] whitespace-nowrap uppercase ${cls}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {label ?? status.replace(/_/g, " ").toLowerCase()}
    </span>
  );
}
