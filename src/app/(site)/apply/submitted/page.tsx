import type { Metadata } from "next";
import Link from "next/link";
import { Crest, Filigree } from "@/components/brand";

export const metadata: Metadata = { title: "Application received", robots: { index: false } };

export default async function Submitted({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const { ref } = await searchParams;
  const safeRef = ref && /^APP-[A-Z0-9]{6}$/.test(ref) ? ref : null;
  return (
    <section className="bg-vignette flex min-h-[80vh] items-center pt-[72px]">
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <Crest size={84} className="crest-reveal mx-auto" />
        <h1 className="display fade-rise mt-8 text-[2.6rem]">Thank you</h1>
        <Filigree className="mt-6" />
        <p className="mt-6 text-lg text-on-dark/85">Your application is under review.</p>
        {safeRef && (
          <p className="mt-4 text-on-dark-soft">
            Your reference is <strong className="tracking-wider text-gold-light">{safeRef}</strong>.
          </p>
        )}
        <p className="mt-4 text-sm leading-relaxed text-on-dark-soft">
          We have sent a confirmation by email and SMS. The membership committee will be in touch. If approved, you will receive your
          membership number and a link to pay the annual subscription, after which your membership and card become active.
        </p>
        <Link href="/" className="btn btn-outline mt-10">Return home</Link>
      </div>
    </section>
  );
}
