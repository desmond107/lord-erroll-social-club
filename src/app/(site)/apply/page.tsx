import type { Metadata } from "next";
import { PageHero } from "@/components/PageHero";
import { Turnstile } from "@/components/Turnstile";
import { activePackages } from "@/lib/public-data";
import { getSettings } from "@/lib/settings";
import { ApplyForm } from "./ApplyForm";

export const metadata: Metadata = { title: "Apply for Membership", description: "Apply to join The Lord Erroll Social Club." };

export default async function ApplyPage({ searchParams }: { searchParams: Promise<{ package?: string }> }) {
  const [{ all }, settings, sp] = await Promise.all([activePackages(), getSettings(), searchParams]);
  return (
    <>
      <PageHero eyebrow="Membership" title="Apply for Membership" intro="Applications are reviewed personally by the membership committee. No payment is taken until you are approved." />
      <section className="on-paper py-14 sm:py-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <ApplyForm
            packages={all.map((p) => ({ slug: p.slug, name: p.name, kind: p.kind, annualFeeKes: p.annualFeeKes, maxLinked: p.maxLinked }))}
            initialPackage={sp.package}
            turnstile={<Turnstile />}
            juniorRange={[settings.juniorMinAge, settings.juniorMaxAge]}
          />
        </div>
      </section>
    </>
  );
}
