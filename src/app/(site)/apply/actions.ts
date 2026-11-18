"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/ratelimit";
import { verifyTurnstile } from "@/lib/turnstile";
import { clientIp, hashIp } from "@/lib/request";
import { encrypt, emailIdx, idNumberIdx, normEmail, normIdNumber, normPhone, phoneIdx } from "@/lib/crypto";
import { ageOn, parseDob } from "@/lib/age";
import { getSettings } from "@/lib/settings";
import { storeUpload, deleteUpload, UploadError } from "@/lib/uploads";
import { applicationRef } from "@/lib/numbers";
import { audit } from "@/lib/audit";
import { sendEmail, sendSms, adminNotifyEmails } from "@/lib/notify";
import * as mails from "@/lib/emails";
import { HEARD_FROM } from "@/lib/site";
import { GUARDIAN_CONSENT } from "@/lib/consent";

export type ApplyState = { error?: string; fields?: Record<string, string> } | null;

const text = (max: number, min = 1) => z.string().trim().min(min, "Required").max(max, "Too long");
const phone = z.string().trim().refine((v) => /^\d{9,15}$/.test(normPhone(v)), "Enter a valid phone number, e.g. 0712 345 678");
const dob = z.string().refine((v) => !!parseDob(v), "Enter a valid date");

const Applicant = z.object({
  type: z.enum(["INDIVIDUAL", "FAMILY", "JUNIOR"]),
  packageSlug: text(40),
  fullName: text(120, 3).refine((v) => v.includes(" "), "Please give your full name"),
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(160),
  phone,
  idNumber: text(30, 5).refine((v) => /^[A-Za-z0-9 -]+$/.test(v), "Letters and numbers only"),
  dateOfBirth: dob,
  residence: text(120, 2),
  occupation: text(120, 2),
  heardFrom: z.enum(HEARD_FROM),
  relationship: z.string().trim().max(40).optional(),
  terms: z.literal("on", { errorMap: () => ({ message: "Please accept the Terms and Conditions" }) }),
  privacy: z.literal("on", { errorMap: () => ({ message: "Please consent to the Privacy Policy" }) }),
  marketing: z.string().optional(),
  guardianConsent: z.string().optional(),
  photoConsent: z.string().optional(),
});

const Dependant = z.object({ fullName: text(120, 2), relationship: text(40), dateOfBirth: dob });

const file = (fd: FormData, k: string) => {
  const f = fd.get(k);
  return f instanceof File && f.size > 0 ? f : null;
};

