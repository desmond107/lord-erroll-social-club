import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth";
import { can } from "@/lib/roles";
import { prisma } from "@/lib/db";
import { decryptOr } from "@/lib/crypto";
import { ageOn } from "@/lib/age";
import { fmtDate, fmtDateTime, kes } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { audit } from "@/lib/audit";
import { PageTitle, Card } from "@/components/admin/ui";
import { StatusBadge } from "@/components/StatusBadge";
import { ActionForm } from "@/components/ActionForm";
import { approve, askInfo, reject, saveNote } from "../actions";

export default async function ApplicationDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ done?: string }> }) {
  const user = await requireAdmin("applications");
  const { id } = await params;
  const { done } = await searchParams;
  const a = await prisma.application.findUnique({
    where: { id },
    include: { package: true, dependants: { orderBy: { sortOrder: "asc" } }, reviewedBy: true, membership: true },
  });
  if (!a) notFound();
  const settings = await getSettings();
  // Viewing decrypted personal data is itself an audited event.
  await audit(user, "application.view", "Application", a.id);

  const open = a.status === "PENDING" || a.status === "INFO_REQUESTED";
  const junior = a.type === "JUNIOR";
  const age = ageOn(a.dateOfBirth);
  const sensitive = can(user, "documents.sensitive");

  const row = (k: string, v: React.ReactNode) => (
    <div className="grid grid-cols-[10rem_1fr] gap-3 border-b border-line-light py-2 text-sm"><dt className="text-ink-soft">{k}</dt><dd>{v}</dd></div>
  );

  return (
    <div>
      <Link href="/admin/applications" className="text-xs tracking-wider text-ink-soft uppercase">← Applications</Link>
      <PageTitle
        title={a.fullName}
        sub={<span className="font-mono">{a.ref}</span>}
        actions={<><StatusBadge light status={a.status} />{junior && <span className="border border-crimson px-2 py-0.5 text-xs font-bold tracking-wider text-crimson uppercase">Junior</span>}</>}
      />

      {done && (
        <div role="status" className="mb-6 border-l-4 border-ok bg-white px-4 py-3 text-sm">
          {done === "approved" && a.membership && <>Approved. Membership number <strong className="font-mono">{a.membership.number}</strong> issued; the applicant has been sent payment instructions.</>}
          {done === "rejected" && "Application declined; the applicant has been notified."}
          {done === "info" && "Request sent to the applicant."}
        </div>
      )}
      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <Card title={junior ? "Parent or guardian" : a.type === "FAMILY" ? "Primary member" : "Applicant"}>
            <div className="flex gap-5">
              {a.photoId && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/api/files/${a.photoId}`} alt={`Photo of ${a.fullName}`} className="h-28 w-28 flex-none border border-line-light object-cover" />
              )}
              <dl className="flex-1">
                {row("Package", `${a.package.name} · ${kes(a.package.annualFeeKes)}/yr`)}
                {row("Email", decryptOr(a.emailEnc))}
                {row("Phone", decryptOr(a.phoneEnc))}
                {row("ID / passport", decryptOr(a.idNumberEnc))}
                {row("Date of birth", <>{fmtDate(a.dateOfBirth)} <span className={age < 18 ? "font-bold text-bad" : "text-ink-soft"}>(age {age})</span></>)}
                {row("Residence", a.residence)}
                {row("Occupation", a.occupation)}
                {row("Heard via", a.heardFrom)}
                {junior && row("Relationship", a.relationship)}
                {row("Received", fmtDateTime(a.createdAt))}
                {row("Marketing", a.marketingOk ? "Opted in" : "No")}
              </dl>
            </div>
          </Card>

          {a.dependants.length > 0 && (
            <Card title={junior ? "Junior member" : `Linked members (${a.dependants.length} of ${a.package.maxLinked})`}>
              <ul className="divide-y divide-line-light">
                {a.dependants.map((d, i) => {
                  const dAge = ageOn(d.dateOfBirth);
                  const outOfRange = junior && (dAge < settings.juniorMinAge || dAge > settings.juniorMaxAge);
                  return (
                    <li key={d.id} className="flex flex-wrap items-center gap-4 py-3">
                      {d.photoId && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={`/api/files/${d.photoId}`} alt="" className="h-16 w-16 border border-line-light object-cover" />
                      )}
                      <div className="flex-1">
                        <div className="font-semibold">{junior ? "J" : String.fromCharCode(65 + i)} · {d.fullName}</div>
                        <div className="text-sm text-ink-soft">{d.relationship} · born {fmtDate(d.dateOfBirth)} · <span className={dAge < 18 ? "font-semibold text-crimson" : ""}>age {dAge}</span>{outOfRange && <span className="font-bold text-bad"> · outside Junior range {settings.juniorMinAge}–{settings.juniorMaxAge}</span>}</div>
                      </div>
                      {d.dobProofId && (sensitive ? (
                        <a href={`/api/files/${d.dobProofId}`} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm">View DOB document</a>
                      ) : (
                        <span className="text-xs text-ink-soft">DOB document on file (Super Admin only)</span>
                      ))}
                    </li>
                  );
                })}
              </ul>
              {junior && (
                <div className="mt-4 border-t border-line-light pt-4 text-xs text-ink-soft">
                  <strong className="text-ink">Guardian consent</strong> given {fmtDateTime(a.guardianConsentAt)}: “{a.guardianConsentText}”
                  {a.photoConsentAt && <div className="mt-1">Photo consent given {fmtDateTime(a.photoConsentAt)}.</div>}
                </div>
              )}
            </Card>
          )}
        </div>

        <div className="space-y-6">
          {a.membership && (
            <Card title="Membership issued">
              <p className="text-sm">Number <Link className="link-gold font-mono font-semibold" href={`/admin/members/${a.membership.id}`}>{a.membership.number}</Link></p>
            </Card>
          )}
          {a.messageToApplicant && (
            <Card title={a.status === "REJECTED" ? "Reason given" : "Message to applicant"}><p className="text-sm whitespace-pre-line">{a.messageToApplicant}</p></Card>
          )}
          {open && (
            <>
              <Card title="Approve">
                <ActionForm action={approve} submit="Approve and issue number" confirm={`Approve ${a.fullName} for ${a.package.name}? A membership number will be issued and payment requested.`}>
                  <input type="hidden" name="id" value={a.id} />
                  <textarea name="note" className="input" placeholder="Internal note (optional)" maxLength={1000} />
                </ActionForm>
              </Card>
              <Card title="Request more information">
                <ActionForm action={askInfo} submit="Send request" buttonClass="btn btn-outline">
                  <input type="hidden" name="id" value={a.id} />
                  <textarea name="message" required className="input" placeholder="What would you like the applicant to provide?" maxLength={1500} />
                </ActionForm>
              </Card>
              <Card title="Decline">
                <ActionForm action={reject} submit="Decline application" buttonClass="btn border border-bad text-bad" confirm="Decline this application? The applicant will be notified.">
                  <input type="hidden" name="id" value={a.id} />
                  <textarea name="reason" required className="input" placeholder="Reason shared with the applicant (kept polite)" maxLength={1000} />
                  <textarea name="note" className="input mt-2" placeholder="Internal note (optional)" maxLength={1000} />
                </ActionForm>
              </Card>
            </>
          )}
          <Card title="Internal note">
            <ActionForm action={saveNote} submit="Save note" buttonClass="btn btn-outline btn-sm">
              <input type="hidden" name="id" value={a.id} />
              <textarea name="note" className="input" defaultValue={a.adminNote ?? ""} maxLength={2000} />
            </ActionForm>
            {a.reviewedBy && <p className="mt-3 text-xs text-ink-soft">Last reviewed by {a.reviewedBy.name}, {fmtDateTime(a.reviewedAt)}</p>}
          </Card>
        </div>
      </div>
    </div>
  );
}
