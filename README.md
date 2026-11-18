# The Lord Erroll Social Club

Membership platform for The Lord Erroll, Nairobi. It covers:

- the public website;
- membership applications;
- the member portal with an interactive 3D card;
- M-Pesa and card payments with annual renewals;
- public lookup and QR verification;
- a role-based admin dashboard.

- **Setup and deployment:** [SETUP.md](SETUP.md)
- **Admin guide:** [docs/ADMIN-GUIDE.md](docs/ADMIN-GUIDE.md)
- **API reference and payment security:** [docs/API.md](docs/API.md)

## Stack, and why

| Layer | Choice | Why |
|---|---|---|
| App | **Next.js 15 (React 19, TypeScript)** | One codebase for the public site, portal and admin. Server rendering gives good SEO and Core Web Vitals, and server actions keep business logic on the server. |
| Database | **PostgreSQL + Prisma** | Relational integrity for money and memberships, plus transactions for number issuing and payment confirmation. |
| Rate limiting | **PostgreSQL** (atomic upsert counter) | Limits hold across every app instance without a separate Redis service. A Redis/Upstash limiter can drop in behind `src/lib/ratelimit.ts` if traffic ever needs it. |
| 3D card | **CSS 3D transforms** | Photorealistic depth, edge thickness, foil sweep and device tilt, with razor-sharp text and no WebGL bundle (~0 KB of extra JavaScript, compared with ~600 KB for Three.js). |
| Card PNG / PDF | **Satori (`next/og`) + pdf-lib** | The downloaded card uses the same finish tokens and guilloché as the on-screen card, with the brand fonts embedded. |
| Payments | **M-Pesa Daraja STK Push**, **Paystack** (cards, KES), manual cash/bank | Paystack is swappable for Flutterwave or Pesapal behind `src/lib/payments/`. |
| Messaging | **Resend** (email), **Africa's Talking or Twilio** (SMS), **Meta Cloud API** (WhatsApp) | |
| CAPTCHA | **Cloudflare Turnstile** | |

## The membership lifecycle

```
Apply → Pending Approval → (admin) Approve → number LE-2026-xxxxxx issued, card prepared,
        payment link sent → Pay (M-Pesa / card / cash) → ACTIVE, 12 months
   → reminders 30 / 14 / 3 days → renew (same number, from the old expiry)
   → or expiry → grace period → EXPIRED, card dimmed and verification fails
```

- **Family:** one approval covers the whole family. Linked cards are numbered `-A`, `-B`… from the primary, and the family renews in one payment. A lookup by the primary number shows every member, but under-18s are never named.
- **Junior (under 18):** applied for by a guardian, with a recorded consent declaration and a date-of-birth document that only the Super Admin can view (each view is audited).
  - The card number ends `-J` and shows the first name only.
  - The public lookup returns validity only; staff scans show **JUNIOR: under 18**.
  - Adult events are never shown or promoted to Junior accounts.
  - Age is checked at application, approval and every renewal. The guardian is told 60 days before the 18th birthday. At 18 the young adult takes over the account, accepts the terms, picks a tier and keeps the number without `-J`. If nothing happens within the grace period, the membership lapses.

## Security summary

- HTTPS with HSTS and preload, a per-request nonce CSP, `X-Frame-Options: DENY`, nosniff, a strict referrer policy, and COOP.
- **Passwords:** hashed with bcrypt (cost 12).
- **Staff accounts:** TOTP two-factor is required (`ADMIN_2FA=required`), and accounts lock out after 5 failed attempts.
- **Members:** sign in by OTP or password. Login, OTP, lookup, apply, verify and pay are all rate-limited, and the public forms carry a CAPTCHA.
- **Encryption at rest:** email, phone and ID numbers use AES-256-GCM, with keyed blind indexes for search. Uploads are AES-256-GCM encrypted, stored outside `/public`, type-checked by magic bytes, re-encoded through sharp (which strips metadata and payloads), and virus-scanned with ClamAV.
- **Payments:** no card data is ever stored. M-Pesa callbacks are verified as described in [docs/API.md](docs/API.md); Paystack webhooks are HMAC-verified and re-fetched. Payments are idempotent, and provider receipts are unique.
- **Permissions and audit:** role permissions are enforced on the server for every page, action and route. A full audit log records each action.
- **Kenya Data Protection Act:** consent checkboxes, a privacy policy, guardian consent for children, and correction, export and erasure requests from the portal. Declined applications are purged after 12 months.

## Development

```bash
npm install
cp .env.example .env          # then fill in DATABASE_URL, AUTH_SECRET, DATA_ENCRYPTION_KEY, CRON_SECRET, MPESA_CALLBACK_SECRET
#   for local dev also set:  ADMIN_2FA="optional"  PAYMENTS_SIMULATE="1"  APP_URL="http://localhost:3217"
npx prisma migrate dev
npm run db:seed               # packages, events, 4 staff logins, sample members
npm run dev -- -p 3217
npm run e2e                   # full-flow browser test (needs Chrome and the dev server running)
```

Sample staff logins all use the password `LordErroll-dev-2026`:

- `superadmin@dev.lord-erroll.local`
- `manager@dev.lord-erroll.local`
- `frontdesk@dev.lord-erroll.local`
- `accountant@dev.lord-erroll.local`

Sample members are at `*@sample.lord-erroll.local`. Sign in with a one-time code; in development the code is printed in the server log via the dev outbox.

## Before launch: items to confirm with the client

1. **Package prices and benefits** are samples. Each package shows *Unconfirmed* until it is saved in Admin → Packages.
2. **Junior age range** (default 8–17) and the number of **Family linked members** (default 4).
3. **Photography.** Drop files into `public/images/` and flip `ready: true` in `src/lib/site.ts`; until then the site shows elegant labelled placeholders. Needed: hero (verandah at dusk), verandah, Highlander Bar, dining room, garden and peacocks, wine, cigar lounge, fine dining.
4. **Heritage copy** on the About page, plus the draft **Terms** and **Privacy Policy** (legal review; ODPC registration details).
5. **Apple/Google Wallet** passes are feasible but need an Apple Developer *Pass Type ID* certificate and a Google Wallet issuer account. Until then members can download the card as PNG or PDF or share its verification link.
6. **Credentials:** Daraja (shortcode, passkey), Paystack, Resend (with a verified sending domain), Africa's Talking sender ID, a WhatsApp template, Turnstile keys, and a ClamAV host.
# lord-erroll-social-club