export async function submitApplication(_: ApplyState, fd: FormData): Promise<ApplyState> {
  const ip = await clientIp();
  const raw = Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === "string")) as Record<string, string>;
  const echo = { ...raw };
  delete echo.idNumber; // never echo sensitive fields back into the page

  if (!(await rateLimit(`apply:${hashIp(ip)}`, 6, 3600)).ok) return { error: "Too many applications from this connection. Please try again later.", fields: echo };
  if (!(await verifyTurnstile(raw["cf-turnstile-response"] ?? "", ip))) return { error: "Please complete the security check.", fields: echo };
  if (raw.website) return { error: "Please try again.", fields: echo }; // honeypot

  const parsed = Applicant.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { error: `${labelOf(String(first.path[0]))}: ${first.message}`, fields: echo };
  }
  const a = parsed.data;
  const settings = await getSettings();
  const pkg = await prisma.package.findUnique({ where: { slug: a.packageSlug } });
  if (!pkg || !pkg.active) return { error: "Please choose an available package.", fields: echo };
  const wantKind = a.type === "INDIVIDUAL" ? "MAIN" : a.type;
  if (pkg.kind !== wantKind) return { error: "That package doesn't match the membership type.", fields: echo };

  const applicantDob = parseDob(a.dateOfBirth)!;
  if (ageOn(applicantDob) < 18)
    return { error: a.type === "JUNIOR" ? "The parent or guardian must be 18 or over." : "Adult membership is for applicants aged 18 and over. Young people can join through Junior membership.", fields: echo };

  // Dependants (family members or the junior child).
  const deps: { fullName: string; relationship: string; dateOfBirth: Date; photo: File | null; proof: File | null }[] = [];
  if (a.type === "FAMILY") {
    for (let i = 0; i < 8; i++) {
      if (!raw[`dep${i}_fullName`]) continue;
      const d = Dependant.safeParse({ fullName: raw[`dep${i}_fullName`], relationship: raw[`dep${i}_relationship`], dateOfBirth: raw[`dep${i}_dateOfBirth`] });
      if (!d.success) return { error: `Family member ${deps.length + 1}: ${d.error.issues[0].message}`, fields: echo };
      deps.push({ ...d.data, dateOfBirth: parseDob(d.data.dateOfBirth)!, photo: file(fd, `dep${i}_photo`), proof: null });
    }
    if (deps.length > pkg.maxLinked) return { error: `This package covers up to ${pkg.maxLinked} linked members.`, fields: echo };
  }
  if (a.type === "JUNIOR") {
    if (!a.relationship) return { error: "Please state your relationship to the child.", fields: echo };
    if (a.guardianConsent !== "on") return { error: "Please confirm the guardian consent declaration.", fields: echo };
    const d = Dependant.safeParse({ fullName: raw.child_fullName, relationship: "Junior member", dateOfBirth: raw.child_dateOfBirth });
    if (!d.success) return { error: `Child: ${d.error.issues[0].message}`, fields: echo };
    const childDob = parseDob(d.data.dateOfBirth)!;
    const age = ageOn(childDob);
    if (age < settings.juniorMinAge || age > settings.juniorMaxAge)
      return { error: `Junior membership is for ages ${settings.juniorMinAge} to ${settings.juniorMaxAge}. The child is ${age}.`, fields: echo };
    const proof = file(fd, "child_dobProof");
    if (!proof) return { error: "Please upload the child's birth certificate or ID to verify their date of birth.", fields: echo };
    const childPhoto = file(fd, "child_photo");
    if (childPhoto && a.photoConsent !== "on") return { error: "Please tick the photo consent box, or remove the child's photo.", fields: echo };
    deps.push({ ...d.data, dateOfBirth: childDob, photo: childPhoto, proof });
  }

  const eIdx = emailIdx(a.email);
  const dup = await prisma.application.findFirst({ where: { emailIdx: eIdx, status: { in: ["PENDING", "INFO_REQUESTED"] }, type: a.type } });
  if (dup) return { error: `An application from this email is already under review (${dup.ref}). We'll be in touch soon.`, fields: echo };

  // Store files (validated, re-encoded, scanned, encrypted). Clean up if anything fails.
  const written: string[] = [];
  const save = async (f: File | null, kind: "PHOTO" | "DOB_PROOF") => {
    if (!f) return undefined;
    const meta = await storeUpload(f, kind);
    written.push(meta.path);
    return meta;
  };
  let appId: string;
  let ref: string;
  try {
    const photo = a.type === "JUNIOR" ? undefined : await save(file(fd, "photo"), "PHOTO");
    const depFiles: { photo?: Prisma.StoredFileCreateInput; proof?: Prisma.StoredFileCreateInput }[] = [];
    for (const d of deps) depFiles.push({ photo: await save(d.photo, "PHOTO"), proof: await save(d.proof, "DOB_PROOF") });

    const now = new Date();
    ref = applicationRef();
    const data: Prisma.ApplicationCreateInput = {
      ref,
      type: a.type,
      package: { connect: { id: pkg.id } },
      fullName: a.fullName,
      emailEnc: encrypt(normEmail(a.email)),
      emailIdx: eIdx,
      phoneEnc: encrypt(normPhone(a.phone)),
      phoneIdx: phoneIdx(a.phone),
      idNumberEnc: encrypt(normIdNumber(a.idNumber)),
      idNumberIdx: idNumberIdx(a.idNumber),
      dateOfBirth: applicantDob,
      residence: a.residence,
      occupation: a.occupation,
      heardFrom: a.heardFrom,
      relationship: a.type === "JUNIOR" ? a.relationship : null,
      termsAcceptedAt: now,
      privacyConsentAt: now,
      marketingOk: a.marketing === "on",
      guardianConsentText: a.type === "JUNIOR" ? GUARDIAN_CONSENT : null,
      guardianConsentAt: a.type === "JUNIOR" ? now : null,
      photoConsentAt: a.type === "JUNIOR" && deps[0]?.photo ? now : null,
      ip: hashIp(ip),
      photo: photo ? { create: photo } : undefined,
      dependants: {
        create: deps.map((d, i) => ({
          fullName: d.fullName,
          relationship: d.relationship,
          dateOfBirth: d.dateOfBirth,
          sortOrder: i,
          photo: depFiles[i].photo ? { create: depFiles[i].photo } : undefined,
          dobProof: depFiles[i].proof ? { create: depFiles[i].proof } : undefined,
        })),
      },
    };
    const app = await prisma.application.create({ data });
    appId = app.id;
  } catch (e) {
    await Promise.all(written.map(deleteUpload));
    if (e instanceof UploadError) return { error: e.message, fields: echo };
    console.error("[apply] failed", e);
    return { error: "Something went wrong saving your application. Please try again.", fields: echo };
  }

  await audit("applicant", "application.submit", "Application", appId, { ref, type: a.type, package: pkg.slug });
  const confirm = mails.applicationReceived(a.fullName, ref, pkg.name);
  const adminMail = mails.adminNewApplication(ref, a.fullName, pkg.name, a.type, appId);
  await Promise.allSettled([
    sendEmail({ to: normEmail(a.email), ...confirm, kind: "application.received" }),
    sendSms(a.phone, `The Lord Erroll Social Club: your application ${ref} is under review. We'll be in touch soon.`, "application.received"),
    ...adminNotifyEmails().map((to) => sendEmail({ to, ...adminMail, kind: "admin.new_application" })),
  ]);
  redirect(`/apply/submitted?ref=${encodeURIComponent(ref)}`);
}

function labelOf(k: string) {
  return (
    {
      fullName: "Full name", email: "Email", phone: "Phone", idNumber: "ID / passport number", dateOfBirth: "Date of birth",
      residence: "Residence", occupation: "Occupation", heardFrom: "How you heard of us", terms: "Terms", privacy: "Privacy",
      packageSlug: "Package", type: "Membership type",
    }[k] ?? k
  );
}
