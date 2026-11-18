"use client";

import { useActionState } from "react";
import { lookupAction, type LookupState } from "./actions";
import { StatusBadge } from "@/components/StatusBadge";
import { Fleur } from "@/components/brand";

export function LookupClient({ turnstile, initialNumber }: { turnstile: React.ReactNode; initialNumber?: string }) {
  const [state, action, pending] = useActionState<LookupState, FormData>(lookupAction, { step: "idle" });
  const query = "query" in state ? state.query : initialNumber ?? "";

  return (
    <div className="space-y-8">
      <form action={action} className="gold-frame bg-charcoal-2/70 p-6 sm:p-8">
        <input type="hidden" name="intent" value="search" />
        <label htmlFor="number" className="eyebrow block">Membership number</label>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <input
            id="number"
            name="number"
            required
            defaultValue={query}
            placeholder="LE-2026-000123"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            className="min-h-[3.2rem] flex-1 border border-line-dark bg-charcoal px-4 font-mono text-lg tracking-[0.15em] text-on-dark uppercase placeholder:text-on-dark-soft/50 focus:border-gold focus:outline-none"
          />
          <button className="btn btn-gold" disabled={pending}>{pending ? "Checking…" : "Check"}</button>
        </div>
        <div className="mt-2">{turnstile}</div>
        {state.step === "idle" && state.error && <p role="alert" className="mt-3 text-sm text-[#f0a0a3]">{state.error}</p>}
      </form>

      {state.step !== "idle" && <Result state={state} action={action} pending={pending} />}
    </div>
  );
}

function Result({ state, action, pending }: { state: Exclude<LookupState, { step: "idle" }>; action: (fd: FormData) => void; pending: boolean }) {
  const r = state.result;
  if (r.kind === "none")
    return (
      <div role="status" className="border border-line-dark p-6 text-center text-on-dark/80">
        No membership was found with that number. Please check it and try again.
      </div>
    );

  if (r.kind === "junior")
    return (
      <div role="status" className="gold-frame bg-emerald-deep p-8 text-center">
        <div className="eyebrow">Junior Membership</div>
        <p className="display mt-4 text-[2rem]">{r.statusLabel === "Active" ? "Valid Junior Membership" : "Junior Membership"}</p>
        <div className="mt-4"><StatusBadge status={r.status} label={r.statusLabel} /></div>
        <p className="mt-5 text-sm text-on-dark-soft">To protect young members, no further details are shown publicly.</p>
        <Verify state={state} action={action} pending={pending} />
      </div>
    );

  return (
    <div role="status" className="gold-frame bg-emerald-deep p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="eyebrow">{r.family ? "Family membership" : "Membership"}</div>
          <div className="mt-2 font-mono text-lg tracking-[0.15em] text-gold-light">{r.number}</div>
        </div>
        <StatusBadge status={r.status} label={r.statusLabel} />
      </div>
      <dl className="mt-6 grid gap-x-8 gap-y-4 sm:grid-cols-2">
        <div>
          <dt className="text-[0.65rem] tracking-[0.2em] text-on-dark-soft uppercase">Package</dt>
          <dd className="display mt-1 text-[1.6rem]">{r.packageName}</dd>
        </div>
        <div>
          <dt className="text-[0.65rem] tracking-[0.2em] text-on-dark-soft uppercase">Expiry date</dt>
          <dd className="display mt-1 text-[1.6rem]">{r.expires}</dd>
        </div>
      </dl>
      <ul className="mt-6 divide-y divide-line-dark border-y border-line-dark">
        {r.holders.map((h) => (
          <li key={h.cardNumber} className="flex flex-wrap items-center justify-between gap-2 py-3">
            <span className="flex items-center gap-2"><Fleur className="h-3 w-3 text-gold" /> {h.label}</span>
            <span className="font-mono text-sm text-on-dark-soft">{h.cardNumber}{r.family ? ` · ${h.relationship}` : ""}</span>
          </li>
        ))}
      </ul>
      <Verify state={state} action={action} pending={pending} />
    </div>
  );
}

