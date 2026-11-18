# Admin guide: The Lord Erroll Social Club

A short guide for the people who run the club day to day. Sign in at **/admin**.

## Signing in

1. Enter your email and password.
2. The first time, you will be asked to set up two-factor authentication. Scan the QR code with Google Authenticator, Microsoft Authenticator or 1Password, then enter the 6-digit code.
3. After that, every sign-in asks for a fresh code from the app.

If you lose your phone, ask a Super Admin to **reset your 2FA** under *Team*. Five wrong passwords lock the account for 15 minutes.

## Who can do what

| Role | Can |
|---|---|
| **Super Admin** | Everything, including the team, settings, the audit log, junior date-of-birth documents and data erasure. |
| **Manager** | Applications, members, packages, messages and events. |
| **Front desk / Reception** | Verify members at the door only. |
| **Accountant** | The payment ledger, exports, and confirming cash or bank payments. |

These rules are enforced by the server. A role that can't open a page is simply sent to its own home screen.

## Every day

### Verifying a member at the door (*Verify a member*)

- Type the number from the card (e.g. LE-2026-483920 or LE-2026-483920-A), or tap **Scan card QR with camera** on a phone or tablet.
- Alternatively, scan the code on the back of the card with your phone camera. While you are signed in, the page shows the member's full name and photo.
- **Green ✓ Valid** means admit. **Red ✕ Not valid** means the membership is expired, suspended or the card was replaced.
- A red **JUNIOR: under 18** banner means: no alcohol, no tobacco, no adult-only events (Ladies Night, Cigar Night, After Dinner at the Highlander Bar), and the junior must be with an adult.

### New applications (*Applications*)

The menu badge shows how many are waiting. Open one to see the applicant's details. Opening it is recorded in the audit log. Then choose:

- **Approve and issue number.** The system issues the membership number, prepares the card(s) and sends the member a payment link. The membership becomes **Active only once payment is received.**
- **Request more information.** Your question is emailed and texted to the applicant.
- **Decline.** Give a short, polite reason; it is shared with the applicant. Add an internal note if useful.

**Family** applications are approved together. Every linked member gets their own card (-A, -B…).

**Junior** applications show the guardian's details, the recorded consent and the child's age. Only a Super Admin can open the birth certificate or ID, and each view is logged. The system refuses to approve a child outside the Junior age range.

## Payments (*Payments*)

- M-Pesa and card payments confirm themselves. You'll see them appear as **paid**, each with a receipt number.
- **A member paid but it still shows pending?** Check the M-Pesa statement. If the money arrived, click **Resolve → Confirm received** and enter the M-Pesa code.
- **Cash or bank transfer.** Open the member, use **Record cash / bank payment**, choose the package and enter the reference. The amount must match what is due. The receipt is emailed automatically.
- **Export.** Use the CSV, Excel or PDF buttons. The filters (dates, method, status) apply to the export too.

## Members (*Members*)

Search by name, number or phone (phone needs the full number), and filter by status, package or *Junior only*. On a member's page you can:

- **Edit** the account holder's name, email or phone, or a card holder's details.
- **Extend** the membership by a number of days, with a reason (e.g. a courtesy extension).
- **Suspend** the membership with a reason; all its cards stop verifying immediately. **Reinstate** it later.
- **Deactivate a single card**, or **Issue new QR** if a card was lost. Old copies stop working.
- See payments, receipts and the reminders already sent.

## Packages (*Packages*)

**Before launch:** every package is marked *Unconfirmed sample data*. Open each one, set the real fee and benefits, and save.

- **Main tiers** form the ladder, ordered from top (entry tier) to bottom (most senior). List only what each tier *adds*; the website shows “Everything in Silver, plus…”.
- **Ribbon** puts “Most Popular” or “Most Prestigious” on a tier.
- **Card finish** controls the colour of the member's card.
- **Deactivate** hides a package from new applicants. Existing members keep it until renewal.
- Use ↑ ↓ to reorder.

## Messages (*Messages*)

- Renewal reminders go out **automatically** 30, 14 and 3 days before expiry. *Bulk renewal reminder* is for an extra nudge.
- **Announcement or event invitation:** choose the audience, packages and channels.
  - Tick **Adult-only** for anything about alcohol, cigars or adult events; Junior memberships are then excluded.
  - Tick **Marketing** to send only to members who opted in.
- Messages always go to the account holder. For a Junior that is the parent or guardian, never the child.

## Events (*Events*)

These appear on the public Events page and in the member portal. Keep **Adult-only** ticked for Ladies Night, Cigar Night and the Highlander Bar; adult-only events are never shown to Junior accounts.

## Data requests (*Data requests*)

Members can ask to correct, export or delete their data. Respond within **14 days**; requests open for 10 days or more are flagged.

- **Correction:** make the change on the member's page, then **Mark done**.
- **Export:** download the JSON file, email it to the member's registered address, then **Mark done**.
- **Deletion** (Super Admin only): type ERASE to confirm. This removes personal details, photos and documents and cancels the membership. Payment amounts are kept, under an anonymised name, for tax records.

## Settings (Super Admin)

- **Grace period:** days after expiry before a membership shows Expired (default 14).
- **Reminder days and channels.**
- **Junior age range** (default 8–17) and the conversion grace after 18 (default 60 days).
- **Paybill and bank details** shown to members who want to pay manually.
- **Integrations:** shows which services (M-Pesa, email, SMS…) are connected.

## Audit log (Super Admin)

Every sign-in, approval, payment confirmation, edit, export, verification scan and document view, with who did it and when. Entries cannot be changed.
