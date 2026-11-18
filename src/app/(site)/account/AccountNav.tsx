import Link from "next/link";
import { firstName } from "@/lib/format";

export function AccountNav({ name }: { name: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line-dark pb-5">
      <p className="text-on-dark/85">Welcome, <span className="font-serif text-xl text-gold-light">{firstName(name)}</span></p>
      <nav aria-label="Account" className="flex flex-wrap gap-x-6 gap-y-2 text-[0.7rem] font-semibold tracking-[0.18em] uppercase">
        <Link href="/account" className="hover:text-gold-light">Dashboard</Link>
        <Link href="/account/profile" className="hover:text-gold-light">Profile</Link>
        <Link href="/account/privacy" className="hover:text-gold-light">Privacy</Link>
        <form action="/account/logout" method="post"><button className="tracking-[0.18em] uppercase hover:text-gold-light">Sign out</button></form>
      </nav>
    </div>
  );
}