function Verify({ state, action, pending }: { state: Exclude<LookupState, { step: "idle" }>; action: (fd: FormData) => void; pending: boolean }) {
  if (state.step === "verified") {
    const d = state.detail;
    return (
      <div className="mt-8 border-t border-line-dark pt-8 text-left">
        <div className="eyebrow">Verified details</div>
        <dl className="mt-4 grid gap-4 sm:grid-cols-3">
          <div><dt className="text-[0.65rem] tracking-[0.2em] text-on-dark-soft uppercase">Account holder</dt><dd className="mt-1">{d.holderName}</dd></div>
          <div><dt className="text-[0.65rem] tracking-[0.2em] text-on-dark-soft uppercase">Member since</dt><dd className="mt-1">{d.memberSince}</dd></div>
          <div><dt className="text-[0.65rem] tracking-[0.2em] text-on-dark-soft uppercase">Renewal date</dt><dd className="mt-1">{d.renewalDate}</dd></div>
        </dl>
        <h3 className="display mt-8 text-[1.4rem]">Benefits</h3>
        <ul className="mt-3 space-y-1.5 text-sm text-on-dark/85">{d.benefits.map((b) => <li key={b} className="flex gap-2"><Fleur className="mt-1 h-3 w-3 flex-none text-gold" />{b}</li>)}</ul>
        <h3 className="display mt-8 text-[1.4rem]">Payment history</h3>
        {d.payments.length === 0 ? (
          <p className="mt-2 text-sm text-on-dark-soft">No payments yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-[0.65rem] tracking-[0.15em] text-on-dark-soft uppercase"><th className="py-2 pr-4">Date</th><th className="pr-4">Receipt</th><th className="pr-4">For</th><th className="pr-4">Method</th><th className="text-right">Amount</th></tr></thead>
              <tbody>{d.payments.map((p) => <tr key={p.receipt} className="border-t border-line-dark"><td className="py-2 pr-4 whitespace-nowrap">{p.date}</td><td className="pr-4 font-mono text-xs">{p.receipt}</td><td className="pr-4">{p.purpose}</td><td className="pr-4">{p.method}</td><td className="text-right whitespace-nowrap">{p.amount}</td></tr>)}</tbody>
            </table>
          </div>
        )}
        <p className="mt-6 text-xs text-on-dark-soft">To renew or manage your membership, sign in to your member account.</p>
      </div>
    );
  }

  if (state.step === "otp")
    return (
      <form action={action} className="mt-8 border-t border-line-dark pt-8 text-left">
        <input type="hidden" name="intent" value="verify-otp" />
        <input type="hidden" name="number" value={state.query} />
        <input type="hidden" name="sentTo" value={state.sentTo} />
        <label htmlFor="code" className="text-sm text-on-dark/85">Enter the 6-digit code sent to <strong>{state.sentTo}</strong></label>
        <div className="mt-3 flex gap-3">
          <input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required className="w-40 border border-line-dark bg-charcoal px-4 py-3 text-center font-mono text-xl tracking-[0.4em] text-on-dark focus:border-gold focus:outline-none" />
          <button className="btn btn-gold" disabled={pending}>Verify</button>
        </div>
        {state.error && <p role="alert" className="mt-3 text-sm text-[#f0a0a3]">{state.error}</p>}
      </form>
    );

  return (
    <form action={action} className="mt-8 border-t border-line-dark pt-6 text-left">
      <input type="hidden" name="intent" value="send-otp" />
      <input type="hidden" name="number" value={state.query} />
      <p className="text-sm text-on-dark/80">Is this your membership? See payment history, renewal date and benefits with a one-time code sent to the registered contact.</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button name="channel" value="sms" className="btn btn-outline btn-sm" disabled={pending}>Send code by SMS</button>
        <button name="channel" value="email" className="btn btn-outline btn-sm" disabled={pending}>Send code by email</button>
      </div>
    </form>
  );
}
