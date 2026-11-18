import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAccount } from "@/lib/member-auth";
import { getSettings } from "@/lib/settings";
import { cardDataFor, verifyUrl } from "@/lib/cards";
import { MembershipCard3D } from "@/components/card/MembershipCard3D";
import { ShareLink } from "./ShareLink";

export const metadata: Metadata = { title: "My card", robots: { index: false } };

export default async function CardPage({ params }: { params: Promise<{ id: string }> }) {
  const account = await requireAccount();
  const { id } = await params;
  const holder = await prisma.cardholder.findUnique({ where: { id }, include: { membership: { include: { package: true, cardholders: true } } } });
  if (!holder || holder.membership.accountId !== account.id) notFound();
  const { graceDays } = await getSettings();
  const data = await cardDataFor(holder, holder.membership, graceDays);
  const active = !!holder.membership.activatedAt;

  return (
    <section className="bg-vignette min-h-screen pt-[72px]">
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <Link href="/account" className="text-xs tracking-[0.2em] text-on-dark-soft uppercase hover:text-gold-light">← My account</Link>
        <h1 className="display mt-6 text-center text-[2.4rem]">{holder.displayName}</h1>
        <p className="mt-1 text-center font-mono tracking-[0.15em] text-gold-light">{holder.cardNumber}</p>
        <div className="mt-10">
          <MembershipCard3D card={data} className="mx-auto max-w-[640px]" />
        </div>
        {active ? (
          <div className="mx-auto mt-12 max-w-xl space-y-8">
            <div>
              <div className="eyebrow mb-3 text-center">Download</div>
              <div className="flex flex-wrap justify-center gap-3">
                <a className="btn btn-outline btn-sm" href={`/api/cards/${holder.id}/front.png`}>Front (PNG)</a>
                <a className="btn btn-outline btn-sm" href={`/api/cards/${holder.id}/back.png`}>Back (PNG)</a>
                <a className="btn btn-gold btn-sm" href={`/api/cards/${holder.id}/card.pdf`}>Card (PDF)</a>
              </div>
            </div>
            <div>
              <div className="eyebrow mb-3 text-center">Share a verification link</div>
              <ShareLink url={verifyUrl(holder.verifyToken)} />
              <p className="mt-3 text-center text-xs text-on-dark-soft">Anyone with this link can see that the membership is valid, its tier and expiry. It never shows contact details.</p>
            </div>
          </div>
        ) : (
          <p className="mt-10 text-center text-on-dark/80">Your card&apos;s QR code and downloads are issued as soon as payment is confirmed.</p>
        )}
      </div>
    </section>
  );
}
