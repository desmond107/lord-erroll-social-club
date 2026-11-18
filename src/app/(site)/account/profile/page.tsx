import type { Metadata } from "next";
import Link from "next/link";
import { requireAccount } from "@/lib/member-auth";
import { decryptOr, maskEmail, maskPhone } from "@/lib/crypto";
import { ActionForm } from "@/components/ActionForm";
import { updateProfile } from "../actions";
import { AccountNav } from "../AccountNav";

export const metadata: Metadata = { title: "Profile", robots: { index: false } };

export default async function ProfilePage() {
  const a = await requireAccount();
  return (
    <section className="bg-vignette min-h-screen pt-[72px]">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <AccountNav name={a.fullName} />
        <h1 className="display mt-10 text-[2.4rem]">Profile</h1>
        <div className="on-paper gold-frame mt-8 p-6 sm:p-8">
          <dl className="grid gap-5 sm:grid-cols-3">
            <div><dt className="label">Name</dt><dd>{a.fullName}</dd></div>
            <div><dt className="label">Email</dt><dd>{maskEmail(decryptOr(a.emailEnc))}</dd></div>
            <div><dt className="label">Mobile</dt><dd>{maskPhone(decryptOr(a.phoneEnc))}</dd></div>
          </dl>
          <p className="hint mt-4">To change your name, email or phone, please make a <Link href="/account/privacy" className="link-gold font-semibold">correction request</Link>. We verify changes to protect your account.</p>

          <ActionForm action={updateProfile} submit="Save changes" className="mt-8 border-t border-line-light pt-8">
            <label className="flex items-start gap-3 text-sm text-ink-soft">
              <input type="checkbox" name="marketing" defaultChecked={a.marketingOk} className="mt-1 h-4 w-4 accent-[var(--emerald)]" />
              <span>Send me news of club events and offers.</span>
            </label>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="field">
                <label htmlFor="password">{a.passwordHash ? "New password" : "Set a password (optional)"}</label>
                <input id="password" name="password" type="password" autoComplete="new-password" className="input" minLength={10} />
              </div>
              <div className="field">
                <label htmlFor="password2">Confirm password</label>
                <input id="password2" name="password2" type="password" autoComplete="new-password" className="input" />
              </div>
            </div>
            <p className="hint">Leave blank to keep signing in with one-time codes. Changing your password signs you out on all devices.</p>
          </ActionForm>
        </div>
      </div>
    </section>
  );
}
