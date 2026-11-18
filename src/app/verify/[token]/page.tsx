import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getAdmin } from "@/lib/admin-auth";
import { can } from "@/lib/roles";
import { getSettings } from "@/lib/settings";
import { effectiveStatus, EFFECTIVE_LABEL, isValidForEntry } from "@/lib/membership";
import { ageOn } from "@/lib/age";
import { fmtDate, fmtDateTime, publicName } from "@/lib/format";
import { rateLimit } from "@/lib/ratelimit";
import { clientIp, hashIp } from "@/lib/request";
import { audit } from "@/lib/audit";
import { Crest } from "@/components/brand";

export const metadata: Metadata = { title: "Membership verification", robots: { index: false, follow: false } };

/**
 * Opened by scanning the QR code on a card. Anyone sees validity, tier and a limited name;
 * signed-in staff with the "verify" permission also see the full name, photo and number.
 * Under-18 cardholders always carry a prominent JUNIOR flag.
 */
export default async function VerifyPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ip = hashIp(await clientIp());
  const staff = await getAdmin();
  const isStaff = !!staff && can(staff, "verify");

  if (!isStaff && !(await rateLimit(`verify:${ip}`, 30, 600)).ok) return <Shell><p className="text-center">Too many checks. Please wait a few minutes.</p></Shell>;

  const holder = /^[A-Za-z0-9_-]{16,40}$/.test(token)
    ? await prisma.cardholder.findUnique({ where: { verifyToken: token }, include: { membership: { include: { package: true } }, photo: true } })
    : null;
  if (!holder || !holder.active) {
    return (
      <Shell>
        <Verdict ok={false} title="Card not recognised" sub="This card is not valid. It may have been replaced or cancelled." />
      </Shell>
    );
  }
  const m = holder.membership;
  const { graceDays } = await getSettings();
  const status = effectiveStatus(m, graceDays);
  const ok = isValidForEntry(status);
  const under18 = ageOn(holder.dateOfBirth) < 18;
  const junior = m.isJunior;

  if (isStaff) await audit(staff, "verify.scan", "Cardholder", holder.id, { cardNumber: holder.cardNumber, status });

  const name = isStaff ? holder.fullName : junior ? "Junior member" : under18 ? "Family member (under 18)" : publicName(holder.fullName);

  return (
    <Shell>
      <Verdict ok={ok} title={ok ? "Valid membership" : `Membership ${EFFECTIVE_LABEL[status].toLowerCase()}`} sub={status === "GRACE" ? "Renewal is due: valid during the grace period." : undefined} />

      {(junior || under18) && (
        <div role="alert" className="mt-5 border-2 border-crimson-bright bg-crimson px-4 py-3 text-center">
          <div className="text-lg font-extrabold tracking-[0.2em] text-white uppercase">Junior: under 18</div>
          <div className="mt-1 text-sm text-white/90">No alcohol or tobacco. Not admitted to adult-only events. Must be accompanied by an adult.</div>
        </div>
      )}

      <div className="mt-6 flex items-center gap-5 border border-line-dark bg-charcoal-2 p-5">
        {isStaff && holder.photoId && !(junior && !holder.photoId) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/files/${holder.photoId}`} alt={`Photo of ${holder.fullName}`} className="h-24 w-24 flex-none border border-gold object-cover" />
        ) : (
          <div className="grid h-24 w-24 flex-none place-items-center border border-line-dark"><Crest size={52} /></div>
        )}
        <div className="min-w-0">
          <div className="display truncate text-[1.7rem]">{name}</div>
          <div className="mt-1 text-sm text-gold-light">{junior ? "Junior" : m.package.name}{holder.suffix && !junior ? ` · ${holder.relationship}` : ""}</div>
          {isStaff && <div className="mt-1 font-mono text-xs text-on-dark-soft">{holder.cardNumber}</div>}
          {!junior && <div className="mt-1 text-xs text-on-dark-soft">Valid until {fmtDate(m.expiresAt)}</div>}
        </div>
      </div>

      {isStaff ? (
        <p className="mt-5 text-center text-xs text-on-dark-soft">Checked by {staff.name} · {fmtDateTime(new Date())} · <Link className="link-gold" href="/admin/verify">Verify another</Link></p>
      ) : (
        <p className="mt-5 text-center text-xs text-on-dark-soft">Staff: <Link className="link-gold" href="/admin/login">sign in</Link> to see full details.</p>
      )}
    </Shell>
  );
}

function Verdict({ ok, title, sub }: { ok: boolean; title: string; sub?: string }) {
  return (
    <div className={`border-2 p-6 text-center ${ok ? "border-emerald-bright bg-emerald" : "border-crimson-bright bg-crimson/40"}`}>
      <div className={`mx-auto grid h-16 w-16 place-items-center rounded-full text-3xl ${ok ? "bg-emerald-bright text-white" : "bg-crimson-bright text-white"}`} aria-hidden>{ok ? "✓" : "✕"}</div>
      <h1 className="display mt-4 text-[2rem]">{title}</h1>
      {sub && <p className="mt-2 text-sm text-on-dark/85">{sub}</p>}
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="bg-vignette min-h-screen px-4 py-10">
      <div className="mx-auto max-w-md">
        <div className="mb-8 flex items-center justify-center gap-3">
          <Crest size={40} />
          <div className="leading-none">
            <div className="blackletter text-[1.5rem]">The Lord Erroll</div>
            <div className="mt-1 text-[0.55rem] font-semibold tracking-[0.45em] text-gold uppercase">Membership verification</div>
          </div>
        </div>
        {children}
      </div>
    </main>
  );
}
