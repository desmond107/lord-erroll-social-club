import "server-only";
import React from "react"; // JSX runtime for scripts run outside Next
import fs from "fs/promises";
import path from "path";
import { ImageResponse } from "next/og";
import { finishFor } from "./finishes";
import { guillocheSvg, svgDataUri } from "./guilloche";
import { CLUB } from "./site";
import type { CardData } from "@/components/card/MembershipCard3D";

/**
 * Static PNG of a card face (1712 × 1080, i.e. 85.6 × 54 mm at 20 px/mm) rendered with
 * Satori, using the same finish tokens and guilloché as the on-screen 3D card.
 */
export const CARD_W = 1712;
export const CARD_H = 1080;

let assets: Promise<{ fonts: { name: string; data: Buffer; weight: 400 | 600 | 700; style: "normal" }[]; crest: string }> | null = null;
function loadAssets() {
  assets ??= (async () => {
    const dir = path.join(process.cwd(), "src/assets/fonts");
    const [frak, corm, inter, interB, crest] = await Promise.all([
      fs.readFile(path.join(dir, "Fraktur.ttf")),
      fs.readFile(path.join(dir, "Cormorant-SemiBold.ttf")),
      fs.readFile(path.join(dir, "Inter-Regular.ttf")),
      fs.readFile(path.join(dir, "Inter-SemiBold.ttf")),
      fs.readFile(path.join(process.cwd(), "public/brand/crest.png")),
    ]);
    return {
      fonts: [
        { name: "Fraktur", data: frak, weight: 400, style: "normal" },
        { name: "Cormorant", data: corm, weight: 600, style: "normal" },
        { name: "Inter", data: inter, weight: 400, style: "normal" },
        { name: "Inter", data: interB, weight: 700, style: "normal" },
      ],
      crest: `data:image/png;base64,${crest.toString("base64")}`,
    };
  })();
  return assets;
}

/** Satori's radial-gradient support is limited; use a linear fallback built from the same stops. */
function satoriBase(base: string) {
  if (!base.startsWith("radial")) return base;
  const stops = base.slice(base.indexOf(",") + 1, -1);
  return `linear-gradient(150deg,${stops})`;
}

const px = (cqw: number) => Math.round((cqw / 100) * CARD_W);

