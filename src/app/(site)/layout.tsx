import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { getAccount } from "@/lib/member-auth";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const account = await getAccount();
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[60] focus:bg-gold focus:px-4 focus:py-2 focus:text-charcoal">
        Skip to content
      </a>
      <SiteHeader signedIn={!!account} />
      <main id="main">{children}</main>
      <SiteFooter />
    </>
  );
}
