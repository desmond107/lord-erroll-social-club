/**
 * Seeds packages, events, admin users and SAMPLE members covering every state, for testing.
 * Run: npm run db:seed            (packages, events, admins, sample members)
 *      npm run db:seed -- --base  (packages, events and admins only, for production)
 * Safe to re-run: packages/events/admins are upserted; sample data is only created once.
 */
import { PrismaClient, type Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { SEED_EVENTS, SEED_PACKAGES } from "../src/data/packages";
import { encrypt, emailIdx, phoneIdx, idNumberIdx, normEmail, normPhone, normIdNumber, randomToken } from "../src/lib/crypto";
import { addDays, addYears } from "../src/lib/format";

const prisma = new PrismaClient();
const baseOnly = process.argv.includes("--base");
const DEV_PASSWORD = "LordErroll-dev-2026";

async function main() {
  for (const p of SEED_PACKAGES) {
    const data = { ...p, benefits: [...p.benefits], maxLinked: "maxLinked" in p ? p.maxLinked : 0 };
    await prisma.package.upsert({ where: { slug: p.slug }, create: data, update: {} });
  }
  if ((await prisma.event.count()) === 0) await prisma.event.createMany({ data: SEED_EVENTS.map((e) => ({ ...e })) });
  console.log("✓ packages and events");

  if (baseOnly) return;

  const pw = await bcrypt.hash(DEV_PASSWORD, 12);
  const admins = [
    { email: "superadmin@dev.lord-erroll.local", name: "Sample Super Admin", role: "SUPER_ADMIN" as const },
    { email: "manager@dev.lord-erroll.local", name: "Sample Manager", role: "MANAGER" as const },
    { email: "frontdesk@dev.lord-erroll.local", name: "Sample Reception", role: "FRONT_DESK" as const },
    { email: "accountant@dev.lord-erroll.local", name: "Sample Accountant", role: "ACCOUNTANT" as const },
  ];
  for (const a of admins) await prisma.adminUser.upsert({ where: { email: a.email }, create: { ...a, passwordHash: pw }, update: {} });
  console.log(`✓ admin users (password ${DEV_PASSWORD})`);

  if (await prisma.membership.count()) {
    console.log("• sample members already present; skipping");
    return;
  }

  const pkgs = Object.fromEntries((await prisma.package.findMany()).map((p) => [p.slug, p]));
  const now = new Date();
  let seq = 100100;
  const nextNumber = async () => {
    const n = `LE-${now.getUTCFullYear()}-${(seq += 7919).toString().slice(-6)}`;
    await prisma.issuedNumber.create({ data: { number: n } });
    return n;
  };
  const pii = (email: string, phone: string) => ({
    emailEnc: encrypt(normEmail(email)), emailIdx: emailIdx(email), phoneEnc: encrypt(normPhone(phone)), phoneIdx: phoneIdx(phone),
  });
  const dob = (y: number, m = 6, d = 15) => new Date(Date.UTC(y, m - 1, d));
  let receipt = 0;

  async function member(opts: {
    name: string; email: string; phone: string; pkg: string; status: Prisma.MembershipCreateInput["status"];
    activated?: Date; expires?: Date; birth: Date; linked?: { name: string; rel: string; birth: Date }[];
    junior?: { name: string; birth: Date }; payments?: boolean; suspendedReason?: string;
  }) {
    const account = await prisma.account.create({ data: { fullName: opts.name, ...pii(opts.email, opts.phone) } });
    const number = await nextNumber();
    const pkg = pkgs[opts.pkg];
    const m = await prisma.membership.create({
      data: {
        number, status: opts.status!, packageId: pkg.id, accountId: account.id, isJunior: !!opts.junior,
        activatedAt: opts.activated, memberSince: opts.activated, expiresAt: opts.expires, suspendedReason: opts.suspendedReason,
      },
    });
    const holders: Prisma.CardholderCreateManyInput[] = [];
    if (opts.junior) {
      holders.push({ membershipId: m.id, suffix: "J", cardNumber: `${number}-J`, fullName: opts.junior.name, displayName: opts.junior.name.split(" ")[0], relationship: "Junior member", dateOfBirth: opts.junior.birth, verifyToken: randomToken(18) });
    } else {
      holders.push({ membershipId: m.id, suffix: "", cardNumber: number, fullName: opts.name, displayName: opts.name, dateOfBirth: opts.birth, verifyToken: randomToken(18) });
      (opts.linked ?? []).forEach((l, i) => {
        const s = "ABCDEFGH"[i];
        holders.push({ membershipId: m.id, suffix: s, cardNumber: `${number}-${s}`, fullName: l.name, displayName: l.name, relationship: l.rel, dateOfBirth: l.birth, verifyToken: randomToken(18) });
      });
    }
    await prisma.cardholder.createMany({ data: holders });
    if (opts.payments && opts.activated) {
      // One paid year per elapsed year, ending at the current expiry.
      let start = opts.activated;
      let purpose: "NEW" | "RENEWAL" = "NEW";
      while (start < (opts.expires ?? now)) {
        const end = addYears(start, 1);
        receipt++;
        await prisma.payment.create({
          data: {
            membershipId: m.id, packageId: pkg.id, purpose, method: receipt % 3 === 0 ? "BANK" : "MPESA", status: "PAID", amountKes: pkg.annualFeeKes,
            receiptNo: `RCT-${start.getUTCFullYear()}-S${receipt.toString().padStart(4, "0")}`, providerTxnId: `SAMPLE${receipt.toString().padStart(4, "0")}`,
            periodStart: start, periodEnd: end, paidAt: start, createdAt: start, note: "Sample data",
          },
        });
        start = end;
        purpose = "RENEWAL";
      }
    }
    return { account, m, number };
  }

  // Active members across the ladder.
  await member({ name: "Amani Wanjiru", email: "amani@sample.lord-erroll.local", phone: "0711000001", pkg: "gold", status: "ACTIVE", activated: addDays(now, -500), expires: addDays(now, 230), birth: dob(1984), payments: true });
  await member({ name: "Daniel Otieno", email: "daniel@sample.lord-erroll.local", phone: "0711000002", pkg: "platinum", status: "ACTIVE", activated: addDays(now, -120), expires: addDays(now, 245), birth: dob(1971), payments: true });
  await member({ name: "Grace Muthoni", email: "grace@sample.lord-erroll.local", phone: "0711000003", pkg: "emerald", status: "ACTIVE", activated: addDays(now, -40), expires: addDays(now, 325), birth: dob(1995), payments: true });
  await member({ name: "Peter Kamau", email: "peter@sample.lord-erroll.local", phone: "0711000004", pkg: "bronze", status: "ACTIVE", activated: addDays(now, -355), expires: addDays(now, 10), birth: dob(1979), payments: true });
  await member({ name: "Sarah Njeri", email: "sarah@sample.lord-erroll.local", phone: "0711000005", pkg: "silver", status: "EXPIRED", activated: addDays(now, -420), expires: addDays(now, -55), birth: dob(1988), payments: true });
  await member({ name: "James Mwangi", email: "james@sample.lord-erroll.local", phone: "0711000006", pkg: "silver", status: "SUSPENDED", activated: addDays(now, -200), expires: addDays(now, 165), birth: dob(1976), payments: true, suspendedReason: "Sample: conduct review" });
  // Family with two linked members.
  await member({
    name: "Robert Kariuki", email: "robert@sample.lord-erroll.local", phone: "0711000007", pkg: "family", status: "ACTIVE", activated: addDays(now, -90), expires: addDays(now, 275), birth: dob(1975), payments: true,
    linked: [{ name: "Lucy Kariuki", rel: "Spouse", birth: dob(1978) }, { name: "Brian Kariuki", rel: "Child", birth: dob(2012, 3, 2) }],
  });
  // Junior, managed by a guardian; turns 18 in about 40 days.
  const b = addDays(now, 40);
  await member({ name: "Mary Achieng", email: "mary@sample.lord-erroll.local", phone: "0711000008", pkg: "junior", status: "ACTIVE", activated: addDays(now, -300), expires: addDays(now, 65), birth: dob(1980), payments: true, junior: { name: "Tom Achieng", birth: new Date(Date.UTC(b.getUTCFullYear() - 18, b.getUTCMonth(), b.getUTCDate())) } });
  // Approved, awaiting payment.
  await member({ name: "Faith Wairimu", email: "faith@sample.lord-erroll.local", phone: "0711000009", pkg: "emerald", status: "PENDING_PAYMENT", birth: dob(1992) });

  // Pending applications.
  const appBase = (name: string, email: string, phone: string, id: string) => ({
    fullName: name, ...pii(email, phone), idNumberEnc: encrypt(normIdNumber(id)), idNumberIdx: idNumberIdx(id),
    residence: "Runda, Nairobi", occupation: "Advocate", heardFrom: "A current member", termsAcceptedAt: now, privacyConsentAt: now,
  });
  await prisma.application.create({ data: { ref: "APP-SAMPL1", type: "INDIVIDUAL", packageId: pkgs.silver.id, dateOfBirth: dob(1986), ...appBase("Kevin Ochieng", "kevin@sample.lord-erroll.local", "0711000010", "21000010") } });
  await prisma.application.create({
    data: {
      ref: "APP-SAMPL2", type: "FAMILY", packageId: pkgs.family.id, dateOfBirth: dob(1982), ...appBase("Esther Wambui", "esther@sample.lord-erroll.local", "0711000011", "21000011"),
      dependants: { create: [{ fullName: "John Wambui", relationship: "Spouse", dateOfBirth: dob(1980) }, { fullName: "Ivy Wambui", relationship: "Child", dateOfBirth: dob(2014), sortOrder: 1 }] },
    },
  });
  await prisma.application.create({ data: { ref: "APP-SAMPL3", type: "INDIVIDUAL", packageId: pkgs.gold.id, status: "INFO_REQUESTED", messageToApplicant: "Sample: please confirm your proposer's name.", dateOfBirth: dob(1990), ...appBase("Mercy Akinyi", "mercy@sample.lord-erroll.local", "0711000012", "21000012") } });
  console.log("✓ sample members and applications");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
