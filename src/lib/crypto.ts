import "server-only";
import crypto from "crypto";

/**
 * Field-level encryption for personal data at rest (Kenya DPA 2019, s.41).
 * AES-256-GCM with a random IV per value. The key comes from DATA_ENCRYPTION_KEY
 * (32 bytes, base64). Blind indexes are keyed HMACs with a key derived separately,
 * so equality lookups (email, phone, ID number) work without decrypting.
 */

let cachedKey: Buffer | null = null;

function masterKey(): Buffer {
  if (cachedKey) return cachedKey;
  const raw = process.env.DATA_ENCRYPTION_KEY;
  if (!raw) {
    if (process.env.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build") {
      throw new Error("DATA_ENCRYPTION_KEY is not set.");
    }
    cachedKey = crypto.createHash("sha256").update("dev-only-data-key").digest();
    return cachedKey;
  }
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) throw new Error("DATA_ENCRYPTION_KEY must be 32 bytes, base64-encoded.");
  cachedKey = buf;
  return buf;
}

const subKey = (label: string) => crypto.createHmac("sha256", masterKey()).update(label).digest();

export function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", subKey("enc:v1"), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return `v1.${[iv, c.getAuthTag(), enc].map((b) => b.toString("base64url")).join(".")}`;
}

export function decrypt(sealed: string): string {
  const [v, iv, tag, enc] = sealed.split(".");
  if (v !== "v1") throw new Error("Unknown ciphertext version");
  const d = crypto.createDecipheriv("aes-256-gcm", subKey("enc:v1"), Buffer.from(iv, "base64url"));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([d.update(Buffer.from(enc, "base64url")), d.final()]).toString("utf8");
}

/** Decrypts, returning "" for anything unreadable (e.g. an erased record). */
export function decryptOr(sealed: string | null | undefined, fallback = ""): string {
  if (!sealed) return fallback;
  try {
    return decrypt(sealed);
  } catch {
    return fallback;
  }
}

export function blindIndex(kind: "email" | "phone" | "id", normalized: string) {
  return crypto.createHmac("sha256", subKey(`idx:${kind}`)).update(normalized).digest("hex");
}

// Binary encryption for uploaded files.
export function encryptBuffer(buf: Buffer): Buffer {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", subKey("file:v1"), iv);
  const enc = Buffer.concat([c.update(buf), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), enc]);
}

export function decryptBuffer(buf: Buffer): Buffer {
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const d = crypto.createDecipheriv("aes-256-gcm", subKey("file:v1"), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(buf.subarray(28)), d.final()]);
}

// ─── Normalisers ─────────────────────────────────────────────────────────

export const normEmail = (s: string) => s.trim().toLowerCase();

/** Kenyan numbers to 2547XXXXXXXX / 2541XXXXXXXX; other international numbers keep their digits. */
export function normPhone(s: string): string {
  let d = s.replace(/[^\d+]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  if (/^0[17]\d{8}$/.test(d)) d = `254${d.slice(1)}`;
  if (/^[17]\d{8}$/.test(d)) d = `254${d}`;
  return d.replace(/\D/g, "");
}

export const normIdNumber = (s: string) => s.replace(/[\s-]/g, "").toUpperCase();

export const emailIdx = (s: string) => blindIndex("email", normEmail(s));
export const phoneIdx = (s: string) => blindIndex("phone", normPhone(s));
export const idNumberIdx = (s: string) => blindIndex("id", normIdNumber(s));

export const sha256 = (s: string | Buffer) => crypto.createHash("sha256").update(s).digest("hex");

export function randomToken(bytes = 24) {
  return crypto.randomBytes(bytes).toString("base64url");
}

/** Masks for display: "j•••@gmail.com", "+254 7•• ••• 820". */
export function maskEmail(e: string) {
  const [u, d] = e.split("@");
  if (!d) return "•••";
  return `${u.slice(0, 1)}•••@${d}`;
}
export function maskPhone(p: string) {
  const d = p.replace(/\D/g, "");
  if (d.length < 6) return "•••";
  return `+${d.slice(0, 4)}•• ••• ${d.slice(-3)}`;
}
