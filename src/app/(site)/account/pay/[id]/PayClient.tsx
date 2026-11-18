"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { startPayment, type PayState } from "../actions";
import { CLUB } from "@/lib/site";

type Opt = { id: string; name: string; amount: number; amountLabel: string; purpose: string; note: string | null; current: boolean };

export function PayClient(props: {
  membershipId: string; options: Opt[]; defaultId: string; phone: string; mpesa: boolean; simulated: boolean; card: boolean;
  manual: { paybill: string; bank: string };
}) {
  const [state, action, pending] = useActionState<PayState, FormData>(startPayment, null);
  const [pkg, setPkg] = useState(props.defaultId);
  const [method, setMethod] = useState<"MPESA" | "CARD">(props.mpesa ? "MPESA" : "CARD");
  const sel = props.options.find((o) => o.id === pkg)!;

  if (state?.paymentId) return <Waiting paymentId={state.paymentId} simulated={!!state.simulated} />;

  return (
    <form action={action} className="mt-10 space-y-8">
      <input type="hidden" name="membershipId" value={props.membershipId} />
      <input type="hidden" name="packageId" value={pkg} />
      <input type="hidden" name="method" value={method} />

      <fieldset>
        <legend className="eyebrow mb-4">Package</legend>
        <div className="space-y-3">
          {props.options.map((o) => (
            <label key={o.id} className={`flex cursor-pointer items-center justify-between gap-4 border p-4 transition-colors ${pkg === o.id ? "border-gold bg-gold/10" : "border-line-dark hover:border-gold/50"}`}>
              <span className="flex items-center gap-3">
                <input type="radio" name="pkg" checked={pkg === o.id} onChange={() => setPkg(o.id)} className="accent-[var(--gold)]" />
                <span>
                  <span className="font-serif text-xl">{o.name}</span>
                  {o.current && <span className="ml-2 text-xs text-on-dark-soft">(current)</span>}
                  <span className="block text-xs text-on-dark-soft">{{ NEW: "Annual subscription", RENEWAL: "12-month renewal", UPGRADE: "Upgrade" }[o.purpose]}{o.note ? ` · ${o.note}` : ""}</span>
                </span>
              </span>
              <span className="display text-xl whitespace-nowrap text-gold-light">{o.amountLabel}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="eyebrow mb-4">Payment method</legend>
        <div className="grid grid-cols-2 gap-3">
          <button type="button" disabled={!props.mpesa} onClick={() => setMethod("MPESA")} className={`border p-4 text-left disabled:opacity-40 ${method === "MPESA" ? "border-gold bg-gold/10" : "border-line-dark"}`}>
            <div className="font-semibold">M-Pesa</div>
            <div className="text-xs text-on-dark-soft">Prompt sent to your phone</div>
          </button>
          <button type="button" disabled={!props.card} onClick={() => setMethod("CARD")} className={`border p-4 text-left disabled:opacity-40 ${method === "CARD" ? "border-gold bg-gold/10" : "border-line-dark"}`}>
            <div className="font-semibold">Card</div>
            <div className="text-xs text-on-dark-soft">{props.card ? "Visa / Mastercard via Paystack" : "Not yet available"}</div>
          </button>
        </div>
        {method === "MPESA" && (
          <div className="mt-5">
            <label htmlFor="phone" className="text-[0.7rem] font-semibold tracking-[0.15em] text-on-dark-soft uppercase">M-Pesa number</label>
            <input id="phone" name="phone" type="tel" inputMode="tel" required defaultValue={props.phone ? `0${props.phone.slice(3)}` : ""} className="mt-2 w-full border border-line-dark bg-charcoal px-4 py-3 text-lg text-on-dark focus:border-gold focus:outline-none" />
          </div>
        )}
      </fieldset>

      {state?.error && <p role="alert" className="border-l-4 border-crimson-bright bg-crimson/20 px-4 py-3 text-sm">{state.error}</p>}

      <button className="btn btn-gold w-full" disabled={pending}>{pending ? "Starting payment…" : `Pay ${sel.amountLabel}`}</button>

      <div className="border-t border-line-dark pt-6 text-sm text-on-dark-soft">
        <p>Prefer to pay by cash or bank transfer? Call {CLUB.phone}; our accounts team will confirm it for you.</p>
        {props.manual.paybill && <p className="mt-2">Paybill: <strong className="text-on-dark">{props.manual.paybill}</strong>, account: your membership number.</p>}
        {props.manual.bank && <p className="mt-2 whitespace-pre-line">{props.manual.bank}</p>}
        {props.simulated && <p className="mt-3 text-gold-light">Development mode: M-Pesa is simulated (no real money moves).</p>}
      </div>
    </form>
  );
}

function Waiting({ paymentId, simulated }: { paymentId: string; simulated: boolean }) {
  const [status, setStatus] = useState("PENDING");
  const [reason, setReason] = useState<string | null>(null);
  useEffect(() => {
    let stop = false;
    const started = Date.now();
    const tick = async () => {
      if (stop) return;
      try {
        const r = await fetch(`/api/payments/${paymentId}/status`, { cache: "no-store" });
        if (r.ok) {
          const j = (await r.json()) as { status: string; reason?: string };
          setStatus(j.status);
          setReason(j.reason ?? null);
          if (j.status !== "PENDING") return;
        }
      } catch {
        /* keep polling */
      }
      if (Date.now() - started < 3 * 60 * 1000) setTimeout(tick, 3000);
      else setStatus("TIMEOUT");
    };
    tick();
    return () => {
      stop = true;
    };
  }, [paymentId]);

  const simulate = async (ok: boolean) => {
    await fetch("/api/dev/simulate-mpesa", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paymentId, ok }) });
  };

  return (
    <div className="mt-10 border border-line-dark p-8 text-center" role="status" aria-live="polite">
      {status === "PENDING" && (
        <>
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-gold/30 border-t-gold" aria-hidden />
          <h2 className="display mt-6 text-[1.8rem]">Check your phone</h2>
          <p className="mt-2 text-on-dark/80">Enter your M-Pesa PIN to complete the payment. This page updates automatically.</p>
          {simulated && (
            <div className="mt-6 border border-dashed border-gold/50 p-4 text-sm">
              <p className="text-gold-light">Development simulator</p>
              <div className="mt-3 flex justify-center gap-3">
                <button type="button" className="btn btn-gold btn-sm" onClick={() => simulate(true)}>Approve payment</button>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => simulate(false)}>Decline</button>
              </div>
            </div>
          )}
        </>
      )}
      {status === "PAID" && (
        <>
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-bright text-2xl text-white" aria-hidden>✓</div>
          <h2 className="display mt-6 text-[2rem]">Payment received</h2>
          <p className="mt-2 text-on-dark/80">Thank you. Your receipt is on its way by email, and your membership card is live.</p>
          <Link href="/account" className="btn btn-gold mt-8">View my card</Link>
        </>
      )}
      {(status === "FAILED" || status === "CANCELLED") && (
        <>
          <h2 className="display text-[1.8rem]">Payment not completed</h2>
          <p className="mt-2 text-on-dark/80">{reason || "The payment was cancelled or declined."}</p>
          <button type="button" className="btn btn-outline mt-6" onClick={() => location.reload()}>Try again</button>
        </>
      )}
      {status === "TIMEOUT" && (
        <>
          <h2 className="display text-[1.8rem]">Still waiting for M-Pesa</h2>
          <p className="mt-2 text-on-dark/80">If you completed the payment, it will appear in your account shortly and we will email your receipt.</p>
          <Link href="/account" className="btn btn-outline mt-6">Back to my account</Link>
        </>
      )}
    </div>
  );
}
