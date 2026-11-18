"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";

type Item = { href: string; label: string; badge?: number };

export function AdminNav({ items, user }: { items: Item[]; user: { name: string; role: string } }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const active = (href: string) => (href === "/admin" ? path === "/admin" : path.startsWith(href));
  return (
    <>
      <div className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-line-dark bg-emerald-deep px-4 lg:hidden">
        <Link href="/admin" className="flex items-center gap-2">
          <Image src="/brand/crest-240.png" alt="" width={26} height={29} />
          <span className="blackletter text-lg text-on-dark">The Lord Erroll</span>
        </Link>
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-controls="admin-nav" className="px-2 py-1 text-xs font-semibold tracking-widest text-gold-light uppercase">
          {open ? "Close" : "Menu"}
        </button>
      </div>
      <aside
        id="admin-nav"
        className={`${open ? "block" : "hidden"} fixed inset-y-0 left-0 z-50 w-64 overflow-y-auto border-r border-line-dark bg-emerald-deep text-on-dark lg:sticky lg:top-0 lg:block lg:h-screen`}
      >
        <Link href="/admin" className="flex items-center gap-3 px-5 pt-6 pb-5">
          <Image src="/brand/crest-240.png" alt="" width={34} height={38} />
          <span className="leading-none">
            <span className="blackletter block text-[1.25rem]">The Lord Erroll</span>
            <span className="mt-1 block text-[0.52rem] font-semibold tracking-[0.35em] text-gold uppercase">Administration</span>
          </span>
        </Link>
        <nav aria-label="Admin" className="px-3">
          {items.map((i) => (
            <Link
              key={i.href}
              href={i.href}
              onClick={() => setOpen(false)}
              aria-current={active(i.href) ? "page" : undefined}
              className={`mb-0.5 flex items-center justify-between px-3 py-2.5 text-sm transition-colors ${active(i.href) ? "bg-gold/15 text-gold-light" : "text-on-dark/80 hover:bg-white/5"}`}
            >
              {i.label}
              {!!i.badge && <span className="rounded-full bg-crimson px-2 py-0.5 text-[0.65rem] font-bold text-white">{i.badge}</span>}
            </Link>
          ))}
        </nav>
        <div className="mt-6 border-t border-line-dark px-5 py-5 text-xs">
          <div className="text-on-dark">{user.name}</div>
          <div className="text-on-dark-soft">{user.role}</div>
          <div className="mt-3 flex gap-4">
            <Link href="/admin/security" className="text-gold-light hover:underline">Security</Link>
            <form action="/admin/logout" method="post"><button className="text-gold-light hover:underline">Sign out</button></form>
          </div>
        </div>
      </aside>
      {open && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setOpen(false)} aria-hidden />}
    </>
  );
}
