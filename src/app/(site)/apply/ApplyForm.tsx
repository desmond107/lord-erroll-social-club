"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { submitApplication, type ApplyState } from "./actions";
import { GUARDIAN_CONSENT, PHOTO_CONSENT } from "@/lib/consent";
import { HEARD_FROM } from "@/lib/site";
import { kes } from "@/lib/format";

type Pkg = { slug: string; name: string; kind: "MAIN" | "JUNIOR" | "FAMILY"; annualFeeKes: number; maxLinked: number };
type Type = "INDIVIDUAL" | "FAMILY" | "JUNIOR";

const today = () => new Date().toISOString().slice(0, 10);

function Field({ label, name, hint, children, className = "" }: { label: string; name?: string; hint?: string; children?: React.ReactNode; className?: string }) {
  return (
    <div className={`field ${className}`}>
      <label htmlFor={name}>{label}</label>
      {children}
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}

function PhotoInput({ name, label, hint }: { name: string; label: string; hint?: string }) {
  const [preview, setPreview] = useState<string | null>(null);
  return (
    <Field label={label} name={name} hint={hint}>
      <div className="flex items-center gap-4">
        <div className="grid h-20 w-20 flex-none place-items-center overflow-hidden border border-line-light bg-cream/60 text-[0.6rem] text-ink-soft">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {preview ? <img src={preview} alt="Selected photo preview" className="h-full w-full object-cover" /> : "No photo"}
        </div>
        <input
          id={name}
          name={name}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="block w-full text-sm file:mr-3 file:border file:border-gold-ink file:bg-transparent file:px-3 file:py-2 file:text-xs file:font-semibold file:tracking-wider file:text-emerald file:uppercase"
          onChange={(e) => {
            const f = e.target.files?.[0];
            setPreview(f ? URL.createObjectURL(f) : null);
          }}
        />
      </div>
    </Field>
  );
}

export function ApplyForm({ packages, initialPackage, turnstile, juniorRange }: { packages: Pkg[]; initialPackage?: string; turnstile: React.ReactNode; juniorRange: [number, number] }) {
  const [state, action, pending] = useActionState<ApplyState, FormData>(submitApplication, null);
  const f = state?.fields ?? {};
  const initial = packages.find((p) => p.slug === (f.packageSlug || initialPackage));
  const [type, setType] = useState<Type>((f.type as Type) || (initial?.kind === "JUNIOR" ? "JUNIOR" : initial?.kind === "FAMILY" ? "FAMILY" : "INDIVIDUAL"));
  const choices = useMemo(() => packages.filter((p) => (type === "INDIVIDUAL" ? p.kind === "MAIN" : p.kind === type)), [packages, type]);
  const [pkg, setPkg] = useState<string>(initial && choices.some((c) => c.slug === initial.slug) ? initial.slug : "");
  const selected = choices.find((c) => c.slug === pkg) ?? (choices.length === 1 ? choices[0] : undefined);
  const [deps, setDeps] = useState<number[]>(() => Object.keys(f).filter((k) => /^dep\d+_fullName$/.test(k)).map((k) => Number(k.slice(3, -9))).sort());
  const maxLinked = selected?.maxLinked ?? 0;
  const guardian = type === "JUNIOR";

  return (
    <form action={action} className="on-paper space-y-10" noValidate={false}>
      <input type="hidden" name="type" value={type} />
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />

      {/* 1. Membership type */}
      <fieldset>
        <legend className="display mb-5 text-[1.7rem] text-emerald">1 · Membership type</legend>
        <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Membership type">
          {(
            [
              ["INDIVIDUAL", "Individual", "Emerald to Platinum"],
              ["FAMILY", "Family / Joint", "You plus linked family members"],
              ["JUNIOR", "Junior (under 18)", "Applied for by a parent or guardian"],
            ] as const
          ).map(([v, t, d]) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={type === v}
              onClick={() => {
                setType(v);
                setPkg("");
              }}
              className={`border p-4 text-left transition-colors duration-300 ${type === v ? "border-emerald bg-emerald text-gold-light" : "border-line-light bg-white hover:border-gold-ink"}`}
            >
              <div className="font-serif text-xl">{t}</div>
              <div className={`mt-1 text-xs ${type === v ? "text-on-dark/80" : "text-ink-soft"}`}>{d}</div>
            </button>
          ))}
        </div>

        <div className="mt-6">
          <Field label="Package" name="packageSlug">
            <select id="packageSlug" name="packageSlug" required className="input" value={selected?.slug ?? pkg} onChange={(e) => setPkg(e.target.value)}>
              {choices.length > 1 && <option value="">Choose a package…</option>}
              {choices.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name} · {kes(c.annualFeeKes)} a year
                </option>
              ))}
            </select>
          </Field>
          {type === "INDIVIDUAL" && <p className="hint mt-2"><Link href="/membership" className="link-gold" target="_blank">Compare the tiers</Link> (opens in a new tab)</p>}
        </div>
      </fieldset>

      {/* 2. Applicant / guardian */}
      <fieldset>
        <legend className="display mb-2 text-[1.7rem] text-emerald">2 · {guardian ? "Parent or guardian" : type === "FAMILY" ? "Primary member" : "Your details"}</legend>
        {guardian && <p className="mb-5 text-sm text-ink-soft">A Junior application must be made by a parent or legal guardian aged 18 or over. You will manage the membership; the child does not get a separate login.</p>}
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <Field label="Full name" name="fullName" className="sm:col-span-2">
            <input id="fullName" name="fullName" required autoComplete="name" className="input" defaultValue={f.fullName} maxLength={120} />
          </Field>
          <Field label="Mobile phone" name="phone" hint="For M-Pesa, SMS updates and sign-in codes">
            <input id="phone" name="phone" type="tel" required autoComplete="tel" inputMode="tel" placeholder="0712 345 678" className="input" defaultValue={f.phone} />
          </Field>
          <Field label="Email" name="email">
            <input id="email" name="email" type="email" required autoComplete="email" className="input" defaultValue={f.email} />
          </Field>
          <Field label="National ID or passport number" name="idNumber" hint="Stored encrypted; used to verify identity">
            <input id="idNumber" name="idNumber" required autoComplete="off" className="input" />
          </Field>
          <Field label="Date of birth" name="dateOfBirth" hint="You must be 18 or over">
            <input id="dateOfBirth" name="dateOfBirth" type="date" required max={today()} className="input" defaultValue={f.dateOfBirth} />
          </Field>
          <Field label="Area of residence" name="residence">
            <input id="residence" name="residence" required className="input" placeholder="e.g. Runda, Nairobi" defaultValue={f.residence} />
          </Field>
          <Field label="Occupation" name="occupation">
            <input id="occupation" name="occupation" required className="input" defaultValue={f.occupation} />
          </Field>
          {guardian && (
            <Field label="Relationship to the child" name="relationship">
              <select id="relationship" name="relationship" required className="input" defaultValue={f.relationship ?? ""}>
                <option value="">Choose…</option>
                <option>Mother</option>
                <option>Father</option>
                <option>Legal guardian</option>
              </select>
            </Field>
          )}
          <Field label="How did you hear of the club?" name="heardFrom">
            <select id="heardFrom" name="heardFrom" required className="input" defaultValue={f.heardFrom ?? ""}>
              <option value="">Choose…</option>
              {HEARD_FROM.map((h) => <option key={h}>{h}</option>)}
            </select>
          </Field>
          {!guardian && (
            <div className="sm:col-span-2">
              <PhotoInput name="photo" label="Photo for your card (optional)" hint="JPEG, PNG or WebP, up to 5 MB. A clear head-and-shoulders photo works best." />
            </div>
          )}
        </div>
      </fieldset>

      {/* 3a. Family members */}
      {type === "FAMILY" && (
        <fieldset>
          <legend className="display mb-2 text-[1.7rem] text-emerald">3 · Linked family members</legend>
          <p className="mb-5 text-sm text-ink-soft">Add up to {maxLinked || "the allowed number of"} family members. Each receives their own card, numbered from yours (e.g. LE-2026-000123-A).</p>
          <div className="space-y-5">
            {deps.map((id, i) => (
              <div key={id} className="gold-frame relative bg-white p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div className="font-serif text-lg text-emerald">Member {String.fromCharCode(65 + i)}</div>
                  <button type="button" className="text-xs font-semibold tracking-wider text-bad uppercase" onClick={() => setDeps((d) => d.filter((x) => x !== id))}>Remove</button>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Full name" name={`dep${id}_fullName`} className="sm:col-span-3">
                    <input id={`dep${id}_fullName`} name={`dep${id}_fullName`} required className="input" defaultValue={f[`dep${id}_fullName`]} />
                  </Field>
                  <Field label="Relationship" name={`dep${id}_relationship`}>
                    <select id={`dep${id}_relationship`} name={`dep${id}_relationship`} required className="input" defaultValue={f[`dep${id}_relationship`] ?? ""}>
                      <option value="">Choose…</option>
                      <option>Spouse</option>
                      <option>Partner</option>
                      <option>Child</option>
                    </select>
                  </Field>
                  <Field label="Date of birth" name={`dep${id}_dateOfBirth`}>
                    <input id={`dep${id}_dateOfBirth`} name={`dep${id}_dateOfBirth`} type="date" required max={today()} className="input" defaultValue={f[`dep${id}_dateOfBirth`]} />
                  </Field>
                  <div className="sm:col-span-3">
                    <PhotoInput name={`dep${id}_photo`} label="Photo (optional)" />
                  </div>
                </div>
              </div>
            ))}
          </div>
          {deps.length < (maxLinked || 4) && (
            <button type="button" className="btn btn-outline btn-sm mt-5" onClick={() => setDeps((d) => [...d, d.length ? Math.max(...d) + 1 : 0])}>
              + Add a family member
            </button>
          )}
        </fieldset>
      )}

      {/* 3b. Junior child */}
      {guardian && (
        <fieldset>
          <legend className="display mb-2 text-[1.7rem] text-emerald">3 · The Junior member</legend>
          <p className="mb-5 text-sm text-ink-soft">
            Junior membership is for ages {juniorRange[0]} to {juniorRange[1]}. We collect only what is needed. The card shows the first name only.
          </p>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Child's full name" name="child_fullName">
              <input id="child_fullName" name="child_fullName" required className="input" defaultValue={f.child_fullName} />
            </Field>
            <Field label="Child's date of birth" name="child_dateOfBirth">
              <input id="child_dateOfBirth" name="child_dateOfBirth" type="date" required max={today()} className="input" defaultValue={f.child_dateOfBirth} />
            </Field>
            <Field label="Birth certificate or ID (required)" name="child_dobProof" hint="Image or PDF, up to 8 MB. Stored encrypted; seen only by the club's senior administrator." className="sm:col-span-2">
              <input id="child_dobProof" name="child_dobProof" type="file" required accept="image/jpeg,image/png,image/webp,application/pdf" className="block w-full text-sm file:mr-3 file:border file:border-gold-ink file:bg-transparent file:px-3 file:py-2 file:text-xs file:font-semibold file:tracking-wider file:text-emerald file:uppercase" />
            </Field>
            <div className="sm:col-span-2">
              <PhotoInput name="child_photo" label="Child's photo (optional)" hint="Not shown by default. Only with your consent below." />
              <label className="mt-3 flex items-start gap-3 text-sm text-ink-soft">
                <input type="checkbox" name="photoConsent" className="mt-1 h-4 w-4 accent-[var(--emerald)]" defaultChecked={f.photoConsent === "on"} />
                <span>{PHOTO_CONSENT}</span>
              </label>
            </div>
          </div>
        </fieldset>
      )}

      {/* 4. Declarations */}
      <fieldset>
        <legend className="display mb-5 text-[1.7rem] text-emerald">{type === "INDIVIDUAL" ? "3" : "4"} · Declarations</legend>
        <div className="space-y-4 text-sm text-ink-soft">
          {guardian && (
            <label className="flex items-start gap-3 border border-gold-ink/40 bg-white p-4">
              <input type="checkbox" name="guardianConsent" required className="mt-1 h-4 w-4 flex-none accent-[var(--emerald)]" defaultChecked={f.guardianConsent === "on"} />
              <span><strong className="text-ink">Guardian consent.</strong> {GUARDIAN_CONSENT}</span>
            </label>
          )}
          <label className="flex items-start gap-3">
            <input type="checkbox" name="terms" required className="mt-1 h-4 w-4 flex-none accent-[var(--emerald)]" defaultChecked={f.terms === "on"} />
            <span>I have read and accept the <Link href="/terms" target="_blank" className="link-gold font-semibold">Terms and Conditions</Link>{guardian ? " on the child's behalf" : ""}.</span>
          </label>
          <label className="flex items-start gap-3">
            <input type="checkbox" name="privacy" required className="mt-1 h-4 w-4 flex-none accent-[var(--emerald)]" defaultChecked={f.privacy === "on"} />
            <span>I consent to the processing of {guardian ? "my and my child's" : "my"} personal data as described in the <Link href="/privacy" target="_blank" className="link-gold font-semibold">Privacy Policy</Link> (Kenya Data Protection Act, 2019).</span>
          </label>
          <label className="flex items-start gap-3">
            <input type="checkbox" name="marketing" className="mt-1 h-4 w-4 flex-none accent-[var(--emerald)]" defaultChecked={f.marketing === "on"} />
            <span>Send me news of club events and offers (optional{guardian ? "; never sent to the child" : ""}).</span>
          </label>
        </div>
      </fieldset>

      {turnstile}

      {state?.error && (
        <div role="alert" className="border-l-4 border-bad bg-white px-4 py-3 text-sm text-bad">
          {state.error}
          <div className="mt-1 text-xs text-ink-soft">For your security, please re-enter your ID number and re-select any files.</div>
        </div>
      )}

      <div className="flex flex-col items-start gap-4 border-t border-line-light pt-8 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-ink-soft">
          {selected ? <>Annual subscription: <strong className="text-ink">{kes(selected.annualFeeKes)}</strong>, payable only after approval.</> : "No payment is taken until your application is approved."}
        </p>
        <button type="submit" disabled={pending} className="btn btn-green w-full sm:w-auto">
          {pending ? "Submitting…" : "Submit application"}
        </button>
      </div>
    </form>
  );
}
