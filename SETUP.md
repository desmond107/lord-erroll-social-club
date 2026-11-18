# Setup and deployment

## Recommended hosting

Run it as a Docker container on a VPS or container host close to Kenya, with Cloudflare in front for the CDN, TLS, DDoS protection and caching of static assets. Good options are AWS `af-south-1` (Cape Town), Azure South Africa North, or a European DigitalOcean or Hetzner region.

The app needs:

- **A persistent private disk** for `UPLOAD_DIR`, which holds the encrypted photos and documents. This rules out purely serverless hosts such as Vercel unless uploads are moved to S3-compatible storage.
- **Managed PostgreSQL 14+** with automated daily backups and point-in-time recovery, for example AWS RDS, DigitalOcean Managed PostgreSQL or Neon.
- **A ClamAV daemon** (`clamav/clamav` container) reachable at `CLAMAV_HOST`.

## 1. Configure

```bash
cp .env.example .env
openssl rand -base64 32   # → AUTH_SECRET
openssl rand -base64 32   # → DATA_ENCRYPTION_KEY  (store a copy in a password manager / secrets vault)
openssl rand -hex 24      # → CRON_SECRET
openssl rand -hex 16      # → MPESA_CALLBACK_SECRET
```

> ⚠️ **`DATA_ENCRYPTION_KEY` encrypts member emails, phones, ID numbers and every upload.** If it is lost, that data cannot be recovered. Keep it out of the code and store it separately from the database backups.

Leave `ADMIN_2FA="required"` and `PAYMENTS_SIMULATE="0"` in production. The simulator and dev endpoints are disabled when `NODE_ENV=production` regardless.

## 2. Database and first admin

```bash
npx prisma migrate deploy
npm run db:seed -- --base                          # packages + events only (no sample members, no sample staff)
npm run admin:create -- owner@lord-erroll.com "Owner Name" SUPER_ADMIN
```

Sign in at `/admin/login` with the one-time password, set up two-factor, and change the password under **Security**. Then go to **Packages** and confirm the real prices and benefits.

## 3. Build and run

```bash
docker build -t lord-erroll-club .
docker run -d --name club --env-file .env -p 3000:3000 \
  -v /var/lib/lord-erroll/uploads:/var/lib/lord-erroll/uploads lord-erroll-club
```

Or without Docker: `npm ci && npm run build && npm start`, managed by systemd or pm2.

Put Cloudflare (or nginx) in front with TLS. The app sends HSTS with `preload`, so serve HTTPS only. Set Cloudflare to *Full (strict)*.

## 4. Scheduled jobs

| When | What |
|---|---|
| Daily 06:00 EAT | `curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://club.lord-erroll.com/api/cron/daily` (or `npm run cron:daily` on the server) |
| Nightly 02:00 | `npm run backup`, then sync `./backups` off-site (rclone to S3, Backblaze, etc.) |

The daily job sends renewal reminders (30/14/3 days), expires memberships after the grace period, sends the junior age-out notices, lapses unconverted juniors, purges declined applications older than 12 months, and cleans up sessions and codes. It is safe to run more than once a day.

## 5. Payments

### M-Pesa (Daraja)

1. Go live on the Safaricom developer portal with the club's Paybill (or Till) and get the consumer key, secret and passkey.
2. Set the `MPESA_*` variables. The callback URL is built automatically as `<APP_URL>/api/payments/mpesa/callback/<MPESA_CALLBACK_SECRET>`.
3. Optionally set `MPESA_ALLOWED_IPS` to Safaricom's published callback IPs.
4. Test with `MPESA_ENV=sandbox` first.

### Card payments (Paystack, Kenya)

1. Set `PAYSTACK_SECRET_KEY`.
2. In the Paystack dashboard, set the webhook URL to `<APP_URL>/api/payments/paystack/webhook`.

### Manual payments

Accountants record cash and bank payments from the member's page in the admin.

## 6. Messaging

| Service | Setup |
|---|---|
| Resend | Verify the `lord-erroll.com` sending domain (SPF/DKIM), then set `RESEND_API_KEY` and `EMAIL_FROM`. |
| Africa's Talking | Register a sender ID (e.g. `LORDERROLL`) and set the `AT_*` variables. Twilio works as an alternative. |
| WhatsApp | Business-initiated messages need an approved template named `WHATSAPP_TEMPLATE`, with one body variable. |
| Notifications | Set `ADMIN_NOTIFY_EMAILS` for new-application and data-request alerts. |

Without credentials, each channel is skipped and logged, never broken.

## 7. Monitoring

- **Uptime:** point UptimeRobot or Better Stack at `/api/health` (200 = healthy).
- **Errors:** the app logs to stdout. Ship container logs to your provider, or add Sentry with `npx @sentry/wizard -i nextjs`.
- **Activity:** everything staff do is recorded in **Admin → Audit log**.

## 8. Before go-live checklist

- [ ] Real package prices and benefits saved (no *Unconfirmed* badges left).
- [ ] Junior age range and Family size confirmed under Settings and Packages.
- [ ] Terms and Privacy Policy reviewed by the club's lawyer; ODPC registration in place.
- [ ] Photos added (see README).
- [ ] Turnstile keys set (CAPTCHA on apply, lookup and sign-in).
- [ ] ClamAV running, with `CLAMAV_REQUIRED=1`.
- [ ] A test M-Pesa payment of a small amount made end to end, and the receipt received.
- [ ] Daily cron and nightly backup confirmed running, and one backup restored to test it.
- [ ] Sample staff accounts are absent (only `--base` was seeded).
