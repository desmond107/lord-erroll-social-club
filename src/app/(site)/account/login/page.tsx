import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Crest, Filigree } from "@/components/brand";
import { Turnstile } from "@/components/Turnstile";
import { getAccount } from "@/lib/member-auth";
import { LoginClient } from "./LoginClient";

export const metadata: Metadata = { title: "Member sign-in", robots: { index: false } };

export default async function MemberLogin({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const safe = next && next.startsWith("/account") && !next.startsWith("//") ? next : "/account";
  if (await getAccount()) redirect(safe);
  return (
    <section className="bg-vignette flex min-h-screen items-center justify-center px-4 pt-[96px] pb-16">
      <div className="on-paper gold-frame w-full max-w-md p-7 sm:p-10">
        <div className="text-center">
          <Crest size={56} className="mx-auto" />
          <h1 className="display mt-5 text-[2.2rem] text-emerald">Member sign-in</h1>
          <Filigree className="mt-4 mb-8" />
        </div>
        <LoginClient next={safe} turnstile={<Turnstile />} />
        <p className="mt-8 text-center text-sm text-ink-soft">
          Not yet a member? <Link href="/apply" className="link-gold font-semibold">Apply for membership</Link>
        </p>
      </div>
    </section>
  );
}
