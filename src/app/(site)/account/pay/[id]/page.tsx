import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAccount } from "@/lib/member-auth";
import { quote, MembershipError, type Quote } from "@/lib/membership";
import { decryptOr } from "@/lib/crypto";
import { kes, fmtDate } from "@/lib/format";
import { mpesaConfigured, simulateEnabled } from "@/lib/payments/mpesa";
import { paystackConfigured } from "@/lib/payments/paystack";
import { getSettings } from "@/lib/settings";
import { PayClient } from "./PayClient";

export const metadata: Metadata = { title: "Payment", robots: { index: false } };

export default async function PayPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ mode?: string }> }) {
  const account = await requireAccount();
  const [{ id }, { mode }] = await Promise.all([params, searchParams]);
  const m = await prisma.membership.findUnique({ where: { id }, include: { package: true } });
  if (!m || m.accountId !== account.id) notFound();
  const settings = await getSettings();

  // Build every option the member could choose, keeping the ones the rules allow.
  const pkgs = await prisma.package.findMany({ where: { active: true }, orderBy: [{ kind: "asc" }, { rank: "asc" }] });
  const candidates = pkgs.filter((p) =>
    mode === "upgrade" ? p.kind === "MAIN" && m.package.kind === "MAIN" && p.rank > m.package.rank : true,
  );
  const options: (Quote & { id: string })[] = [];
  let firstError: string | null = null;
  for (const p of candidates) {
    try {
      const q = await quote(m.id, p.id);
      if (q.amount > 0) options.push({ ...q, id: p.id });
    } catch (e) {
      if (e instanceof MembershipError) firstError ??= e.message;
      else throw e;
    }
  }
  const defaultId = mode === "upgrade" ? options[0]?.id : (options.find((o) => o.id === (m.nextPackageId ?? m.packageId))?.id ?? options[0]?.id);

  return (
    <section className="bg-vignette min-h-screen pt-[72px]">
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        <Link href="/account" className="text-xs tracking-[0.2em] text-on-dark-soft uppercase hover:text-gold-light">← My account</Link>
        <h1 className="display mt-6 text-[2.6rem]">{m.status === "PENDING_PAYMENT" ? "Activate your membership" : mode === "upgrade" ? "Upgrade your package" : "Renew your membership"}</h1>
        <p className="mt-2 font-mono tracking-[0.15em] text-gold-light">{m.number}</p>
        {m.expiresAt && <p className="mt-2 text-sm text-on-dark-soft">Current expiry: {fmtDate(m.expiresAt)}</p>}

        {options.length === 0 ? (
          <div className="mt-10 border border-line-dark p-6 text-on-dark/85">
            {firstError ?? "There is nothing to pay at the moment."}
            <div className="mt-4"><Link href="/account" className="btn btn-outline btn-sm">Back to my account</Link></div>
          </div>
        ) : (
          <PayClient
            membershipId={m.id}
            options={options.map((o) => ({ id: o.id, name: o.pkg.name, amount: o.amount, amountLabel: kes(o.amount), purpose: o.purpose, note: o.note ?? null, current: o.pkg.id === m.packageId }))}
            defaultId={defaultId!}
            phone={decryptOr(account.phoneEnc)}
            mpesa={mpesaConfigured() || simulateEnabled()}
            simulated={!mpesaConfigured() && simulateEnabled()}
            card={paystackConfigured()}
            manual={{ paybill: settings.paybillNumber, bank: settings.bankDetails }}
          />
        )}
      </div>
    </section>
  );
}
