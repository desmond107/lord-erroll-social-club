"use client";

import { useState } from "react";

export function ShareLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Lord Erroll membership", url });
        return;
      } catch {
        /* cancelled: fall through to copy */
      }
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <input readOnly value={url} aria-label="Verification link" className="min-w-0 flex-1 border border-line-dark bg-charcoal px-3 py-2.5 font-mono text-xs text-on-dark-soft" onFocus={(e) => e.currentTarget.select()} />
      <button type="button" onClick={share} className="btn btn-outline btn-sm">{copied ? "Copied" : "Share / copy"}</button>
    </div>
  );
}
