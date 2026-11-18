import "server-only";
import { prisma } from "./db";
import { encrypt, randomToken } from "./crypto";
import { deleteUpload } from "./uploads";

const ERASED_DOB = new Date(Date.UTC(1900, 0, 1));

async function dropFiles(ids: (string | null | undefined)[]) {
  const files = await prisma.storedFile.findMany({ where: { id: { in: ids.filter(Boolean) as string[] } } });
  await Promise.all(files.map((f) => deleteUpload(f.path)));
  return files.map((f) => f.id);
}

/**
 * Right to erasure (KDPA s.40). Personal data is removed or overwritten; payment amounts
 * and dates stay for tax records under an anonymised name; membership numbers stay
 * reserved in IssuedNumber so they are never reissued.
 */
export async function eraseAccount(accountId: string) {
  const acct = await prisma.account.findUniqueOrThrow({
    where: { id: accountId },
    include: { memberships: { include: { cardholders: true, application: { include: { dependants: true } } } } },
  });
  const holders = acct.memberships.flatMap((m) => m.cardholders);
  const apps = await prisma.application.findMany({ where: { OR: [{ accountId }, { emailIdx: acct.emailIdx }] }, include: { dependants: true } });
  const fileIds = [
    ...holders.flatMap((h) => [h.photoId, h.dobProofId]),
    ...apps.flatMap((a) => [a.photoId, ...a.dependants.flatMap((d) => [d.photoId, d.dobProofId])]),
  ];
  await prisma.$transaction(async (tx) => {
    await tx.cardholder.updateMany({ where: { id: { in: holders.map((h) => h.id) } }, data: { fullName: "Erased", displayName: "Erased", dateOfBirth: ERASED_DOB, photoId: null, dobProofId: null, active: false } });
    for (const h of holders) await tx.cardholder.update({ where: { id: h.id }, data: { verifyToken: randomToken(18) } });
    await tx.membership.updateMany({ where: { accountId }, data: { status: "CANCELLED", handoverAccountId: null } });
    await tx.applicationDependant.updateMany({ where: { applicationId: { in: apps.map((a) => a.id) } }, data: { fullName: "Erased", dateOfBirth: ERASED_DOB, photoId: null, dobProofId: null } });
    for (const a of apps) {
      await tx.application.update({
        where: { id: a.id },
        data: {
          fullName: "Erased", emailEnc: encrypt(""), emailIdx: `erased-${a.id}`, phoneEnc: encrypt(""), phoneIdx: `erased-${a.id}`,
          idNumberEnc: encrypt(""), idNumberIdx: `erased-${a.id}`, dateOfBirth: ERASED_DOB, residence: "", occupation: "", photoId: null, ip: null,
        },
      });
    }
    await tx.account.update({
      where: { id: accountId },
      data: { fullName: "Erased member", emailEnc: encrypt(""), emailIdx: `erased-${accountId}`, phoneEnc: encrypt(""), phoneIdx: `erased-${accountId}`, passwordHash: null, marketingOk: false },
    });
    await tx.memberSession.deleteMany({ where: { accountId } });
  });
  const dropped = await dropFiles(fileIds);
  await prisma.storedFile.deleteMany({ where: { id: { in: dropped } } });
}

/** Erases one dependant's card (a family member or a guardian's Junior). */
export async function eraseCardholder(cardholderId: string) {
  const h = await prisma.cardholder.findUniqueOrThrow({ where: { id: cardholderId }, include: { membership: true } });
  await prisma.cardholder.update({
    where: { id: h.id },
    data: { fullName: "Erased", displayName: "Erased", dateOfBirth: ERASED_DOB, photoId: null, dobProofId: null, active: false, verifyToken: randomToken(18) },
  });
  if (h.suffix === "J") await prisma.membership.update({ where: { id: h.membershipId }, data: { status: "CANCELLED" } });
  const dropped = await dropFiles([h.photoId, h.dobProofId]);
  await prisma.storedFile.deleteMany({ where: { id: { in: dropped } } });
}
