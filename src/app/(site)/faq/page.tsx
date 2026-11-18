import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/PageHero";
import { CLUB } from "@/lib/site";

export const metadata: Metadata = { title: "Frequently Asked Questions" };

const FAQ: [string, React.ReactNode][] = [
  ["How do I join?", <>Complete the <Link className="link-gold" href="/apply">application form</Link>. The membership committee reviews every application personally. If approved, you receive your membership number and a payment link; your membership becomes active as soon as the annual subscription is paid.</>],
  ["How long does approval take?", "Usually a few working days. If the committee needs anything further, we will write to you."],
  ["How can I pay?", "By M-Pesa (you'll receive a prompt on your phone) or by card. Cash and bank transfer can be arranged with the club and confirmed by our accounts team. A receipt is emailed for every payment."],
  ["When does my membership expire?", "Twelve months after it is activated. We send reminders 30, 14 and 3 days before expiry, and you can renew in a few clicks from your member account. Renewing keeps the same membership number."],
  ["What if I renew late?", "There is a short grace period after expiry. After that, the membership shows as Expired and the card is deactivated until you renew."],
  ["Can I change my package?", "You can upgrade at any time and pay only the pro-rated difference for the rest of the year. Downgrades take effect at renewal."],
  ["How does Family membership work?", "One primary adult member plus linked family members. Everyone receives their own card, numbered from the primary membership (for example LE-2026-000123-A). The family renews together in one payment."],
  ["Can my child be a member?", "Yes, through Junior membership, which a parent or legal guardian applies for and manages. Junior members have child-appropriate privileges only, are never admitted to adult-only events, and must be accompanied by an adult at the club. At 18 the membership converts to an adult package, keeping its number."],
  ["How do staff check my membership?", "Show your digital card. Staff scan the code on its back, which opens a verification page confirming your status."],
  ["What does the public membership check show?", "Only your first name and surname initial, package, status and expiry date. Full details need a one-time code sent to your registered phone or email. Junior numbers show only whether the membership is valid."],
  ["How is my personal data protected?", <>Your ID number, phone and email are encrypted, we never store card details, and you can ask us to correct or delete your data at any time. See our <Link className="link-gold" href="/privacy">Privacy Policy</Link>.</>],
];

export default function FaqPage() {
  return (
    <>
      <PageHero eyebrow="Help" title="Frequently Asked Questions" />
      <section className="on-paper py-16 sm:py-24">
        <div className="mx-auto max-w-3xl divide-y divide-line-light border-y border-line-light px-4 sm:px-0">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 font-serif text-[1.35rem] text-emerald">
                {q}
                <span className="text-gold-ink transition-transform duration-500 group-open:rotate-45" aria-hidden>+</span>
              </summary>
              <div className="mt-3 leading-relaxed text-ink-soft">{a}</div>
            </details>
          ))}
        </div>
        <p className="mt-10 text-center text-ink-soft">
          Still have a question? Call <a className="link-gold font-semibold" href={CLUB.phoneHref}>{CLUB.phone}</a> or email{" "}
          <a className="link-gold font-semibold" href={`mailto:${CLUB.email}`}>{CLUB.email}</a>.
        </p>
      </section>
    </>
  );
}
