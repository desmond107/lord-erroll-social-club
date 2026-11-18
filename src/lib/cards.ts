import "server-only";
import QRCode from "qrcode";
import type { Cardholder, Membership, Package } from "@prisma/client";
import { appUrl } from "./request";
import { validThru } from "./format";
import { effectiveStatus } from "./membership";
import type { CardData } from "@/components/card/MembershipCard3D";

export const verifyUrl = (token: string) => `${appUrl()}/verify/${token}`;

/** QR as inline SVG: dark-green modules, transparent background (sits on the gold plate). */
export async function qrSvg(token: string) {
  const svg = await QRCode.toString(verifyUrl(token), { type: "svg", errorCorrectionLevel: "M", margin: 1, color: { dark: "#10261aff", light: "#00000000" } });
  return svg.replace("<svg ", '<svg width="100%" height="100%" ');
}

export async function qrPng(token: string, width = 600) {
  return QRCode.toBuffer(verifyUrl(token), { errorCorrectionLevel: "M", margin: 1, width, color: { dark: "#10261aff", light: "#00000000" } });
}

export async function cardDataFor(
  holder: Cardholder,
  m: Membership & { package: Package; cardholders?: Cardholder[] },
  graceDays: number,
): Promise<CardData> {
  const status = effectiveStatus(m, graceDays);
  const primary = m.cardholders?.find((c) => c.suffix === "");
  const finish = m.isJunior ? "junior" : m.package.finish;
  return {
    finish,
    packageName: m.isJunior ? "Junior" : m.package.kind === "FAMILY" ? "Family" : m.package.name,
    displayName: holder.displayName,
    cardNumber: holder.cardNumber,
    memberSince: String((m.memberSince ?? m.createdAt).getUTCFullYear()),
    validThru: validThru(m.expiresAt),
    status,
    // A QR is only issued once the membership has been activated.
    qrSvg: m.activatedAt ? await qrSvg(holder.verifyToken) : null,
    junior: m.isJunior,
    jointOf: holder.suffix && holder.suffix !== "J" && primary ? primary.displayName : null,
  };
}
