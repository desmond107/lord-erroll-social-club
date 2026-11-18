# API reference

Most of the site uses Next.js server actions, which are internal and protected by Next's
built-in Origin check. The HTTP endpoints below are the ones that outside systems or
downloads touch. All responses are `no-store`.

## Public / integrations

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/health` | none | Uptime check. `200 {"ok":true}` when app and database respond, `503` otherwise. |
| POST | `/api/payments/mpesa/callback/{MPESA_CALLBACK_SECRET}` | secret path + optional IP allowlist | Safaricom STK Push callback. See *Payment security*. Always answers `{"ResultCode":0}` to well-formed requests. |
| POST | `/api/payments/paystack/webhook` | `x-paystack-signature` (HMAC-SHA512 of the raw body with `PAYSTACK_SECRET_KEY`) | Paystack `charge.success`. `401` on a bad signature. |
| GET/POST | `/api/cron/daily` | `Authorization: Bearer $CRON_SECRET` | Runs the daily job. Returns `{reminders, expired, juniorNotices, juniorLapsed, purged}`. `403` without the secret. |
| GET | `/verify/{token}` | none (page) | QR verification page. Limited details publicly; full name and photo for signed-in staff with the *verify* permission. Rate-limited to 30 per 10 minutes per IP. |

## Member (session cookie `le_member`)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/payments/{paymentId}/status` | `{status: PENDING|PAID|FAILED|CANCELLED, reason?}` for the payer's own payment. Re-checks stored M-Pesa callbacks. |
| GET | `/api/cards/{cardholderId}/front.png` · `back.png` · `card.pdf` | Card images (1712×1080) and a card-size PDF. Owner or staff with *members.view*. `409` before activation. |
| GET | `/api/receipts/{paymentId}` | PDF receipt. Owner or staff with *payments.view*. |
| GET | `/api/files/{fileId}` | Private uploads. Photos: owner or staff. Junior date-of-birth documents: Super Admin only, and every view is audited. Otherwise `404`. |
| POST | `/account/logout` | Ends the session (same-origin only). |

## Staff (session cookie `le_admin`, 2FA enforced when `ADMIN_2FA=required`)

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/api/admin/export?type=payments&format=csv|xlsx|pdf&q=&status=&method=&from=&to=` | payments.view | Payment ledger export (filters match the ledger screen). CSV cells are protected against formula injection. |
| GET | `/api/admin/export?type=members&format=csv|xlsx|pdf` | members.view | Member directory export. Contact details are deliberately excluded. |
| GET | `/api/admin/data-export/{requestId}` | members.edit | Subject-access export (JSON) for a data-export request. |
| POST | `/admin/logout` | any | Ends the session. |

Every export and sensitive view is written to the audit log.

## Development only

Both return `404` when `NODE_ENV=production`.

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/dev/simulate-mpesa` `{paymentId, ok}` | Plays Safaricom for a simulated STK push and feeds the callback through the real handler. Needs `PAYMENTS_SIMULATE=1`; the payer's own session (browser) or `e2eKey=$CRON_SECRET` (script). |
| GET | `/api/dev/outbox` | Recent outbound messages (to read OTP codes in tests). `Authorization: Bearer $CRON_SECRET`. |

## Payment security

**M-Pesa.** Safaricom does not sign STK callbacks, so a callback is never trusted on its own:

1. The callback URL contains a secret segment.
2. The source IP can be restricted with `MPESA_ALLOWED_IPS`.
3. The `CheckoutRequestID` must match a pending payment we created, for the same amount.
4. The result is re-confirmed with the STK Push Query API before anything is applied.
5. The M-Pesa receipt number is unique in the database, so one receipt can never pay twice.
6. The PENDING→PAID change is a conditional update, so duplicate callbacks change nothing.

If the query lags behind the callback, the callback is stored and re-checked when the payer's page polls.

**Paystack.** The webhook signature is verified, then the transaction is fetched from Paystack's API and the amount and currency are checked. Card details never reach our servers.

**Manual.** Cash and bank payments are recorded by a user with *payments.confirm*, against the exact amount due. The audit log records who confirmed each one.

## Membership numbers

`LE-YYYY-NNNNNN`. The six digits are random rather than sequential, so numbers can't be guessed by counting. They are generated only on the server, inside the approval transaction. Every issued number is kept in `IssuedNumber`, so it is never reused, even after erasure. Card suffixes are `-A`…`-H` for family members and `-J` for a junior; the `-J` is dropped when a junior converts to adult membership.
