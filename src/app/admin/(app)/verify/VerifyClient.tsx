"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { verifyByNumber, type VerifyResult } from "./actions";

type Detector = { detect: (src: HTMLVideoElement) => Promise<{ rawValue: string }[]> };

export function VerifyClient() {
  const [state, action, pending] = useActionState<VerifyResult, FormData>(verifyByNumber, null);
  const [scanning, setScanning] = useState(false);
  const [canScan, setCanScan] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => setCanScan("BarcodeDetector" in window && !!navigator.mediaDevices), []);

  useEffect(() => {
    if (!scanning) return;
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        video.current!.srcObject = stream;
        await video.current!.play();
        const det = new (window as unknown as { BarcodeDetector: new (o: object) => Detector }).BarcodeDetector({ formats: ["qr_code"] });
        const loop = async () => {
          if (stopped) return;
          const codes = await det.detect(video.current!).catch(() => []);
          const hit = codes.map((c) => c.rawValue).find((v) => /\/verify\/[A-Za-z0-9_-]{16,40}$/.test(v));
          if (hit) {
            location.href = new URL(hit).pathname; // stay on our own origin
            return;
          }
          raf = requestAnimationFrame(loop);
        };
        loop();
      } catch {
        setScanError("Camera unavailable. Allow camera access, or type the number.");
        setScanning(false);
      }
    })();
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [scanning]);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <form action={action} className="border border-line-light bg-white p-5">
          <label htmlFor="number" className="label">Membership or card number</label>
          <div className="flex gap-3">
            <input id="number" name="number" required autoFocus autoComplete="off" placeholder="LE-2026-000123" className="input font-mono uppercase" />
            <button className="btn btn-green" disabled={pending}>Check</button>
          </div>
        </form>
        <div className="border border-line-light bg-white p-5">
          {canScan ? (
            <>
              <button type="button" className="btn btn-outline w-full" onClick={() => setScanning((v) => !v)}>{scanning ? "Stop camera" : "Scan card QR with camera"}</button>
              {scanning && <video ref={video} className="mt-4 aspect-square w-full bg-black object-cover" muted playsInline aria-label="Camera preview" />}
            </>
          ) : (
            <p className="text-sm text-ink-soft">To scan, open your phone&apos;s camera and point it at the code on the back of the card. While you are signed in here, the verification page shows full details.</p>
          )}
          {scanError && <p className="err">{scanError}</p>}
        </div>
      </div>

      <div aria-live="polite">
        {state && "error" in state && <div className="border-l-4 border-bad bg-white px-4 py-3 text-sm text-bad">{state.error}</div>}
        {state && "ok" in state && (
          <div className={`border-2 bg-white p-5 ${state.ok ? "border-ok" : "border-bad"}`}>
            <div className={`text-center font-serif text-3xl ${state.ok ? "text-ok" : "text-bad"}`}>{state.ok ? "✓ Valid" : "✕ Not valid"}</div>
            <div className="mt-1 text-center text-sm text-ink-soft">{state.statusLabel} · {state.packageName} · until {state.expires}</div>
            {state.holders.some((h) => h.under18) && (
              <div className="mt-4 bg-crimson px-4 py-3 text-center text-white">
                <div className="font-bold tracking-[0.2em] uppercase">Junior: under 18</div>
                <div className="text-xs">No alcohol or tobacco. Not admitted to adult-only events. Must be accompanied by an adult.</div>
              </div>
            )}
            <ul className="mt-4 divide-y divide-line-light">
              {state.holders.map((h) => (
                <li key={h.cardNumber} className="flex items-center gap-4 py-3">
                  {h.photoId ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/api/files/${h.photoId}`} alt={`Photo of ${h.name}`} className="h-16 w-16 border border-line-light object-cover" />
                  ) : <div className="grid h-16 w-16 place-items-center border border-line-light text-[0.6rem] text-ink-soft">No photo</div>}
                  <div>
                    <div className="font-semibold">{h.name}{h.under18 && <span className="ml-2 text-xs font-bold text-crimson">U18</span>}{!h.active && <span className="ml-2 text-xs text-bad">card deactivated</span>}</div>
                    <div className="font-mono text-xs text-ink-soft">{h.cardNumber} · {h.relationship}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
