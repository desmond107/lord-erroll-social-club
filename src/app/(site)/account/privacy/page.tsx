import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { requireAccount } from "@/lib/member-auth";
import { fmtDate } from "@/lib/format";
import { ActionForm } from "@/components/ActionForm";
import { StatusBadge } from "@/components/StatusBadge";
import { requestData } from "../actions";
import { AccountNav } from "../AccountNav";

export const metadata: Metadata = { title: "Privacy and your data", robots: { index: false } };

export default async function PrivacyRequests() {
  const a = await requireAccount();
  const [holders, requests] = await Promise.all([
    prisma.cardholder.findMany({ where: { membership: { accountId: a.id }, suffix: { not: "" } }, select: { id: true, displayName: true, relationship: true } }),
    prisma.dataRequest.findMany({ where: { accountId: a.id }, orderBy: { createdAt: "desc" } }),
  ]);
  return (
    <section className="bg-vignette min-h-screen pt-[72px]">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <AccountNav name={a.fullName} />
        <h1 className="display mt-10 text-[2.4rem]">Privacy and your data</h1>
        <p className="mt-3 text-on-dark/80">Under the Kenya Data Protection Act, 2019 you may ask us to correct, export or delete your personal data, or that of a Junior or family member you manage.</p>
        <div className="on-paper gold-frame mt-8 p-6 sm:p-8">
          <ActionForm action={requestData} submit="Send request">
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="field">
                <label htmlFor="type">Request</label>
                <select id="type" name="type" className="input" required defaultValue="">
                  <option value="" disabled>Choose…</option>
                  <option value="CORRECTION">Correct my data</option>
                  <option value="EXPORT">Send me a copy of my data</option>
                  <option value="DELETION">Delete my data</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="subject">Whose data</label>
                <select id="subject" name="subject" className="input" defaultValue="self">
                  <option value="self">Mine</option>
                  {holders.map((h) => <option key={h.id} value={h.id}>{h.displayName} ({h.relationship})</option>)}
                </select>
              </div>
              <div className="field sm:col-span-2">
                <label htmlFor="details">Details</label>
                <textarea id="details" name="details" className="input" maxLength={2000} placeholder="For corrections, tell us what should change." />
                <p className="hint">Deleting data ends the membership. Payment records are kept for seven years as tax law requires, and membership numbers are never reissued.</p>
              </div>
            </div>
          </ActionForm>
        </div>
        {requests.length > 0 && (
          <div className="mt-10">
            <h2 className="display text-[1.6rem]">Your requests</h2>
            <ul className="mt-4 divide-y divide-line-dark border-y border-line-dark">
              {requests.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                  <span>{r.type.toLowerCase()} · {fmtDate(r.createdAt)}{r.resolution ? ` · ${r.resolution}` : ""}</span>
                  <StatusBadge status={r.status === "OPEN" ? "PENDING" : "ACTIVE"} label={r.status.toLowerCase()} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
