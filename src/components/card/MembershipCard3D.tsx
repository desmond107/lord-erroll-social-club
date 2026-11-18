"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { finishFor } from "@/lib/finishes";
import { guillocheSvg, svgDataUriBrowser } from "@/lib/guilloche";
import { CLUB } from "@/lib/site";

export type CardData = {
  finish: string;
  packageName: string;
  /** Printed name (first name only for juniors). */
  displayName: string;
  cardNumber: string;
  memberSince: string; // "2026"
  validThru: string; // "MM/YY"
  /** "ACTIVE" | "GRACE" | "EXPIRED" | "PENDING" | "SUSPENDED" | "CANCELLED" */
  status: string;
  /** Inline SVG markup for the QR code (dark modules, transparent background). */
  qrSvg?: string | null;
  junior?: boolean;
  /** Family: this card belongs to a linked (joint) member. */
  jointOf?: string | null;
};

const EDGE_LAYERS = 7;

/**
 * Photoreal 3D membership card, built with CSS 3D transforms (crisp text at any size,
 * no WebGL bundle). Drag or swipe to rotate, release to settle on the nearest face,
 * tap "Turn over" to flip. On phones it can follow the device's tilt.
 */
export function MembershipCard3D({ card, interactive = true, autoSpin = false, className = "" }: { card: CardData; interactive?: boolean; autoSpin?: boolean; className?: string }) {
  const F = finishFor(card.finish);
  const [rot, setRot] = useState({ x: -8, y: autoSpin ? -26 : -14 });
  const [dragging, setDragging] = useState(false);
  const [tiltOn, setTiltOn] = useState(false);
  const [canTilt, setCanTilt] = useState(false);
  const start = useRef<{ px: number; py: number; x: number; y: number } | null>(null);
  const face = useRef(0); // 0 front, 180 back
  const wrap = useRef<HTMLDivElement>(null);

  const dim = card.status === "EXPIRED" || card.status === "SUSPENDED" || card.status === "CANCELLED";
  const stamp = { EXPIRED: "Expired", SUSPENDED: "Suspended", CANCELLED: "Cancelled", PENDING: "Pending activation" }[card.status];

  const guilloche = useMemo(() => svgDataUriBrowser(guillocheSvg(F.guilloche)), [F.guilloche]);

  useEffect(() => {
    setCanTilt(typeof window !== "undefined" && "DeviceOrientationEvent" in window && matchMedia("(pointer: coarse)").matches);
  }, []);

  // Gentle idle sway (not while interacting); respects reduced motion.
  useEffect(() => {
    if (!autoSpin || dragging || tiltOn || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const t0 = performance.now();
    const loop = (t: number) => {
      const s = (t - t0) / 1000;
      setRot({ x: -8 + Math.sin(s * 0.5) * 4, y: face.current - 18 + Math.sin(s * 0.35) * 22 });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [autoSpin, dragging, tiltOn]);

  // Device tilt.
  useEffect(() => {
    if (!tiltOn) return;
    const on = (e: DeviceOrientationEvent) => {
      const beta = Math.max(-35, Math.min(35, (e.beta ?? 45) - 45));
      const gamma = Math.max(-40, Math.min(40, e.gamma ?? 0));
      setRot({ x: -beta * 0.6, y: face.current + gamma * 0.9 });
    };
    window.addEventListener("deviceorientation", on);
    return () => window.removeEventListener("deviceorientation", on);
  }, [tiltOn]);

  const enableTilt = useCallback(async () => {
    if (tiltOn) return setTiltOn(false);
    const DOE = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> };
    if (typeof DOE.requestPermission === "function") {
      try {
        if ((await DOE.requestPermission()) !== "granted") return;
      } catch {
        return;
      }
    }
    setTiltOn(true);
  }, [tiltOn]);

  const onDown = (e: React.PointerEvent) => {
    if (!interactive) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    start.current = { px: e.clientX, py: e.clientY, x: rot.x, y: rot.y };
    setDragging(true);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!interactive) return;
    if (start.current) {
      const dx = e.clientX - start.current.px;
      const dy = e.clientY - start.current.py;
      setRot({ x: Math.max(-40, Math.min(40, start.current.x - dy * 0.35)), y: start.current.y + dx * 0.55 });
    } else if (e.pointerType === "mouse" && !autoSpin && !tiltOn) {
      const r = wrap.current!.getBoundingClientRect();
      const nx = (e.clientX - r.left) / r.width - 0.5;
      const ny = (e.clientY - r.top) / r.height - 0.5;
      setRot({ x: -ny * 18, y: face.current + nx * 26 });
    }
  };
  const onUp = () => {
    if (!start.current) return;
    start.current = null;
    setDragging(false);
    // Settle on the nearest face.
    setRot((r) => {
      const snapped = Math.round(r.y / 180) * 180;
      face.current = ((snapped % 360) + 360) % 360;
      return { x: -6, y: snapped - 10 };
    });
  };
  const onLeave = () => {
    if (!start.current && !autoSpin && !tiltOn) setRot({ x: -6, y: face.current - 10 });
  };
  const flip = () => {
    setRot((r) => {
      const next = Math.round(r.y / 180) * 180 + 180;
      face.current = ((next % 360) + 360) % 360;
      return { x: -6, y: next - 10 };
    });
  };

  // Specular sweep: position follows the rotation, so the foil "catches the light".
  const sweep = ((((rot.y % 360) + 360) % 360) / 360) * 200 - 50 + rot.x;

  const faceBase: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    borderRadius: "4.2cqw",
    overflow: "hidden",
    backfaceVisibility: "hidden",
    WebkitBackfaceVisibility: "hidden",
    background: F.base,
    color: F.ink,
    boxShadow: `inset 0 0 0 0.25cqw ${F.foil}55, inset 0 0 6cqw rgba(0,0,0,.25)`,
  };

  const Sheen = (
    <>
      {/* brushed-metal grain */}
      <div aria-hidden style={{ position: "absolute", inset: 0, opacity: 0.2, mixBlendMode: "overlay", background: "repeating-linear-gradient(90deg,rgba(255,255,255,.18) 0 1px,rgba(0,0,0,.12) 1px 2px,transparent 2px 4px)" }} />
      {/* holographic sheen */}
      {F.holo > 0 && (
        <div aria-hidden style={{ position: "absolute", inset: 0, opacity: F.holo, mixBlendMode: "color-dodge", background: `linear-gradient(${110 + rot.y * 0.4}deg, transparent 20%, rgba(120,255,214,.35) 35%, rgba(255,160,230,.35) 48%, rgba(140,180,255,.35) 60%, transparent 75%)` }} />
      )}
      {/* moving specular sweep */}
      <div aria-hidden style={{ position: "absolute", inset: 0, mixBlendMode: "soft-light", background: `linear-gradient(115deg, transparent ${sweep - 22}%, rgba(255,250,225,.85) ${sweep}%, transparent ${sweep + 22}%)` }} />
    </>
  );

  return (
    <div className={`select-none ${className}`}>
      <div
        ref={wrap}
        className="relative mx-auto w-full touch-pan-y"
        style={{ perspective: "1400px", aspectRatio: "85.6 / 54", containerType: "inline-size", cursor: interactive ? (dragging ? "grabbing" : "grab") : "default" }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onPointerLeave={onLeave}
        role="img"
        aria-label={`${CLUB.name} ${card.packageName} membership card for ${card.displayName}, number ${card.cardNumber}, valid through ${card.validThru}. Status: ${stamp ?? "Active"}.`}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            transformStyle: "preserve-3d",
            transform: `rotateX(${rot.x}deg) rotateY(${rot.y}deg)`,
            transition: dragging || tiltOn || autoSpin ? "none" : "transform 1.1s cubic-bezier(.22,1,.36,1)",
            filter: dim ? "grayscale(.85) brightness(.55) contrast(.9)" : undefined,
          }}
        >
          {/* Edge thickness: stacked slices between the faces. */}
          {Array.from({ length: EDGE_LAYERS }, (_, i) => (
            <div key={i} aria-hidden style={{ position: "absolute", inset: 0, borderRadius: "4.2cqw", background: F.edge, transform: `translateZ(${(i - (EDGE_LAYERS - 1) / 2) * 0.55}px)` }} />
          ))}

          {/* ── FRONT ── */}
          <div style={{ ...faceBase, transform: `translateZ(${EDGE_LAYERS * 0.3}px)` }}>
            <div aria-hidden style={{ position: "absolute", inset: 0, backgroundImage: `url("${guilloche}")`, backgroundSize: "100% 100%" }} />
            <div aria-hidden className="fleur-pattern" style={{ position: "absolute", inset: 0, opacity: 0.55, backgroundSize: "7cqw 7cqw" }} />
            {/* hand-polished edge line */}
            <div aria-hidden style={{ position: "absolute", inset: "2.6cqw", borderRadius: "2.6cqw", border: `0.18cqw solid ${F.foil}`, opacity: 0.55 }} />
            {/* holographic security strip */}
            <div aria-hidden style={{ position: "absolute", top: 0, bottom: 0, left: "62%", width: "3.2cqw", opacity: 0.22 + F.holo * 0.4, background: `linear-gradient(${180 + rot.y}deg, #9ff2d6, #f6c1ec, #b9d1ff, #fff2b3, #9ff2d6)`, mixBlendMode: "screen" }} />

            {/* crest, embossed */}
            <div style={{ position: "absolute", left: "7.5cqw", top: "9.5cqw", width: "21cqw" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/crest.png"
                alt=""
                draggable={false}
                style={{ width: "100%", height: "auto", filter: `drop-shadow(0 0.35cqw 0.25cqw rgba(0,0,0,.55)) drop-shadow(0 -0.12cqw 0.08cqw rgba(255,240,200,.45)) ${card.finish === "gold" ? "saturate(1.05)" : ""}` }}
              />
            </div>

            {/* wordmark */}
            <div style={{ position: "absolute", left: "32cqw", top: "13cqw", right: "6cqw" }}>
              <div className="blackletter" style={{ fontSize: "7.4cqw", lineHeight: 1, color: F.ink, textShadow: `0 0.12cqw 0 rgba(0,0,0,.35), 0 -0.06cqw 0 rgba(255,255,255,.18)` }}>
                The Lord Erroll
              </div>
              <div style={{ marginTop: "1.6cqw", fontFamily: "var(--font-cormorant)", fontWeight: 600, fontSize: "2.5cqw", letterSpacing: "0.9cqw", textTransform: "uppercase", color: F.inkSoft }}>
                Social Club
              </div>
            </div>

            {/* nameplate */}
            <div
              style={{
                position: "absolute", top: "5cqw", right: "5.5cqw", padding: "0.8cqw 2.2cqw", borderRadius: "0.6cqw",
                background: F.foilGradient, boxShadow: "0 0.25cqw 0.5cqw rgba(0,0,0,.35), inset 0 0.1cqw 0 rgba(255,255,255,.5)",
                fontSize: "1.9cqw", fontWeight: 800, letterSpacing: "0.5cqw", textTransform: "uppercase",
                color: card.finish === "gold" ? "#f3dc8e" : card.finish === "bronze" ? "#f0d2ad" : "#1a1407",
              }}
            >
              {card.packageName}
            </div>

            {/* holder */}
            <div style={{ position: "absolute", left: "7.5cqw", right: "6cqw", bottom: "6.2cqw", display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "3cqw" }}>
              <div style={{ minWidth: 0 }}>
                {card.jointOf && <div style={{ fontSize: "1.55cqw", letterSpacing: "0.3cqw", textTransform: "uppercase", color: F.inkSoft }}>Joint Member · {card.jointOf}</div>}
                <div style={{ fontFamily: "var(--font-cormorant)", fontWeight: 600, fontSize: "4.1cqw", lineHeight: 1.1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textShadow: `0 0.1cqw 0 rgba(0,0,0,.4), 0 -0.05cqw 0 rgba(255,255,255,.2)` }}>
                  {card.displayName}
                </div>
                <div style={{ marginTop: "0.8cqw", fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace", fontSize: "2.5cqw", letterSpacing: "0.35cqw", textShadow: "0 0.1cqw 0 rgba(0,0,0,.35)" }}>
                  {card.cardNumber}
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontSize: "1.45cqw", letterSpacing: "0.3cqw", textTransform: "uppercase", color: F.inkSoft }}>Member since</div>
                <div style={{ fontFamily: "var(--font-cormorant)", fontWeight: 600, fontSize: "3.2cqw", lineHeight: 1.1 }}>{card.memberSince}</div>
              </div>
            </div>
            {Sheen}
          </div>

          {/* ── BACK ── */}
          <div style={{ ...faceBase, transform: `rotateY(180deg) translateZ(${EDGE_LAYERS * 0.3}px)`, filter: "saturate(.9) brightness(.92)" }}>
            <div aria-hidden className="fleur-pattern" style={{ position: "absolute", inset: 0, opacity: 0.4, backgroundSize: "7cqw 7cqw" }} />
            {/* faint crest watermark */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/crest.png" alt="" draggable={false} style={{ position: "absolute", right: "-4cqw", top: "6cqw", width: "44cqw", opacity: 0.07, filter: "grayscale(1)" }} />
            <div aria-hidden style={{ position: "absolute", left: 0, right: 0, top: "6.5cqw", height: "9cqw", background: "linear-gradient(180deg,#121211,#2a2925 45%,#121211)" }} />

            {/* QR on a gold-foil plate (dark modules on light gold scan reliably) */}
            <div style={{ position: "absolute", left: "6cqw", top: "20cqw", width: "24cqw", height: "24cqw", padding: "1.4cqw", borderRadius: "1.2cqw", background: "linear-gradient(135deg,#d9b964,#f6e3a3 45%,#d4af58 70%,#efd690)", boxShadow: "0 0.3cqw 0.6cqw rgba(0,0,0,.35)" }}>
              {card.qrSvg ? (
                <div style={{ width: "100%", height: "100%" }} dangerouslySetInnerHTML={{ __html: card.qrSvg }} />
              ) : (
                <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", fontSize: "1.6cqw", color: "#3a2c0c", textAlign: "center" }}>QR issued on activation</div>
              )}
            </div>
            {card.junior && (
              <div style={{ position: "absolute", left: "6cqw", top: "45.5cqw", width: "24cqw", textAlign: "center", fontSize: "1.6cqw", fontWeight: 800, letterSpacing: "0.3cqw", color: "#fff", background: "#8e1f24", borderRadius: "0.5cqw", padding: "0.3cqw 0" }}>
                UNDER 18
              </div>
            )}

            <div style={{ position: "absolute", left: "34cqw", right: "6cqw", top: "20cqw" }}>
              <div style={{ fontSize: "1.5cqw", letterSpacing: "0.3cqw", textTransform: "uppercase", color: F.inkSoft }}>Authorised signature</div>
              <div style={{ marginTop: "0.8cqw", height: "5.5cqw", borderRadius: "0.4cqw", background: "repeating-linear-gradient(135deg,#f4ecd8 0 0.6cqw,#e9dfc6 0.6cqw 1.2cqw)" }} />
              <div style={{ marginTop: "2.4cqw", display: "flex", gap: "5cqw" }}>
                <div>
                  <div style={{ fontSize: "1.5cqw", letterSpacing: "0.3cqw", textTransform: "uppercase", color: F.inkSoft }}>Valid thru</div>
                  <div style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: "3cqw", letterSpacing: "0.3cqw" }}>{card.validThru}</div>
                </div>
                <div>
                  <div style={{ fontSize: "1.5cqw", letterSpacing: "0.3cqw", textTransform: "uppercase", color: F.inkSoft }}>Card no.</div>
                  <div style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: "2.2cqw", letterSpacing: "0.2cqw", marginTop: "0.4cqw" }}>{card.cardNumber}</div>
                </div>
              </div>
              <p style={{ marginTop: "2.2cqw", fontSize: "1.45cqw", lineHeight: 1.45, color: F.inkSoft }}>
                Property of {CLUB.name}. Non-transferable; present on request. Scan the code to verify membership.
                {card.junior ? " Junior member: no alcohol or tobacco; must be accompanied by a guardian." : ""}
              </p>
            </div>
            <div style={{ position: "absolute", left: 0, right: 0, bottom: "3.2cqw", textAlign: "center", fontSize: "1.45cqw", letterSpacing: "0.15cqw", color: F.inkSoft }}>
              {CLUB.email} | {CLUB.phone} | {CLUB.website}
            </div>
            {Sheen}
          </div>
        </div>

        {stamp && (
          <div aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center">
            <span className="rotate-[-12deg] border-2 border-crimson-bright bg-charcoal/70 px-5 py-1.5 text-sm font-extrabold tracking-[0.35em] text-crimson-bright uppercase sm:text-base">
              {stamp}
            </span>
          </div>
        )}
      </div>

      {interactive && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <button type="button" onClick={flip} className="btn btn-outline btn-sm">
            Turn over
          </button>
          {canTilt && (
            <button type="button" onClick={enableTilt} className="btn btn-outline btn-sm" aria-pressed={tiltOn}>
              {tiltOn ? "Stop tilt" : "Tilt with phone"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
