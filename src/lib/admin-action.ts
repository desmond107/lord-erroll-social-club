import "server-only";
import { assertAdmin, AuthError, type AdminSessionUser } from "./admin-auth";
import { MembershipError } from "./membership";
import { UploadError } from "./uploads";
import type { Permission } from "./roles";

export type ActionResult = { ok?: string; error?: string } | null;

/**
 * Runs an admin server action after a server-side permission check, turning expected
 * errors into a friendly message. Every admin action goes through this.
 */
export async function guarded(p: Permission, fn: (user: AdminSessionUser) => Promise<string | void>): Promise<ActionResult> {
  try {
    const user = await assertAdmin(p);
    const ok = await fn(user);
    return { ok: ok || "Saved." };
  } catch (e) {
    if (e instanceof AuthError || e instanceof MembershipError || e instanceof UploadError || e instanceof InputError) return { error: e.message };
    if (e && typeof e === "object" && "digest" in e && String((e as { digest: string }).digest).startsWith("NEXT_REDIRECT")) throw e;
    console.error("[admin action]", e);
    return { error: "Something went wrong. Please try again." };
  }
}

export class InputError extends Error {}

export const str = (fd: FormData, k: string, max = 500) => String(fd.get(k) ?? "").trim().slice(0, max);
export const int = (fd: FormData, k: string) => {
  const n = Number(fd.get(k));
  if (!Number.isFinite(n)) throw new InputError(`${k} must be a number.`);
  return Math.round(n);
};
