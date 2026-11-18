import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { clientIp } from "./request";

type Actor = { id: string; email: string } | "system" | "member" | "applicant";

/** Writes one audit row. Never throws: an audit failure must not undo the action it records. */
export async function audit(actor: Actor, action: string, entity: string, entityId?: string | null, detail?: Prisma.InputJsonValue) {
  let ip: string | null = null;
  try {
    ip = await clientIp();
  } catch {
    // Outside a request (cron, scripts).
  }
  await prisma.auditLog
    .create({
      data: {
        actorId: typeof actor === "object" ? actor.id : null,
        actorLabel: typeof actor === "object" ? actor.email : actor,
        action,
        entity,
        entityId: entityId ?? null,
        detail: detail ?? undefined,
        ip,
      },
    })
    .catch((e) => console.error("[audit] failed to record", action, e));
}
