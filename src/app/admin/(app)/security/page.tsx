import { redirect } from "next/navigation";
import { getAdmin, twoFactorRequired } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { newSecret, openSecret, sealSecret, totpQrDataUrl } from "@/lib/totp";
import { PageTitle, Card } from "@/components/admin/ui";
import { ActionForm } from "@/components/ActionForm";
import { changePassword, confirmTotp } from "./actions";

export default async function SecurityPage({ searchParams }: { searchParams: Promise<{ enrol?: string }> }) {
  // Every staff role can reach this page, including before 2FA is set up.
  const u = await getAdmin();
  if (!u) redirect("/admin/login");
  const { enrol } = await searchParams;
  let qr: string | null = null;
  let secret: string | null = null;
  if (!u.totpEnabled) {
    // The pending secret is stored sealed but not enabled until a code confirms it.
    const row = await prisma.adminUser.findUniqueOrThrow({ where: { id: u.id } });
    secret = row.totpSecret ? openSecret(row.totpSecret) : newSecret();
    if (!row.totpSecret) await prisma.adminUser.update({ where: { id: u.id }, data: { totpSecret: sealSecret(secret) } });
    qr = await totpQrDataUrl(u.email, secret);
  }
  return (
    <div className="max-w-3xl">
      <PageTitle title="Account security" sub={u.email} />
      {enrol && !u.totpEnabled && twoFactorRequired() && (
        <div className="mb-6 border-l-4 border-warn bg-white px-4 py-3 text-sm">Two-factor authentication is required for all staff accounts. Please set it up to continue.</div>
      )}
      <div className="grid gap-6">
        <Card title="Two-factor authentication">
          {u.totpEnabled ? (
            <p className="text-sm text-ok">On. You&apos;ll be asked for a code from your authenticator app each time you sign in.</p>
          ) : (
            <div className="grid gap-6 sm:grid-cols-[220px_1fr]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {qr && <img src={qr} alt="QR code to add this account to an authenticator app" width={220} height={220} className="border border-line-light" />}
              <div className="text-sm text-ink-soft">
                <ol className="list-decimal space-y-2 pl-5">
                  <li>Open Google Authenticator, Microsoft Authenticator or 1Password.</li>
                  <li>Scan the code, or enter this key: <code className="mt-1 block font-mono text-xs break-all text-ink">{secret}</code></li>
                  <li>Enter the 6-digit code it shows.</li>
                </ol>
                <ActionForm action={confirmTotp} submit="Turn on two-factor" className="mt-4">
                  <input name="code" inputMode="numeric" pattern="\d{6}" maxLength={6} required aria-label="Code" className="input max-w-[12rem] font-mono tracking-[0.3em]" />
                </ActionForm>
              </div>
            </div>
          )}
        </Card>
        <Card title="Change password">
          <ActionForm action={changePassword} submit="Change password">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="field"><label htmlFor="current">Current</label><input id="current" name="current" type="password" required autoComplete="current-password" className="input" /></div>
              <div className="field"><label htmlFor="password">New</label><input id="password" name="password" type="password" required minLength={12} autoComplete="new-password" className="input" /></div>
              <div className="field"><label htmlFor="password2">Confirm</label><input id="password2" name="password2" type="password" required autoComplete="new-password" className="input" /></div>
            </div>
            <p className="hint">At least 12 characters, with letters and numbers.</p>
          </ActionForm>
        </Card>
      </div>
    </div>
  );
}
