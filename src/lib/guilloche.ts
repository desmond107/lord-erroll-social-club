/**
 * Banknote-style guilloché engraving for the membership card, as an SVG string
 * (viewBox 856 × 540 = 85.6 × 54 mm × 10). Deterministic, so server PNGs and the
 * on-screen card match. Used as a background layer at low opacity.
 */
const f = (n: number) => n.toFixed(1);

function wavePaths() {
  const out: string[] = [];
  for (let i = 0; i < 30; i++) {
    const y0 = -10 + i * 19;
    let d = "";
    for (let x = 0; x <= 856; x += 8) {
      const y = y0 + 6 * Math.sin(x / 38 + i * 0.55) + 3.5 * Math.sin(x / 91 + i * 1.3);
      d += `${x === 0 ? "M" : "L"}${f(x)} ${f(y)}`;
    }
    out.push(d);
  }
  return out;
}

/** Epitrochoid rosette. R/r integer → closes after one revolution. */
function rosette(cx: number, cy: number, R: number, r: number, d: number, steps = 900) {
  let s = "";
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const x = cx + (R + r) * Math.cos(t) - d * Math.cos(((R + r) / r) * t);
    const y = cy + (R + r) * Math.sin(t) - d * Math.sin(((R + r) / r) * t);
    s += `${i === 0 ? "M" : "L"}${f(x)} ${f(y)}`;
  }
  return s;
}

export function guillocheSvg(stroke: string, opts: { rosetteX?: number; rosetteY?: number } = {}) {
  const rx = opts.rosetteX ?? 210;
  const ry = opts.rosetteY ?? 255;
  const waves = wavePaths()
    .map((d) => `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="0.7"/>`)
    .join("");
  const ros = [
    rosette(rx, ry, 120, 10, 34),
    rosette(rx, ry, 102, 12, 30),
    rosette(rx, ry, 84, 7, 22),
  ]
    .map((d) => `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="0.6"/>`)
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 856 540" preserveAspectRatio="none">${waves}${ros}</svg>`;
}

export const svgDataUri = (svg: string) => `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
export const svgDataUriBrowser = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
