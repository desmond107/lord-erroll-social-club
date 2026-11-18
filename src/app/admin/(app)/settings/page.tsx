import { requireAdmin } from "@/lib/admin-auth";
import { getSettings } from "@/lib/settings";
import { mpesaConfigured, simulateEnabled } from "@/lib/payments/mpesa";
import { paystackConfigured } from "@/lib/payments/paystack";
import { turnstileEnabled } from "@/lib/turnstile";
import { PageTitle, Card } from "@/components/admin/ui";
import { ActionForm } from "@/components/ActionForm";
import { saveSettingsAction } from "./actions";

export default async function SettingsPage() {
  await requireAdmin("settings");
  const s = await getSettings();
  const env = process.env;
  const checks: [string, boolean, string][] = [
    ["M-Pesa (Daraja)", mpesaConfigured(), simulateEnabled() ? "Simulator on (development)" : "Set MPESA_* variables"],
    ["Card payments (Paystack)", paystackConfigured(), "Set PAYSTACK_SECRET_KEY"],
    ["Email (Resend)", !!env.RESEND_API_KEY, "Set RESEND_API_KEY"],
    ["SMS (Africa's Talking / Twilio)", !!(env.AT_API_KEY || env.TWILIO_AUTH_TOKEN), "Set AT_* or TWILIO_*"],
    ["WhatsApp (Meta Cloud API)", !!env.WHATSAPP_TOKEN, "Set WHATSAPP_*"],
    ["CAPTCHA (Turnstile)", turnstileEnabled(), "Set TURNSTILE_*"],
    ["Virus scanning (ClamAV)", !!env.CLAMAV_HOST, "Set CLAMAV_HOST"],
    ["Admin notification emails", !!env.ADMIN_NOTIFY_EMAILS, "Set ADMIN_NOTIFY_EMAILS"],
  ];
  return (
    <div className="max-w-4xl">
      <PageTitle title="Settings" />
      <Card title="Membership rules">
        <ActionForm action={saveSettingsAction} submit="Save settings">
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="field block"><span className="label">Grace period (days)</span><input name="graceDays" type="number" min={0} max={90} defaultValue={s.graceDays} className="input" /></label>
            <label className="field block"><span className="label">Reminder days before expiry</span><input name="reminderDays" defaultValue={s.reminderDays.join(", ")} className="input" /></label>
            <fieldset className="field">
              <legend className="label">Reminder channels</legend>
              <div className="flex gap-4 pt-2 text-sm">{["EMAIL", "SMS", "WHATSAPP"].map((c) => <label key={c} className="flex items-center gap-1.5"><input type="checkbox" name="reminderChannels" value={c} defaultChecked={s.reminderChannels.includes(c)} className="accent-[var(--emerald)]" />{c.toLowerCase()}</label>)}</div>
            </fieldset>
            <label className="field block"><span className="label">Junior minimum age</span><input name="juniorMinAge" type="number" min={0} max={17} defaultValue={s.juniorMinAge} className="input" /></label>
            <label className="field block"><span className="label">Junior maximum age</span><input name="juniorMaxAge" type="number" min={1} max={17} defaultValue={s.juniorMaxAge} className="input" /></label>
            <label className="field block"><span className="label">Junior conversion grace (days after 18)</span><input name="juniorConvertGraceDays" type="number" min={0} max={365} defaultValue={s.juniorConvertGraceDays} className="input" /></label>
            <label className="field block sm:col-span-3"><span className="label">Junior accompaniment rule (shown to guardians)</span><input name="juniorAccompanyRule" defaultValue={s.juniorAccompanyRule} className="input" /></label>
            <label className="field block"><span className="label">M-Pesa Paybill (shown for manual payment)</span><input name="paybillNumber" defaultValue={s.paybillNumber} className="input" /></label>
            <label className="field block sm:col-span-2"><span className="label">Bank details (shown for manual payment)</span><textarea name="bankDetails" rows={2} defaultValue={s.bankDetails} className="input" /></label>
          </div>
        </ActionForm>
      </Card>
      <Card title="Integrations" className="mt-6">
        <ul className="divide-y divide-line-light text-sm">
          {checks.map(([name, ok, hint]) => (
            <li key={name} className="flex items-center justify-between py-2.5"><span>{name}</span><span className={ok ? "text-ok" : "text-warn"}>{ok ? "Configured" : hint}</span></li>
          ))}
        </ul>
        <p className="hint mt-3">Credentials are set as environment variables on the server (see SETUP.md), never in this screen.</p>
      </Card>
    </div>
  );
}