export async function renderCardPng(card: CardData, face: "front" | "back", qrPngDataUri: string | null) {
  const { fonts, crest } = await loadAssets();
  const F = finishFor(card.finish);
  const dim = card.status === "EXPIRED" || card.status === "SUSPENDED" || card.status === "CANCELLED";
  const stamp = ({ EXPIRED: "EXPIRED", SUSPENDED: "SUSPENDED", CANCELLED: "CANCELLED", PENDING: "PENDING ACTIVATION" } as Record<string, string>)[card.status];
  const guilloche = svgDataUri(guillocheSvg(F.guilloche));
  const label = { fontFamily: "Inter", fontSize: px(1.5), letterSpacing: px(0.3), textTransform: "uppercase" as const, color: F.inkSoft };

  const front = (
    <div style={{ display: "flex", position: "relative", width: CARD_W, height: CARD_H, borderRadius: px(4.2), overflow: "hidden", backgroundImage: satoriBase(F.base), color: F.ink }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={guilloche} width={CARD_W} height={CARD_H} style={{ position: "absolute", left: 0, top: 0 }} alt="" />
      <div style={{ position: "absolute", left: px(2.6), top: px(2.6), right: px(2.6), bottom: px(2.6), borderRadius: px(2.6), border: `${px(0.18)}px solid ${F.foil}`, opacity: 0.55, display: "flex" }} />
      <div style={{ position: "absolute", top: 0, bottom: 0, left: "62%", width: px(3.2), opacity: 0.18 + F.holo * 0.3, backgroundImage: "linear-gradient(180deg,#9ff2d6,#f6c1ec,#b9d1ff,#fff2b3,#9ff2d6)", display: "flex" }} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={crest} width={px(21)} height={Math.round((px(21) * 372) / 328)} style={{ position: "absolute", left: px(7.5), top: px(9.5) }} alt="" />
      <div style={{ position: "absolute", left: px(32), top: px(13), display: "flex", flexDirection: "column" }}>
        <div style={{ fontFamily: "Fraktur", fontSize: px(7.4), lineHeight: 1 }}>The Lord Erroll</div>
        <div style={{ marginTop: px(1.6), fontFamily: "Cormorant", fontSize: px(2.5), letterSpacing: px(0.9), color: F.inkSoft }}>SOCIAL CLUB</div>
      </div>
      <div style={{ position: "absolute", top: px(5), right: px(5.5), padding: `${px(0.8)}px ${px(2.2)}px`, borderRadius: px(0.6), backgroundImage: F.foilGradient, fontFamily: "Inter", fontWeight: 700, fontSize: px(1.9), letterSpacing: px(0.5), color: card.finish === "gold" ? "#f3dc8e" : card.finish === "bronze" ? "#f0d2ad" : "#1a1407", display: "flex" }}>
        {card.packageName.toUpperCase()}
      </div>
      <div style={{ position: "absolute", left: px(7.5), right: px(6), bottom: px(6.2), display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {card.jointOf ? <div style={{ ...label, fontSize: px(1.55) }}>{`Joint Member · ${card.jointOf}`}</div> : null}
          <div style={{ fontFamily: "Cormorant", fontSize: px(4.1), lineHeight: 1.1 }}>{card.displayName}</div>
          <div style={{ marginTop: px(0.8), fontFamily: "Inter", fontSize: px(2.4), letterSpacing: px(0.35) }}>{card.cardNumber}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
          <div style={{ ...label, fontSize: px(1.45) }}>Member since</div>
          <div style={{ fontFamily: "Cormorant", fontSize: px(3.2) }}>{card.memberSince}</div>
        </div>
      </div>
    </div>
  );

  const back = (
    <div style={{ display: "flex", position: "relative", width: CARD_W, height: CARD_H, borderRadius: px(4.2), overflow: "hidden", backgroundImage: satoriBase(F.base), color: F.ink }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={crest} width={px(44)} height={Math.round((px(44) * 372) / 328)} style={{ position: "absolute", right: -px(4), top: px(6), opacity: 0.08 }} alt="" />
      <div style={{ position: "absolute", left: 0, right: 0, top: px(6.5), height: px(9), backgroundImage: "linear-gradient(180deg,#121211,#2a2925 45%,#121211)", display: "flex" }} />
      <div style={{ position: "absolute", left: px(6), top: px(20), width: px(24), height: px(24), padding: px(1.4), borderRadius: px(1.2), backgroundImage: "linear-gradient(135deg,#d9b964,#f6e3a3 45%,#d4af58 70%,#efd690)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {qrPngDataUri ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qrPngDataUri} width={px(21.2)} height={px(21.2)} alt="" />
        ) : (
          <div style={{ fontFamily: "Inter", fontSize: px(1.6), color: "#3a2c0c", textAlign: "center", display: "flex" }}>QR issued on activation</div>
        )}
      </div>
      {card.junior ? (
        <div style={{ position: "absolute", left: px(6), top: px(45.5), width: px(24), display: "flex", justifyContent: "center", fontFamily: "Inter", fontWeight: 700, fontSize: px(1.6), letterSpacing: px(0.3), color: "#fff", backgroundColor: "#8e1f24", borderRadius: px(0.5), padding: `${px(0.3)}px 0` }}>UNDER 18</div>
      ) : null}
      <div style={{ position: "absolute", left: px(34), right: px(6), top: px(20), display: "flex", flexDirection: "column" }}>
        <div style={label}>Authorised signature</div>
        <div style={{ marginTop: px(0.8), height: px(5.5), borderRadius: px(0.4), backgroundImage: "repeating-linear-gradient(135deg,#f4ecd8 0px,#f4ecd8 10px,#e9dfc6 10px,#e9dfc6 20px)", display: "flex" }} />
        <div style={{ marginTop: px(2.4), display: "flex" }}>
          <div style={{ display: "flex", flexDirection: "column", marginRight: px(5) }}>
            <div style={label}>Valid thru</div>
            <div style={{ fontFamily: "Inter", fontSize: px(3), letterSpacing: px(0.3) }}>{card.validThru}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={label}>Card no.</div>
            <div style={{ fontFamily: "Inter", fontSize: px(2.2), letterSpacing: px(0.2), marginTop: px(0.4) }}>{card.cardNumber}</div>
          </div>
        </div>
        <div style={{ marginTop: px(2.2), fontFamily: "Inter", fontSize: px(1.45), lineHeight: 1.45, color: F.inkSoft, display: "flex" }}>
          {`Property of ${CLUB.name}. Non-transferable; present on request. Scan the code to verify membership.${card.junior ? " Junior member: no alcohol or tobacco; must be accompanied by a guardian." : ""}`}
        </div>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: px(3.2), display: "flex", justifyContent: "center", fontFamily: "Inter", fontSize: px(1.45), letterSpacing: px(0.15), color: F.inkSoft }}>
        {`${CLUB.email} | ${CLUB.phone} | ${CLUB.website}`}
      </div>
    </div>
  );

  return new ImageResponse(
    (
      <div style={{ display: "flex", width: CARD_W, height: CARD_H, position: "relative", ...(dim ? { filter: "grayscale(85%) brightness(60%)" } : {}) }}>
        {face === "front" ? front : back}
        {stamp ? (
          <div style={{ position: "absolute", left: 0, top: 0, width: CARD_W, height: CARD_H, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ display: "flex", transform: "rotate(-12deg)", border: "6px solid #c9474c", color: "#c9474c", backgroundColor: "rgba(14,15,13,.7)", padding: "16px 48px", fontFamily: "Inter", fontWeight: 700, fontSize: 64, letterSpacing: 20 }}>{stamp}</div>
          </div>
        ) : null}
      </div>
    ),
    { width: CARD_W, height: CARD_H, fonts, headers: { "Cache-Control": "private, no-store" } },
  );
}
