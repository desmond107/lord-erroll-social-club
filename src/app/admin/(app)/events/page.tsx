import type { Event } from "@prisma/client";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { PageTitle, Card } from "@/components/admin/ui";
import { ActionForm } from "@/components/ActionForm";
import { deleteEvent, saveEvent } from "./actions";

function Fields({ e }: { e?: Event }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="field block"><span className="label">Title</span><input name="title" required defaultValue={e?.title} className="input" /></label>
      <label className="field block"><span className="label">When</span><input name="schedule" required defaultValue={e?.schedule} placeholder="Every Thursday · from 7 pm" className="input" /></label>
      <label className="field block sm:col-span-2"><span className="label">Description</span><textarea name="description" required rows={3} defaultValue={e?.description} className="input" /></label>
      <div className="flex flex-wrap gap-5 text-sm sm:col-span-2">
        <label className="flex items-center gap-2"><input type="checkbox" name="adultOnly" defaultChecked={e?.adultOnly ?? true} className="accent-[var(--emerald)]" />Adult-only (18+; hidden from Junior accounts)</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="membersOnly" defaultChecked={e?.membersOnly} className="accent-[var(--emerald)]" />Members only</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="published" defaultChecked={e?.published ?? true} className="accent-[var(--emerald)]" />Published</label>
      </div>
    </div>
  );
}

export default async function Events() {
  await requireAdmin("events");
  const events = await prisma.event.findMany({ orderBy: { sortOrder: "asc" } });
  return (
    <div className="max-w-4xl">
      <PageTitle title="Events" sub="Shown on the Events page and in the member portal. Adult-only events are never shown or promoted to Junior accounts." />
      <div className="space-y-4">
        {events.map((e) => (
          <Card key={e.id}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-serif text-xl text-emerald">{e.title}</div>
                <div className="text-xs text-ink-soft">{e.schedule}{e.adultOnly && " · 18+"}{e.membersOnly && " · members only"}{!e.published && " · hidden"}</div>
              </div>
              <ActionForm action={deleteEvent} submit="Delete" buttonClass="btn btn-outline btn-sm !mt-0" confirm={`Delete “${e.title}”?`}><input type="hidden" name="id" value={e.id} /></ActionForm>
            </div>
            <details className="mt-2">
              <summary className="cursor-pointer text-xs font-semibold tracking-wider text-gold-ink uppercase">Edit</summary>
              <ActionForm action={saveEvent} submit="Save event" className="mt-3"><input type="hidden" name="id" value={e.id} /><Fields e={e} /></ActionForm>
            </details>
          </Card>
        ))}
      </div>
      <Card title="Add an event" className="mt-6">
        <ActionForm action={saveEvent} submit="Add event"><input type="hidden" name="id" value="" /><Fields /></ActionForm>
      </Card>
    </div>
  );
}
