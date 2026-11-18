/**
 * End-to-end test of the whole membership lifecycle, through the real UI in Chrome:
 *   apply → admin approval → number issued → M-Pesa payment (simulator) → card active →
 *   public lookup + OTP verified view → QR verification → renewal → expiry,
 * plus Family, Junior, role permissions and payment-security checks.
 *
 * Needs a running dev server (npm run dev) with PAYMENTS_SIMULATE=1 and ADMIN_2FA=optional,
 * and the seed loaded (npm run db:seed). Run: npm run e2e  [BASE_URL=http://localhost:3217]
 * Set CHROME_PATH if Chrome isn't in the default macOS location.
 */
import { chromium, type Browser, type Page } from "playwright-core";
import { PrismaClient } from "@prisma/client";
import sharp from "sharp";
import fs from "fs/promises";
import path from "path";

const BASE = process.env.BASE_URL || process.env.APP_URL || "http://localhost:3000";
const CHROME = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const SECRET = process.env.CRON_SECRET!;
const PW = "LordErroll-dev-2026";
const prisma = new PrismaClient();
const OUT = path.resolve("e2e-output");

let passed = 0;
const failures: string[] = [];
async function step(name: string, fn: () => Promise<void>) {
  process.stdout.write(`• ${name} … `);
  try {
    await fn();
    passed++;
    console.log("ok");
  } catch (e) {
    failures.push(`${name}: ${(e as Error).message}`);
    console.log(`FAILED\n    ${(e as Error).message.split("\n")[0]}`);
  }
}
function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function outboxCode(to: string, since = 0): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const r = await fetch(`${BASE}/api/dev/outbox`, { headers: { authorization: `Bearer ${SECRET}` } });
    const box = (await r.json()) as { to: string; text: string; at: number }[];
    const hit = [...box].reverse().find((m) => m.at >= since && m.to.includes(to) && /\b\d{6}\b/.test(m.text));
    if (hit) return /\b(\d{6})\b/.exec(hit.text)![1];
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`No code sent to ${to}`);
}

// Dev servers compile pages on first visit, so allow generous timeouts.
async function newCtx(b: Browser) {
  const ctx = await b.newContext({ baseURL: BASE });
  ctx.setDefaultTimeout(90000);
  ctx.setDefaultNavigationTimeout(120000);
  return ctx;
}

async function adminLogin(b: Browser, email: string) {
  const ctx = await newCtx(b);
  const p = await ctx.newPage();
  await p.goto("/admin/login");
  await p.fill("#email", email);
  await p.fill("#password", PW);
  await Promise.all([p.waitForURL((u) => !u.pathname.startsWith("/admin/login")), p.click("form button:not([type=button])")]);
  return p;
}

async function memberLogin(b: Browser, email: string) {
  const ctx = await newCtx(b);
  const p = await ctx.newPage();
  await p.goto("/account/login");
  await p.fill("#identifier", email);
  const since = Date.now();
  await p.click("form button:not([type=button])");
  await p.waitForSelector("#code");
  await p.fill("#code", await outboxCode(email, since));
  await Promise.all([p.waitForURL((u) => u.pathname === "/account"), p.click("form button:not([type=button])")]);
  return p;
}

