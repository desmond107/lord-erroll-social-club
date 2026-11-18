import "server-only";
import { authenticator } from "otplib";
import QRCode from "qrcode";
import { decrypt, encrypt } from "./crypto";

authenticator.options = { window: 1 };

export const sealSecret = (secret: string) => encrypt(secret);
export const openSecret = (sealed: string) => decrypt(sealed);
export const newSecret = () => authenticator.generateSecret();

export function verifyTotp(code: string, secret: string) {
  return authenticator.check(code.replace(/\s/g, ""), secret);
}

export async function totpQrDataUrl(email: string, secret: string) {
  const uri = authenticator.keyuri(email, "Lord Erroll Social Club", secret);
  return QRCode.toDataURL(uri, { margin: 1, width: 220, color: { dark: "#14261c", light: "#faf5ea" } });
}
