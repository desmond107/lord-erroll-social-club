import "server-only";
import fs from "fs/promises";
import path from "path";
import net from "net";
import crypto from "crypto";
import sharp from "sharp";
import type { FileKind, Prisma } from "@prisma/client";
import { decryptBuffer, encryptBuffer, sha256 } from "./crypto";

/**
 * Private uploads. Files are:
 *  - size-limited and type-checked by magic bytes (not the browser's claimed type);
 *  - images are re-encoded through sharp, which strips metadata and any embedded payload;
 *  - optionally virus-scanned with ClamAV (CLAMAV_HOST/CLAMAV_PORT, INSTREAM protocol);
 *  - encrypted with AES-256-GCM and written outside /public (UPLOAD_DIR).
 * They are only ever served through access-checked route handlers.
 */

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const MAX_DOC_BYTES = 8 * 1024 * 1024;

const uploadDir = () => path.resolve(process.env.UPLOAD_DIR || "./storage/uploads");

export class UploadError extends Error {}

function sniff(buf: Buffer): "image/jpeg" | "image/png" | "image/webp" | "application/pdf" | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP") return "image/webp";
  if (buf.subarray(0, 5).toString() === "%PDF-") return "application/pdf";
  return null;
}

/** ClamAV INSTREAM scan. Returns "clean", "infected" or "unscanned" (no scanner configured). */
async function virusScan(buf: Buffer): Promise<"clean" | "infected" | "unscanned"> {
  const host = process.env.CLAMAV_HOST;
  if (!host) {
    if (process.env.NODE_ENV === "production" && process.env.CLAMAV_REQUIRED === "1") throw new UploadError("Virus scanner unavailable. Please try again later.");
    return "unscanned";
  }
  const port = Number(process.env.CLAMAV_PORT) || 3310;
  return new Promise((resolve, reject) => {
    const sock = net.createConnection({ host, port }, () => {
      sock.write("zINSTREAM\0");
      for (let i = 0; i < buf.length; i += 64 * 1024) {
        const chunk = buf.subarray(i, i + 64 * 1024);
        const len = Buffer.alloc(4);
        len.writeUInt32BE(chunk.length);
        sock.write(len);
        sock.write(chunk);
      }
      sock.write(Buffer.alloc(4));
    });
    let out = "";
    sock.setTimeout(20000, () => {
      sock.destroy();
      reject(new UploadError("Virus scan timed out."));
    });
    sock.on("data", (d) => (out += d.toString()));
    sock.on("end", () => resolve(/FOUND/.test(out) ? "infected" : "clean"));
    sock.on("error", () => reject(new UploadError("Virus scanner unavailable.")));
  });
}

/** Validates, cleans, scans, encrypts and stores a file. Returns the StoredFile create input. */
export async function storeUpload(file: File, kind: FileKind): Promise<Prisma.StoredFileCreateInput> {
  const limit = kind === "PHOTO" ? MAX_PHOTO_BYTES : MAX_DOC_BYTES;
  if (file.size === 0) throw new UploadError("The file is empty.");
  if (file.size > limit) throw new UploadError(`Files must be under ${Math.round(limit / 1024 / 1024)} MB.`);
  let buf: Buffer = Buffer.from(await file.arrayBuffer());
  const type = sniff(buf);
  if (!type) throw new UploadError("Please upload a JPEG, PNG or WebP image" + (kind === "DOB_PROOF" ? " or a PDF." : "."));
  if (kind === "PHOTO" && type === "application/pdf") throw new UploadError("Photos must be JPEG, PNG or WebP images.");

  let mime: string = type;
  if (type !== "application/pdf") {
    try {
      const img = sharp(buf, { limitInputPixels: 40_000_000 }).rotate();
      buf = kind === "PHOTO"
        ? await img.resize(800, 800, { fit: "cover", position: "attention" }).jpeg({ quality: 86 }).toBuffer()
        : await img.resize(2400, 2400, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 88 }).toBuffer();
      mime = "image/jpeg";
    } catch {
      throw new UploadError("That image couldn't be read. Please try another file.");
    }
  } else if (/\/(JavaScript|JS|Launch|EmbeddedFile|OpenAction)\b/.test(buf.toString("latin1"))) {
    throw new UploadError("That PDF contains active content and can't be accepted. Please upload a scan or photo instead.");
  }

  const scan = await virusScan(buf);
  if (scan === "infected") throw new UploadError("That file failed the virus check.");

  const rel = path.join(kind === "PHOTO" ? "photos" : "documents", `${crypto.randomUUID()}.bin`);
  const abs = path.join(uploadDir(), rel);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, encryptBuffer(buf), { mode: 0o600 });
  return { kind, mime, size: buf.length, path: rel, sha256: sha256(buf), scanStatus: scan };
}

export async function readUpload(rel: string): Promise<Buffer> {
  const abs = path.join(uploadDir(), rel);
  if (!abs.startsWith(uploadDir())) throw new Error("Bad path");
  return decryptBuffer(await fs.readFile(abs));
}

export async function deleteUpload(rel: string) {
  await fs.rm(path.join(uploadDir(), rel), { force: true });
}
