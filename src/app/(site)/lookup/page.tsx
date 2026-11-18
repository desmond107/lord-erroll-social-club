import type { Metadata } from "next";
import { PageHero } from "@/components/PageHero";
import { Turnstile } from "@/components/Turnstile";
import { LookupClient } from "./LookupClient";

export const metadata: Metadata = { title: "Check My Membership", description: "Check the status of a Lord Erroll Social Club membership by its number." };

export default async function LookupPage({ searchParams }: { searchParams: Promise<{ n?: string }> }) {
  const { n } = await searchParams;
  return (
    <>
      <PageHero eyebrow="Members" title="Check My Membership" intro="Enter a membership number to see its status. For privacy, only limited details are shown publicly." />
      <section className="bg-vignette py-14 sm:py-20">
        <div className="mx-auto max-w-2xl px-4 sm:px-6">
          <LookupClient turnstile={<Turnstile />} initialNumber={n?.slice(0, 30)} />
        </div>
      </section>
    </>
  );
}
