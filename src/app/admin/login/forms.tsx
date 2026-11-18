"use client";

import { useActionState } from "react";
import Image from "next/image";
import { adminLogin, adminTwoFactor, type AdminLoginState } from "./actions";

export function AdminAuthShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="bg-vignette flex min-h-screen items-center justify-center px-4 py-12">
      <div className="on-paper gold-frame w-full max-w-sm p-8">
        <div className="text-center">
          <Image src="/brand/crest-240.png" alt="" width={48} height={54} className="mx-auto" priority />
          <div className="blackletter mt-3 text-[1.6rem] text-emerald">The Lord Erroll</div>
          <div className="text-[0.6rem] font-semibold tracking-[0.4em] text-gold-ink uppercase">Club administration</div>
          <h1 className="mt-6 font-serif text-2xl">{title}</h1>
        </div>
        <div className="mt-6">{children}</div>
      </div>
    </main>
  );
}

export function AdminLoginForm() {
  const [state, action, pending] = useActionState<AdminLoginState, FormData>(adminLogin, null);
  return (
    <form action={action} className="space-y-4">
      <div className="field"><label htmlFor="email">Email</label><input id="email" name="email" type="email" required autoComplete="username" className="input" /></div>
      <div className="field"><label htmlFor="password">Password</label><input id="password" name="password" type="password" required autoComplete="current-password" className="input" /></div>
      {state?.error && <p role="alert" className="err">{state.error}</p>}
      <button className="btn btn-green w-full" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
    </form>
  );
}

export function TwoFactorForm() {
  const [state, action, pending] = useActionState<AdminLoginState, FormData>(adminTwoFactor, null);
  return (
    <form action={action} className="space-y-4">
      <p className="text-center text-sm text-ink-soft">Enter the 6-digit code from your authenticator app.</p>
      <input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required autoFocus aria-label="Authentication code" className="input text-center font-mono text-2xl tracking-[0.5em]" />
      {state?.error && <p role="alert" className="err">{state.error}</p>}
      <button className="btn btn-green w-full" disabled={pending}>{pending ? "Checking…" : "Verify"}</button>
    </form>
  );
}
