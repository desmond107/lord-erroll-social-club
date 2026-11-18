import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Manrope } from "next/font/google";
import localFont from "next/font/local";
import { headers } from "next/headers";
import { CLUB } from "@/lib/site";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-cormorant",
  display: "swap",
});
const manrope = Manrope({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-manrope", display: "swap" });
const fraktur = localFont({ src: "../assets/fonts/Fraktur.ttf", variable: "--font-fraktur", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL || "http://localhost:3000"),
  title: { default: `${CLUB.name} · ${CLUB.tagline}`, template: `%s · ${CLUB.name}` },
  description:
    "A private members' club at The Lord Erroll, Nairobi. Fine dining, cigar and whisky evenings, the Highlander Bar and the gardens, reserved for members.",
  openGraph: { type: "website", siteName: CLUB.name, images: ["/brand/logo-full.png"] },
  icons: { icon: "/brand/crest-240.png", apple: "/brand/crest-240.png" },
};

export const viewport: Viewport = { themeColor: "#0a2618", width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Reading the request makes every page render per-request, so Next can stamp the
  // middleware's CSP nonce onto its scripts.
  await headers();
  return (
    <html lang="en-KE" className={`${cormorant.variable} ${manrope.variable} ${fraktur.variable}`}>
      <body>{children}</body>
    </html>
  );
}
