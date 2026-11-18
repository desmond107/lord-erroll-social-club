"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { NAV } from "@/lib/site";

export function SiteHeader({ signedIn }: { signedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const path = usePathname();

  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
  }, [open]);

  const solid = scrolled || open || path !== "/";

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-700 ${solid ? "border-b border-line-dark bg-charcoal/92 backdrop-blur-md" : "bg-transparent"}`}
    >
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-10">
        <Link href="/" className="flex items-center gap-3" aria-label="The Lord Erroll Social Club, home">
          <Image src="/brand/crest-240.png" alt="" width={34} height={38} priority />
          <span className="leading-none">
            <span className="blackletter block text-[1.3rem] text-on-dark">The Lord Erroll</span>
            <span className="mt-1 block text-[0.52rem] font-semibold uppercase tracking-[0.45em] text-gold">Social Club</span>
          </span>
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-8 lg:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`link-gold text-[0.72rem] font-semibold uppercase tracking-[0.22em] ${path.startsWith(n.href) ? "!text-gold" : "!text-on-dark/85"}`}
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <Link href={signedIn ? "/account" : "/account/login"} className="text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-on-dark/80 hover:text-gold-light">
            {signedIn ? "My Account" : "Member Sign-in"}
          </Link>
          <Link href="/apply" className="btn btn-gold btn-sm">
            Apply
          </Link>
        </div>

        <button
          type="button"
          className="relative grid h-11 w-11 place-items-center lg:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
        >
          <span className={`absolute h-px w-6 bg-gold-light transition-transform duration-500 ${open ? "rotate-45" : "-translate-y-[6px]"}`} />
          <span className={`absolute h-px w-6 bg-gold-light transition-opacity duration-300 ${open ? "opacity-0" : ""}`} />
          <span className={`absolute h-px w-6 bg-gold-light transition-transform duration-500 ${open ? "-rotate-45" : "translate-y-[6px]"}`} />
        </button>
      </div>

      <div
        id="mobile-nav"
        className={`fleur-pattern fixed inset-x-0 top-[72px] bottom-0 overflow-y-auto bg-emerald-deep transition-opacity duration-500 lg:hidden ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
        hidden={!open}
      >
        <nav aria-label="Mobile" className="flex flex-col items-center gap-1 px-6 py-10">
          {[...NAV, { href: "/lookup", label: "Check My Membership" }, { href: "/faq", label: "FAQ" }].map((n) => (
            <Link key={n.href} href={n.href} className="display w-full py-3 text-center text-[1.9rem] text-on-dark hover:text-gold-light">
              {n.label}
            </Link>
          ))}
          <div className="filigree my-6 w-full" aria-hidden="true">
            ❦
          </div>
          <Link href="/apply" className="btn btn-gold w-full max-w-xs">
            Apply for Membership
          </Link>
          <Link href={signedIn ? "/account" : "/account/login"} className="btn btn-outline mt-3 w-full max-w-xs">
            {signedIn ? "My Account" : "Member Sign-in"}
          </Link>
        </nav>
      </div>
    </header>
  );
}
