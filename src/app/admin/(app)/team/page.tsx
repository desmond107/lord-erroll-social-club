import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/roles";
import { fmtDateTime } from "@/lib/format";
import { PageTitle, Card } from "@/components/admin/ui";
import { ActionForm } from "@/components/ActionForm";
import { addAdmin, reset2fa, updateAdmin } from "./actions";

export default async function Team() {
  const me = await requireAdmin("team");
  const staff = await prisma.adminUser.findMany({ orderBy: [{ active: "desc" }, { role: "asc" }, { name: "asc" }] });
  return (
    <div className="max-w-5xl">
      <PageTitle title="Team" sub="Staff accounts and roles. Permissions are enforced on the server for every page and action." />
      <Card className="mb-6">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          {Object.entries(ROLE_LABELS).map(([k, v]) => <div key={k}><dt className="font-semibold">{v}</dt><dd className="text-ink-soft">{ROLE_DESCRIPTIONS[k as keyof typeof ROLE_LABELS]}</dd></div>)}
        </dl>
      </Card>
      <div className="space-y-3">
        {staff.map((s) => (
          <Card key={s.id} className={s.active ? "" : "opacity-60"}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="font-semibold">{s.name} {s.id === me.id && <span className="text-xs text-ink-soft">(you)</span>}</div>
                <div className="text-sm text-ink-soft">{s.email}</div>
                <div className="mt-1 text-xs text-ink-soft">2FA {s.totpEnabled ? <span className="text-ok">on</span> : <span className="text-warn">not set up</span>} · last sign-in {fmtDateTime(s.lastLoginAt)}</div>
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <ActionForm action={updateAdmin} submit="Save" buttonClass="btn btn-outline btn-sm">
                  <input type="hidden" name="id" value={s.id} />
                  <div className="flex items-center gap-3">
                    <select name="role" defaultValue={s.role} aria-label="Role" className="input !min-h-0 py-1.5 text-sm">{Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                    <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" name="active" defaultChecked={s.active} className="accent-[var(--emerald)]" />Active</label>
                  </div>
                </ActionForm>
                {s.totpEnabled && s.id !== me.id && (
                  <ActionForm action={reset2fa} submit="Reset 2FA" buttonClass="btn btn-outline btn-sm" confirm={`Reset two-factor for ${s.name}? Use this if they lost their phone.`}><input type="hidden" name="id" value={s.id} /></ActionForm>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
      <Card title="Add a staff member" className="mt-6">
        <ActionForm action={addAdmin} submit="Create account">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="field block"><span className="label">Name</span><input name="name" required className="input" /></label>
            <label className="field block"><span className="label">Email</span><input name="email" type="email" required className="input" /></label>
            <label className="field block"><span className="label">Role</span><select name="role" className="input" defaultValue="FRONT_DESK">{Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          </div>
        </ActionForm>
      </Card>
    </div>
  );
}
