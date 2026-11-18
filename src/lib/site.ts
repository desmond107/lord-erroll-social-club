/** Club facts used across the site, emails, cards and receipts. */
export const CLUB = {
  name: "The Lord Erroll Social Club",
  shortName: "The Lord Erroll",
  restaurant: "The Lord Erroll Gourmet Restaurant",
  tagline: "An Invitation to Distinction",
  address: "89 Ruaka Road, Nairobi",
  mapQuery: "The Lord Erroll Gourmet Restaurant, Ruaka Road, Nairobi",
  phone: "+254 721 920820",
  phoneHref: "tel:+254721920820",
  whatsappHref: "https://wa.me/254721920820",
  email: "reservations@lord-erroll.com",
  website: "lord-erroll.com",
  websiteHref: "https://lord-erroll.com",
  timezone: "Africa/Nairobi",
} as const;

export const NAV = [
  { href: "/about", label: "The Club" },
  { href: "/membership", label: "Membership" },
  { href: "/benefits", label: "Privileges" },
  { href: "/events", label: "Events" },
  { href: "/contact", label: "Contact" },
] as const;

export const HEARD_FROM = [
  "A current member",
  "Dining at The Lord Erroll",
  "Instagram / Facebook",
  "A friend or colleague",
  "Press or media",
  "Event at the club",
  "Other",
] as const;

/**
 * Photo slots. Drop the client's photography into /public/images/ with these file
 * names and set `ready: true`; until then the site shows an elegant placeholder frame.
 */
export const PHOTOS = {
  hero: { file: "/images/hero.jpg", label: "Verandah at dusk", ready: false },
  verandah: { file: "/images/verandah.jpg", label: "The verandah", ready: false },
  bar: { file: "/images/highlander-bar.jpg", label: "Highlander Bar lounge", ready: false },
  dining: { file: "/images/dining-room.jpg", label: "The dining room", ready: false },
  garden: { file: "/images/garden.jpg", label: "Gardens and peacocks", ready: false },
  wine: { file: "/images/wine.jpg", label: "Wine cellar", ready: false },
  cigar: { file: "/images/cigar-lounge.jpg", label: "Cigar lounge", ready: false },
  fineDining: { file: "/images/fine-dining.jpg", label: "Fine dining", ready: false },
} as const;
export type PhotoKey = keyof typeof PHOTOS;
