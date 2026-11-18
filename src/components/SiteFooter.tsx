import Link from "next/link";
import { CLUB } from "@/lib/site";
import { Crest, Filigree } from "./brand";

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="fleur-pattern border-t border-line-dark bg-charcoal text-on-dark-soft">
      <div className="mx-auto max-w-7xl px-4 pt-16 pb-10 sm:px-6 lg:px-10">
        <div className="grid gap-12 md:grid-cols-[1.3fr_1fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-4">
              <Crest size={54} />
              <div className="leading-none">
                <div className="blackletter text-[1.7rem] text-on-dark">The Lord Erroll</div>
                <div className="mt-1.5 text-[0.58rem] font-semibold uppercase tracking-[0.45em] text-gold">Social Club</div>
              </div>
            </div>
            <p className="mt-6 max-w-xs text-sm leading-relaxed">
              A private members&apos; club within The Lord Erroll Gourmet Restaurant, {CLUB.address}.
            </p>
          </div>
          <div>
            <div className="eyebrow mb-4">The Club</div>
            <ul className="space-y-2.5 text-sm">
              <li><Link className="hover:text-gold-light" href="/about">Heritage</Link></li>
              <li><Link className="hover:text-gold-light" href="/membership">Membership</Link></li>
              <li><Link className="hover:text-gold-light" href="/benefits">Privileges</Link></li>
              <li><Link className="hover:text-gold-light" href="/events">Events</Link></li>
            </ul>
          </div>
          <div>
            <div className="eyebrow mb-4">Members</div>
            <ul className="space-y-2.5 text-sm">
              <li><Link className="hover:text-gold-light" href="/apply">Apply for Membership</Link></li>
              <li><Link className="hover:text-gold-light" href="/lookup">Check My Membership</Link></li>
              <li><Link className="hover:text-gold-light" href="/account/login">Member Sign-in</Link></li>
              <li><Link className="hover:text-gold-light" href="/faq">FAQ</Link></li>
            </ul>
          </div>
          <div>
            <div className="eyebrow mb-4">Reservations</div>
            <ul className="space-y-2.5 text-sm">
              <li><a className="hover:text-gold-light" href={CLUB.phoneHref}>{CLUB.phone}</a></li>
              <li><a className="break-all hover:text-gold-light" href={`mailto:${CLUB.email}`}>{CLUB.email}</a></li>
              <li><a className="hover:text-gold-light" href={CLUB.whatsappHref} target="_blank" rel="noopener noreferrer">WhatsApp</a></li>
              <li>{CLUB.address}</li>
            </ul>
          </div>
        </div>
        <Filigree className="mt-14" />
        <div className="mt-8 flex flex-col items-center justify-between gap-4 text-xs sm:flex-row">
          <p>© {year} The Lord Erroll. All rights reserved.</p>
          <div className="flex gap-6">
            <Link className="hover:text-gold-light" href="/terms">Terms &amp; Conditions</Link>
            <Link className="hover:text-gold-light" href="/privacy">Privacy Policy</Link>
            <Link className="hover:text-gold-light" href="/contact">Contact</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
