"use client";

import { useActionState, useState } from "react";
import { loginAction, type LoginState } from "./actions";

export function LoginClient({ next, turnstile }: { next: string; turnstile: React.ReactNode }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, { step: "start" });
  const [mode, setMode] = useState<"code" | "password">("code");

  if (state.step === "code")
    return (
      <form action={action} className="space-y-5">
        <input type="hidden" name="intent" value="verify-code" />
        <input type="hidden" name="identifier" value={state.identifier} />
        <input type="hidden" name="next" value={state.next} />
        <p className="text-ink-soft">If an account exists for <strong className="text-ink">{state.sentTo}</strong>, we&apos;ve sent a 6-digit code. It expires in 10 minutes.</p>
        <div className="field">
          <label htmlFor="code">Sign-in code</label>
          <input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required autoFocus className="input text-center font-mono text-2xl tracking-[0.5em]" />
        </div>
        {state.error && <p role="alert" className="err">{state.error}</p>}
        <button className="btn btn-green w-full" disabled={pending}>{pending ? "Checking…" : "Sign in"}</button>
        <a href={`/account/login?next=${encodeURIComponent(state.next)}`} className="block text-center text-sm text-ink-soft underline">Use a different email or phone</a>
      </form>
    );

  return (
    <div>
      <div className="mb-6 grid grid-cols-2 border border-line-light" role="tablist">
        {(["code", "password"] as const).map((m) => (
          <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)} className={`py-2.5 text-xs font-bold tracking-[0.15em] uppercase ${mode === m ? "bg-emerald text-gold-light" : "text-ink-soft"}`}>
            {m === "code" ? "One-time code" : "Password"}
          </button>
        ))}
      </div>
      <form action={action} className="space-y-5">
        <input type="hidden" name="intent" value={mode === "code" ? "send-code" : "password"} />
        <input type="hidden" name="next" value={next} />
        <div className="field">
          <label htmlFor="identifier">Email or mobile number</label>
          <input id="identifier" name="identifier" required autoComplete="username" className="input" placeholder="you@example.com or 0712 345 678" />
        </div>
        {mode === "password" && (
          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" name="password" type="password" required autoComplete="current-password" className="input" />
            <p className="hint">No password yet? Sign in with a code, then set one under Profile.</p>
          </div>
        )}
        {mode === "code" && turnstile}
        {state.error && <p role="alert" className="err">{state.error}</p>}
        <button className="btn btn-green w-full" disabled={pending}>{pending ? "Please wait…" : mode === "code" ? "Send me a code" : "Sign in"}</button>
      </form>
    </div>
  );
}