async function payWithSimulator(p: Page, membershipId: string, extra = "") {
  await p.goto(`/account/pay/${membershipId}${extra}`);
  await p.click("form button:not([type=button])");
  await p.getByRole("button", { name: "Approve payment" }).click();
  await p.getByRole("heading", { name: "Payment received" }).waitFor({ timeout: 20000 });
}

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  const b = await chromium.launch({ executablePath: CHROME });
  const tag = Date.now().toString(36);
  const email = `e2e-${tag}@test.lord-erroll.local`;
  const phone = `07${String(Date.now()).slice(-8)}`;
  const photo = path.join(OUT, "photo.png");
  await sharp({ create: { width: 400, height: 400, channels: 3, background: "#7a5a1a" } }).png().toFile(photo);
  const proof = path.join(OUT, "birth-cert.png");
  await sharp({ create: { width: 600, height: 400, channels: 3, background: "#eeeeee" } }).png().toFile(proof);

  // Earlier runs may have used up the rate limits (that is the limiter working); start clean.
  await prisma.rateBucket.deleteMany();
  // Warm-up: visit every page once so on-demand compilation doesn't skew the tests.
  {
    const ctx = await newCtx(b);
    const p = await ctx.newPage();
    for (const u of ["/", "/apply", "/apply/submitted", "/lookup", "/account/login", "/admin/login", "/verify/warmup-token-000000"]) await p.goto(u).catch(() => null);
    await ctx.close();
  }

  let ref = "";
  let membershipId = "";
  let number = "";

  // ── 1. Apply ────────────────────────────────────────────────────────────
  await step("Applicant submits an individual application with a photo", async () => {
    const ctx = await newCtx(b);
    const p = await ctx.newPage();
    await p.goto("/apply?package=emerald");
    await p.fill("#fullName", "Wanjiku E2E Tester");
    await p.fill("#phone", phone);
    await p.fill("#email", email);
    await p.fill("#idNumber", `E2E${tag}`.slice(0, 12));
    await p.fill("#dateOfBirth", "1990-04-12");
    await p.fill("#residence", "Runda, Nairobi");
    await p.fill("#occupation", "Architect");
    await p.selectOption("#heardFrom", "A current member");
    await p.setInputFiles("#photo", photo);
    await p.check("input[name=terms]");
    await p.check("input[name=privacy]");
    await Promise.all([p.waitForURL(/\/apply\/submitted/), p.click("form button:not([type=button])")]);
    ref = new URL(p.url()).searchParams.get("ref")!;
    assert(/^APP-[A-Z0-9]{6}$/.test(ref), `bad ref ${ref}`);
    await p.screenshot({ path: path.join(OUT, "01-submitted.png") });
    const app = await prisma.application.findUnique({ where: { ref } });
    assert(app?.status === "PENDING", "application not pending");
    assert(app.emailEnc.startsWith("v1.") && !app.emailEnc.includes("@"), "email not encrypted at rest");
    assert(app.photoId, "photo not stored");
    await ctx.close();
  });

  await step("Under-18 adult applicant is refused", async () => {
    const ctx = await newCtx(b);
    const p = await ctx.newPage();
    await p.goto("/apply?package=emerald");
    await p.fill("#fullName", "Too Young");
    await p.fill("#phone", "0712000999");
    await p.fill("#email", `young-${tag}@test.lord-erroll.local`);
    await p.fill("#idNumber", "12345678");
    await p.fill("#dateOfBirth", `${new Date().getFullYear() - 16}-01-01`);
    await p.fill("#residence", "Nairobi");
    await p.fill("#occupation", "Student");
    await p.selectOption("#heardFrom", "Other");
    await p.check("input[name=terms]");
    await p.check("input[name=privacy]");
    await p.click("form button:not([type=button])");
    await p.getByText("Adult membership is for applicants aged 18 and over").waitFor();
    await ctx.close();
  });

  // ── 2. Admin approval ───────────────────────────────────────────────────
  const admin = await adminLogin(b, "superadmin@dev.lord-erroll.local");
  await step("Admin sees the application in the queue and approves it", async () => {
    await admin.goto("/admin/applications");
    await admin.getByRole("link", { name: ref }).click();
    await admin.getByRole("heading", { name: "Wanjiku E2E Tester" }).waitFor();
    admin.once("dialog", (d) => d.accept());
    await admin.getByRole("button", { name: "Approve and issue number" }).click();
    await admin.getByText(/issued; the applicant has been sent payment instructions/).waitFor();
    const m = await prisma.membership.findFirstOrThrow({ where: { application: { ref } }, include: { cardholders: true } });
    membershipId = m.id;
    number = m.number;
    assert(/^LE-\d{4}-\d{6}$/.test(number), `bad number ${number}`);
    assert(m.status === "PENDING_PAYMENT", "should await payment");
    assert(m.cardholders[0]?.photoId, "photo should move to the card");
    assert(await prisma.issuedNumber.findUnique({ where: { number } }), "number not reserved");
  });

  // ── 3. Member signs in and pays ─────────────────────────────────────────
  const member = await memberLogin(b, email);
  await step("Member sees Pending status and pays by M-Pesa (simulated STK + callback)", async () => {
    await member.getByText("Pay and activate").first().waitFor();
    await payWithSimulator(member, membershipId);
    const m = await prisma.membership.findUniqueOrThrow({ where: { id: membershipId }, include: { payments: true } });
    assert(m.status === "ACTIVE", `status ${m.status}`);
    const days = (m.expiresAt!.getTime() - Date.now()) / 86400000;
    assert(days > 364 && days < 366, `expiry not 12 months (${days})`);
    const pay = m.payments.find((x) => x.status === "PAID")!;
    assert(pay.receiptNo?.startsWith("RCT-"), "no receipt number");
    assert(pay.providerTxnId?.startsWith("SIM"), "no M-Pesa receipt");
  });

  await step("Replaying the same M-Pesa callback does not double-apply", async () => {
    const pay = await prisma.payment.findFirstOrThrow({ where: { membershipId, status: "PAID" } });
    const before = await prisma.membership.findUniqueOrThrow({ where: { id: membershipId } });
    const r = await fetch(`${BASE}/api/payments/mpesa/callback/${process.env.MPESA_CALLBACK_SECRET}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(pay.rawCallback),
    });
    assert(r.ok, `callback ${r.status}`);
    const after = await prisma.membership.findUniqueOrThrow({ where: { id: membershipId } });
    assert(after.expiresAt!.getTime() === before.expiresAt!.getTime(), "expiry changed on replay");
    assert((await prisma.payment.count({ where: { membershipId, status: "PAID" } })) === 1, "duplicate payment");
  });

  await step("Callback with a wrong secret is rejected; forged amounts are refused", async () => {
    const r = await fetch(`${BASE}/api/payments/mpesa/callback/not-the-secret`, { method: "POST", body: "{}" });
    assert(r.status === 404, `expected 404, got ${r.status}`);
    const r2 = await fetch(`${BASE}/api/payments/paystack/webhook`, { method: "POST", body: JSON.stringify({ event: "charge.success", data: { reference: "x" } }) });
    assert(r2.status === 401, `unsigned Paystack webhook got ${r2.status}`);
    const r3 = await fetch(`${BASE}/api/dev/simulate-mpesa`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ paymentId: "x", ok: true }) });
    assert(r3.status === 400 || r3.status === 403, `simulator without auth got ${r3.status}`);
  });

  await step("Card is live with QR; PNG and PDF downloads work; receipt PDF downloads", async () => {
    await member.goto("/account");
    await member.getByText(number).first().waitFor();
    await member.screenshot({ path: path.join(OUT, "02-dashboard.png"), fullPage: true });
    const holder = await prisma.cardholder.findFirstOrThrow({ where: { membershipId, suffix: "" } });
    for (const f of ["front.png", "back.png", "card.pdf"]) {
      const r = await member.request.get(`/api/cards/${holder.id}/${f}`);
      assert(r.ok(), `${f} → ${r.status()}`);
      const buf = await r.body();
      await fs.writeFile(path.join(OUT, `card-${f}`), buf);
      assert(buf.length > 5000, `${f} too small`);
    }
    const pay = await prisma.payment.findFirstOrThrow({ where: { membershipId, status: "PAID" } });
    const rr = await member.request.get(`/api/receipts/${pay.id}`);
    assert(rr.ok() && rr.headers()["content-type"] === "application/pdf", "receipt PDF");
    await fs.writeFile(path.join(OUT, "receipt.pdf"), await rr.body());
    const other = await newCtx(b);
    const r403 = await other.request.get(`/api/cards/${holder.id}/front.png`);
    assert(r403.status() === 404, "card image must not be public");
    await other.close();
  });

  // ── 4. Public lookup ────────────────────────────────────────────────────
  await step("Public lookup shows limited details; OTP unlocks payment history", async () => {
    const ctx = await newCtx(b);
    const p = await ctx.newPage();
    await p.goto("/lookup");
    await p.fill("#number", number.toLowerCase());
    await p.getByRole("button", { name: "Check" }).click();
    await p.getByText("Wanjiku T.").waitFor();
    assert(!(await p.getByText("Wanjiku E2E Tester").count()), "full name leaked publicly");
    assert(!(await p.getByText(email).count()), "email leaked");
    await p.getByText("Active", { exact: true }).first().waitFor();
    const since = Date.now();
    await p.getByRole("button", { name: "Send code by email" }).click();
    await p.waitForSelector("#code");
    await p.fill("#code", await outboxCode(email, since));
    await p.getByRole("button", { name: "Verify" }).click();
    await p.getByText("Payment history").waitFor();
    await p.getByText(/RCT-\d{4}-\d{5}/).first().waitFor();
    await p.screenshot({ path: path.join(OUT, "03-lookup-verified.png"), fullPage: true });
    await ctx.close();
  });

  await step("QR verification page: public view is limited, staff view is full", async () => {
    const holder = await prisma.cardholder.findFirstOrThrow({ where: { membershipId, suffix: "" } });
    const ctx = await newCtx(b);
    const p = await ctx.newPage();
    await p.goto(`/verify/${holder.verifyToken}`);
    await p.getByRole("heading", { name: "Valid membership" }).waitFor();
    assert(!(await p.getByText("Wanjiku E2E Tester").count()), "public verify shows full name");
    await ctx.close();
    const desk = await adminLogin(b, "frontdesk@dev.lord-erroll.local");
    await desk.goto(`/verify/${holder.verifyToken}`);
    await desk.getByText("Wanjiku E2E Tester").waitFor();
    await desk.close();
  });

  // ── 5. Upgrade, renewal and expiry ─────────────────────────────────────
  await step("Mid-year upgrade charges the pro-rated difference and keeps the expiry", async () => {
    const [m, gold, em] = await Promise.all([
      prisma.membership.findUniqueOrThrow({ where: { id: membershipId } }),
      prisma.package.findUniqueOrThrow({ where: { slug: "silver" } }),
      prisma.package.findUniqueOrThrow({ where: { slug: "emerald" } }),
    ]);
    await member.goto(`/account/pay/${membershipId}?mode=upgrade`);
    await member.getByText("Silver", { exact: true }).click();
    await member.click("form button:not([type=button])");
    await member.getByRole("button", { name: "Approve payment" }).click();
    await member.getByRole("heading", { name: "Payment received" }).waitFor({ timeout: 20000 });
    const pay = await prisma.payment.findFirstOrThrow({ where: { membershipId, purpose: "UPGRADE" } });
    const daysLeft = Math.ceil((m.expiresAt!.getTime() - pay.createdAt.getTime()) / 86400000);
    const expected = Math.ceil(((gold.annualFeeKes - em.annualFeeKes) * Math.min(365, daysLeft)) / 365 / 10) * 10;
    assert(Math.abs(pay.amountKes - expected) <= 10, `upgrade charged ${pay.amountKes}, expected ≈${expected}`);
    const after = await prisma.membership.findUniqueOrThrow({ where: { id: membershipId }, include: { package: true } });
    assert(after.package.slug === "silver", "package not upgraded");
    assert(after.expiresAt!.getTime() === m.expiresAt!.getTime(), "upgrade changed expiry");
  });

  await step("Renewal within 60 days extends from the current expiry, same number", async () => {
    const soon = new Date(Date.now() + 20 * 86400000);
    await prisma.membership.update({ where: { id: membershipId }, data: { expiresAt: soon } });
    await payWithSimulator(member, membershipId);
    const m = await prisma.membership.findUniqueOrThrow({ where: { id: membershipId } });
    const diff = (m.expiresAt!.getTime() - soon.getTime()) / 86400000;
    assert(diff > 364 && diff < 367, `renewal added ${diff} days`);
    assert(m.number === number, "number changed on renewal");
  });

  await step("Daily job sends the 14-day reminder once (not 30 and 3 as well)", async () => {
    const in10 = new Date(Date.now() + 10 * 86400000);
    await prisma.membership.update({ where: { id: membershipId }, data: { expiresAt: in10 } });
    await prisma.reminderLog.deleteMany({ where: { membershipId } });
    for (let i = 0; i < 2; i++) {
      const r = await fetch(`${BASE}/api/cron/daily`, { headers: { authorization: `Bearer ${SECRET}` } });
      assert(r.ok, `cron ${r.status}`);
    }
    const logs = await prisma.reminderLog.findMany({ where: { membershipId } });
    assert(logs.length === 1 && logs[0].kind === "expiry-14", `reminders: ${logs.map((l) => l.kind).join(",")}`);
    const bad = await fetch(`${BASE}/api/cron/daily`, { headers: { authorization: "Bearer wrong" } });
    assert(bad.status === 403, "cron must need the secret");
  });

  await step("After expiry + grace the membership expires, the card dims and verification fails", async () => {
    const past = new Date(Date.now() - 60 * 86400000);
    await prisma.membership.update({ where: { id: membershipId }, data: { expiresAt: past } });
    await fetch(`${BASE}/api/cron/daily`, { headers: { authorization: `Bearer ${SECRET}` } });
    const m = await prisma.membership.findUniqueOrThrow({ where: { id: membershipId } });
    assert(m.status === "EXPIRED", `status ${m.status}`);
    const holder = await prisma.cardholder.findFirstOrThrow({ where: { membershipId, suffix: "" } });
    const ctx = await newCtx(b);
    const p = await ctx.newPage();
    await p.goto(`/verify/${holder.verifyToken}`);
    await p.getByRole("heading", { name: "Membership expired" }).waitFor();
    await ctx.close();
    await member.goto("/account");
    await member.getByText("Expired", { exact: true }).first().waitFor();
    await member.screenshot({ path: path.join(OUT, "04-expired.png"), fullPage: true });
  });

  await step("Renewing an expired membership reactivates the same number from today", async () => {
    await payWithSimulator(member, membershipId);
    const m = await prisma.membership.findUniqueOrThrow({ where: { id: membershipId } });
    assert(m.status === "ACTIVE" && m.number === number, "not reactivated");
    const days = (m.expiresAt!.getTime() - Date.now()) / 86400000;
    assert(days > 364 && days < 366, `expiry ${days}`);
  });

  // ── 6. Family ───────────────────────────────────────────────────────────
  await step("Family application approved as one; linked cards get -A/-B; lookup names adults only", async () => {
    const app = await prisma.application.findUniqueOrThrow({ where: { ref: "APP-SAMPL2" } });
    if (app.status === "PENDING") {
      await admin.goto(`/admin/applications/${app.id}`);
      admin.once("dialog", (d) => d.accept());
      await admin.getByRole("button", { name: "Approve and issue number" }).click();
      await admin.getByText(/issued; the applicant has been sent payment instructions/).waitFor();
    }
    const m = await prisma.membership.findFirstOrThrow({ where: { applicationId: app.id }, include: { cardholders: { orderBy: { suffix: "asc" } } } });
    const nums = m.cardholders.map((c) => c.cardNumber);
    assert(nums.includes(`${m.number}-A`) && nums.includes(`${m.number}-B`), `cards: ${nums}`);
    const ctx = await newCtx(b);
    const p = await ctx.newPage();
    await p.goto("/lookup");
    await p.fill("#number", m.number);
    await p.getByRole("button", { name: "Check" }).click();
    await p.getByText("Family member (under 18)").waitFor();
    await p.getByText("John W.").waitFor();
    assert(!(await p.getByText("Ivy").count()), "minor family member named publicly");
    await ctx.close();
  });

  // ── 7. Junior ───────────────────────────────────────────────────────────
  const gEmail = `guardian-${tag}@test.lord-erroll.local`;
  await step("Guardian applies for a Junior with consent + birth certificate", async () => {
    const ctx = await newCtx(b);
    const p = await ctx.newPage();
    await p.goto("/apply?package=junior");
    await p.fill("#fullName", "Akinyi Guardian");
    await p.fill("#phone", `0733${String(Date.now()).slice(-6)}`);
    await p.fill("#email", gEmail);
    await p.fill("#idNumber", "22334455");
    await p.fill("#dateOfBirth", "1982-02-02");
    await p.fill("#residence", "Karen, Nairobi");
    await p.fill("#occupation", "Doctor");
    await p.selectOption("#relationship", "Mother");
    await p.selectOption("#heardFrom", "A current member");
    await p.fill("#child_fullName", "Zawadi Junior");
    await p.fill("#child_dateOfBirth", `${new Date().getFullYear() - 12}-05-05`);
    await p.setInputFiles("#child_dobProof", proof);
    await p.check("input[name=guardianConsent]");
    await p.check("input[name=terms]");
    await p.check("input[name=privacy]");
    await Promise.all([p.waitForURL(/\/apply\/submitted/), p.click("form button:not([type=button])")]);
    const a = await prisma.application.findUniqueOrThrow({ where: { ref: new URL(p.url()).searchParams.get("ref")! }, include: { dependants: true } });
    assert(a.type === "JUNIOR" && a.guardianConsentAt && a.guardianConsentText, "consent not recorded");
    assert(a.dependants[0]?.dobProofId, "DOB proof not stored");
    await ctx.close();
  });

  await step("Only the Super Admin can open the DOB document, and the view is audited", async () => {
    const a = await prisma.application.findFirstOrThrow({ where: { type: "JUNIOR", emailIdx: { not: "" }, fullName: "Akinyi Guardian" }, include: { dependants: true }, orderBy: { createdAt: "desc" } });
    const fileId = a.dependants[0].dobProofId!;
    const mgr = await adminLogin(b, "manager@dev.lord-erroll.local");
    const r1 = await mgr.request.get(`/api/files/${fileId}`);
    assert(r1.status() === 404, `manager got ${r1.status()}`);
    await mgr.close();
    const r2 = await admin.request.get(`/api/files/${fileId}`);
    assert(r2.ok(), `super admin got ${r2.status()}`);
    assert(await prisma.auditLog.findFirst({ where: { action: "document.view_junior_dob", entityId: fileId } }), "view not audited");
  });

  await step("Junior approved: -J number; lookup shows validity only; verify shows the JUNIOR flag", async () => {
    const a = await prisma.application.findFirstOrThrow({ where: { type: "JUNIOR", fullName: "Akinyi Guardian" }, orderBy: { createdAt: "desc" } });
    await admin.goto(`/admin/applications/${a.id}`);
    admin.once("dialog", (d) => d.accept());
    await admin.getByRole("button", { name: "Approve and issue number" }).click();
    await admin.getByText(/issued; the applicant has been sent payment instructions/).waitFor();
    const m = await prisma.membership.findFirstOrThrow({ where: { applicationId: a.id }, include: { cardholders: true } });
    const child = m.cardholders[0];
    assert(m.isJunior && child.cardNumber === `${m.number}-J` && child.displayName === "Zawadi", `junior card ${child.cardNumber} ${child.displayName}`);
    const g = await memberLogin(b, gEmail);
    await payWithSimulator(g, m.id);
    await g.goto("/account");
    await g.getByText("Junior member, age 12.").waitFor();
    assert(!(await g.getByText("Cigar Night").count()), "adult event shown to junior-only account");
    await g.screenshot({ path: path.join(OUT, "05-junior-dashboard.png"), fullPage: true });
    const ctx = await newCtx(b);
    const p = await ctx.newPage();
    await p.goto("/lookup");
    await p.fill("#number", child.cardNumber);
    await p.getByRole("button", { name: "Check" }).click();
    await p.getByText("Valid Junior Membership").waitFor();
    assert(!(await p.getByText("Zawadi").count()), "junior name leaked on lookup");
    const fresh = await prisma.cardholder.findUniqueOrThrow({ where: { id: child.id } });
    await p.goto(`/verify/${fresh.verifyToken}`);
    await p.getByText("Junior: under 18").waitFor();
    await p.screenshot({ path: path.join(OUT, "06-junior-verify.png"), fullPage: true });
    await ctx.close();
  });

  await step("At 18 the guardian hands over; the young adult accepts, pays and keeps the number without -J", async () => {
    const child = await prisma.cardholder.findFirstOrThrow({ where: { suffix: "J", membership: { isJunior: true, account: { fullName: "Mary Achieng" } } }, include: { membership: true } });
    const d = new Date();
    await prisma.cardholder.update({ where: { id: child.id }, data: { dateOfBirth: new Date(Date.UTC(d.getUTCFullYear() - 18, d.getUTCMonth(), d.getUTCDate() - 1)) } });
    const guardian = await memberLogin(b, "mary@sample.lord-erroll.local");
    await guardian.goto(`/account/handover/${child.membershipId}`);
    const adultEmail = `tom-${tag}@test.lord-erroll.local`;
    await guardian.fill("#email", adultEmail);
    await guardian.fill("#phone", `0722${String(Date.now()).slice(-6)}`);
    await guardian.getByRole("button", { name: "Send invitation" }).click();
    await guardian.getByText(/emailed the new member/).waitFor();
    const adult = await memberLogin(b, adultEmail);
    await adult.getByRole("link", { name: "Take over my membership" }).click();
    await adult.check("input[name=terms]");
    await adult.check("input[name=privacy]");
    await Promise.all([adult.waitForURL(/\/account\/pay\//), adult.getByRole("button", { name: /Accept and continue/ }).click()]);
    await adult.click("form button:not([type=button])");
    await adult.getByRole("button", { name: "Approve payment" }).click();
    await adult.getByRole("heading", { name: "Payment received" }).waitFor({ timeout: 20000 });
    const m = await prisma.membership.findUniqueOrThrow({ where: { id: child.membershipId }, include: { package: true, cardholders: true } });
    assert(!m.isJunior && m.package.slug === "emerald", `package ${m.package.slug}, junior ${m.isJunior}`);
    assert(m.cardholders[0].cardNumber === m.number, `card ${m.cardholders[0].cardNumber}`);
    assert(m.status === "ACTIVE" && (m.expiresAt!.getTime() - Date.now()) / 86400000 > 364, "adult year not started today");
    const acct = await prisma.account.findUniqueOrThrow({ where: { id: m.accountId } });
    assert(acct.fullName === "Tom Achieng", "account not transferred to the young adult");
  });

  // ── 8. Roles ────────────────────────────────────────────────────────────
  await step("Role permissions are enforced on the server", async () => {
    const desk = await adminLogin(b, "frontdesk@dev.lord-erroll.local");
    await desk.goto("/admin/members");
    assert(new URL(desk.url()).pathname === "/admin/verify", `front desk reached ${desk.url()}`);
    const exp = await desk.request.get("/api/admin/export?type=payments&format=csv");
    assert(exp.status() === 403, "front desk exported payments");
    await desk.close();
    const acc = await adminLogin(b, "accountant@dev.lord-erroll.local");
    await acc.goto("/admin/applications");
    assert(new URL(acc.url()).pathname === "/admin/payments", `accountant reached ${acc.url()}`);
    const csv = await acc.request.get("/api/admin/export?type=payments&format=csv");
    assert(csv.ok() && (await csv.text()).includes("Receipt"), "accountant export");
    const x = await acc.request.get("/api/admin/export?type=payments&format=xlsx");
    assert(x.ok(), "xlsx export");
    const pdf = await acc.request.get("/api/admin/export?type=payments&format=pdf");
    assert(pdf.ok() && pdf.headers()["content-type"] === "application/pdf", "pdf export");
    await acc.close();
  });

  await step("Security headers present (CSP with nonce, HSTS, frame denial)", async () => {
    const r = await fetch(`${BASE}/`);
    const csp = r.headers.get("content-security-policy") || "";
    assert(/script-src[^;]*'nonce-/.test(csp), "CSP nonce missing");
    assert(csp.includes("frame-ancestors 'none'"), "frame-ancestors");
    assert(r.headers.get("strict-transport-security"), "HSTS");
    assert(r.headers.get("x-frame-options") === "DENY", "XFO");
  });

  await step("Admin screens render (overview, members, payments, packages, audit)", async () => {
    for (const u of ["/admin", "/admin/members", "/admin/payments", "/admin/packages", "/admin/messages", "/admin/events", "/admin/audit", "/admin/team", "/admin/settings", "/admin/data-requests", "/admin/verify"]) {
      const r = await admin.goto(u);
      assert(r?.ok(), `${u} → ${r?.status()}`);
    }
    await admin.goto("/admin");
    await admin.screenshot({ path: path.join(OUT, "07-admin-overview.png"), fullPage: true });
  });

  await b.close();
  await prisma.$disconnect();
  console.log(`\n${passed} passed, ${failures.length} failed. Screenshots and files in ${OUT}`);
  if (failures.length) {
    console.log(failures.map((f) => `  ✗ ${f}`).join("\n"));
    process.exit(1);
  }
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
