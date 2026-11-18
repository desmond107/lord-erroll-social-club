import type { Metadata } from "next";
import { PageHero } from "@/components/PageHero";
import { Filigree } from "@/components/brand";
import { CLUB } from "@/lib/site";

export const metadata: Metadata = { title: "Contact", description: `Reservations and membership enquiries: ${CLUB.phone}, ${CLUB.email}, ${CLUB.address}.` };

export default function ContactPage() {
  const map = `https://www.google.com/maps?q=${encodeURIComponent(CLUB.mapQuery)}&output=embed`;
  return (
    <>
      <PageHero eyebrow="Contact" title="We Look Forward to Receiving You" intro="Reservations, membership enquiries and private events." />
      <section className="on-paper py-16 sm:py-24">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 sm:px-6 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <div className="space-y-8">
              <div>
                <div className="eyebrow">Telephone</div>
                <a href={CLUB.phoneHref} className="display mt-2 block text-[2rem] text-emerald">{CLUB.phone}</a>
              </div>
              <div>
                <div className="eyebrow">Email</div>
                <a href={`mailto:${CLUB.email}`} className="mt-2 block text-lg break-all text-emerald underline-offset-4 hover:underline">{CLUB.email}</a>
              </div>
              <div>
                <div className="eyebrow">Address</div>
                <p className="mt-2 text-lg text-ink">{CLUB.address}</p>
              </div>
            </div>
            <Filigree className="my-10" />
            <a href={CLUB.whatsappHref} target="_blank" rel="noopener noreferrer" className="btn btn-green w-full sm:w-auto">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2c0 1.3.9 2.5 1.1 2.7.1.2 1.8 2.8 4.4 3.9 1.6.7 2.3.8 3.1.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1 0-.3-.1-.5-.2Z" /></svg>
              Message us on WhatsApp
            </a>
          </div>
          <div className="gold-frame min-h-[420px] overflow-hidden bg-white p-2">
            <iframe
              title={`Map showing ${CLUB.restaurant}`}
              src={map}
              className="h-full min-h-[400px] w-full border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>
      </section>
    </>
  );
}
