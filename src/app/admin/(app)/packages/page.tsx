import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { FINISHES, finishFor } from "@/lib/finishes";
import { kes } from "@/lib/format";
import { PageTitle, Card } from "@/components/admin/ui";
import { ActionForm } from "@/components/ActionForm";
import { createPackage, move, savePackage, toggleActive } from "./actions";

function Fields({ p }: { p?: { name: string; annualFeeKes: number; finish: string; benefits: string[]; ribbon: string; tagline: string; maxLinked: number; kind: string } }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="field block"><span className="label">Name</span><input name="name" required defaultValue={p?.name} className="input" /></label>
      <label className="field block"><span className="label">Annual fee (KES)</span><input name="annualFeeKes" type="number" min={0} required defaultValue={p?.annualFeeKes} className="input" /></label>
      <label className="field block"><span className="label">Card finish</span>
        <select name="finish" defaultValue={p?.finish ?? "emerald"} className="input">{Object.values(FINISHES).map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}</select>
      </label>
      <label className="field block"><span className="label">Ribbon</span>
        <select name="ribbon" defaultValue={p?.ribbon ?? ""} className="input"><option value="">None</option><option>Most Popular</option><option>Most Prestigious</option><option>Best Value</option></select>
      </label>
      <label className="field block sm:col-span-2"><span className="label">Tagline</span><input name="tagline" defaultValue={p?.tagline} className="input" maxLength={160} /></label>
      {(!p || p.kind === "FAMILY") && <label className="field block"><span className="label">Linked members allowed (Family)</span><input name="maxLinked" type="number" min={0} max={8} defaultValue={p?.maxLinked ?? 0} className="input" /></label>}
      <label className="field block sm:col-span-2"><span className="label">Benefits (one per line{p?.kind === "MAIN" || !p ? "; main tiers list only what they add" : ""})</span><textarea name="benefits" required rows={6} defaultValue={p?.benefits.join("\n")} className="input" /></label>
    </div>
  );
}

export default async function Packages() {
  await requireAdmin("packages");
  const pkgs = await prisma.package.findMany({ orderBy: { sortOrder: "asc" }, include: { _count: { select: { memberships: true } } } });
  return (
    <div className="max-w-5xl">
      <PageTitle title="Packages" sub="Fees, benefits, card finishes and the order shown on the website. Main tiers form the ladder from top of this list (entry) to bottom (most senior)." />
      <div className="space-y-4">
        {pkgs.map((p, i) => (
          <Card key={p.id} className={p.active ? "" : "opacity-70"}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="h-6 w-10 border border-line-light" style={{ background: finishFor(p.finish).base }} aria-hidden />
                <div>
                  <div className="font-serif text-xl text-emerald">{p.name} <span className="text-sm text-ink-soft">· {kes(p.annualFeeKes)}/yr</span></div>
                  <div className="text-xs text-ink-soft">
                    {p.kind === "MAIN" ? `Main tier ${p.rank}` : p.kind === "JUNIOR" ? "Special · Junior (under 18)" : `Special · Family (${p.maxLinked} linked)`} · {p._count.memberships} memberships
                    {!p.active && <span className="ml-2 font-semibold text-bad">Inactive</span>}
                    {!p.confirmed && <span className="ml-2 font-semibold text-warn">Unconfirmed sample data</span>}
                    {p.ribbon && <span className="ml-2 text-crimson">“{p.ribbon}”</span>}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <ActionForm action={move} submit="↑" buttonClass="btn btn-outline btn-sm !mt-0"><input type="hidden" name="id" value={p.id} /><input type="hidden" name="dir" value="up" /></ActionForm>
                <ActionForm action={move} submit="↓" buttonClass="btn btn-outline btn-sm !mt-0"><input type="hidden" name="id" value={p.id} /><input type="hidden" name="dir" value="down" /></ActionForm>
                <ActionForm action={toggleActive} submit={p.active ? "Deactivate" : "Activate"} buttonClass="btn btn-outline btn-sm !mt-0" confirm={p.active ? `Deactivate ${p.name}? New applicants won't see it; existing members keep it until renewal.` : undefined}>
                  <input type="hidden" name="id" value={p.id} />
                </ActionForm>
              </div>
            </div>
            <details className="mt-3" open={!p.confirmed && i === 0}>
              <summary className="cursor-pointer text-xs font-semibold tracking-wider text-gold-ink uppercase">Edit</summary>
              <ActionForm action={savePackage} submit="Save package" className="mt-4">
                <input type="hidden" name="id" value={p.id} />
                <Fields p={p} />
              </ActionForm>
            </details>
          </Card>
        ))}
      </div>
      <Card title="Add a package" className="mt-8">
        <ActionForm action={createPackage} submit="Create package">
          <div className="field mb-3"><label>Type</label><select name="kind" className="input max-w-xs"><option value="MAIN">Main tier (added at the top of the ladder)</option><option value="FAMILY">Family / Joint</option><option value="JUNIOR">Junior</option></select></div>
          <Fields />
        </ActionForm>
      </Card>
    </div>
  );
}
