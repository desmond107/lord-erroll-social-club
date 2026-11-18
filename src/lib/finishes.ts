/**
 * Card finishes, one per package. Used by the 3D card (CSS), the PNG/PDF export and the
 * package cards on the website. Colours follow the brief's per-tier material notes.
 */
export type Finish = {
  key: string;
  label: string;
  /** Base surface gradient. */
  base: string;
  /** Text / engraving colour. */
  ink: string;
  /** Secondary text. */
  inkSoft: string;
  /** Foil colour for rules, nameplate and edges. */
  foil: string;
  /** Foil gradient for the nameplate and crest glow. */
  foilGradient: string;
  /** Guilloché line colour (rgba). */
  guilloche: string;
  /** Card edge colour, for the visible thickness. */
  edge: string;
  /** Optional holographic sheen strength 0–1. */
  holo: number;
  /** Swatch for admin pickers and the website. */
  swatch: string;
};

const GOLD_FOIL = "linear-gradient(135deg,#8a6a24 0%,#f3dc8e 28%,#c9a24b 50%,#fff1b8 66%,#a07c2c 100%)";

export const FINISHES: Record<string, Finish> = {
  emerald: {
    key: "emerald",
    label: "Emerald and gold",
    base: "radial-gradient(120% 140% at 20% 10%,#1f7a4c 0%,#0f4a2d 45%,#072a19 100%)",
    ink: "#f3dc8e",
    inkSoft: "rgba(243,220,142,.72)",
    foil: "#d9b45a",
    foilGradient: GOLD_FOIL,
    guilloche: "rgba(243,220,142,.16)",
    edge: "#0a3a22",
    holo: 0.15,
    swatch: "#0f4a2d",
  },
  bronze: {
    key: "bronze",
    label: "Brushed bronze",
    base: "linear-gradient(135deg,#6b3f1d 0%,#b07440 38%,#8a552a 62%,#4e2c12 100%)",
    ink: "#2a1608",
    inkSoft: "rgba(42,22,8,.7)",
    foil: "#5a3416",
    foilGradient: "linear-gradient(135deg,#3d220c 0%,#9a6532 40%,#6e421c 60%,#2f1907 100%)",
    guilloche: "rgba(40,20,6,.18)",
    edge: "#4e2c12",
    holo: 0,
    swatch: "#a06a3a",
  },
  silver: {
    key: "silver",
    label: "Polished silver",
    base: "linear-gradient(135deg,#9ea3a8 0%,#e9ecef 30%,#c3c8cd 52%,#f6f7f8 70%,#8d9297 100%)",
    ink: "#2b2f33",
    inkSoft: "rgba(43,47,51,.7)",
    foil: "#6b7177",
    foilGradient: "linear-gradient(135deg,#8d9297 0%,#ffffff 35%,#b9bec3 55%,#f2f4f6 72%,#7d8287 100%)",
    guilloche: "rgba(43,47,51,.14)",
    edge: "#7d8287",
    holo: 0.08,
    swatch: "#c3c8cd",
  },
  gold: {
    key: "gold",
    label: "24k brushed gold",
    base: "linear-gradient(135deg,#a77d22 0%,#f0d27a 30%,#c99a35 52%,#f7e3a0 70%,#97701d 100%)",
    ink: "#141412",
    inkSoft: "rgba(20,20,18,.72)",
    foil: "#141412",
    foilGradient: "linear-gradient(135deg,#0d2b1c 0%,#1f5e3a 45%,#141412 100%)",
    guilloche: "rgba(30,22,4,.16)",
    edge: "#8a6519",
    holo: 0,
    swatch: "#d6ac4a",
  },
  platinum: {
    key: "platinum",
    label: "Platinum with holographic sheen",
    base: "linear-gradient(135deg,#c9ccd1 0%,#f4f5f7 25%,#dfe2e6 45%,#fbfbfc 62%,#b8bcc2 100%)",
    ink: "#1d2226",
    inkSoft: "rgba(29,34,38,.68)",
    foil: "#e9e4d6",
    foilGradient: "linear-gradient(135deg,#d9d4c4 0%,#ffffff 30%,#efe9d8 50%,#ffffff 68%,#c7c1b0 100%)",
    guilloche: "rgba(29,34,38,.12)",
    edge: "#a9adb3",
    holo: 0.45,
    swatch: "#e2e4e8",
  },
  junior: {
    key: "junior",
    label: "Matte emerald and cream",
    base: "linear-gradient(160deg,#f6efdc 0%,#f6efdc 52%,#1f6b45 52.2%,#174f34 100%)",
    ink: "#174f34",
    inkSoft: "rgba(23,79,52,.72)",
    foil: "#c9a24b",
    foilGradient: "linear-gradient(135deg,#b48f3e 0%,#f1dd9d 40%,#cfae5c 60%,#a98536 100%)",
    guilloche: "rgba(23,79,52,.1)",
    edge: "#174f34",
    holo: 0,
    swatch: "#2a7a50",
  },
  family: {
    key: "family",
    label: "Black and gold dual-tone",
    base: "linear-gradient(115deg,#0d0d0c 0%,#1b1a17 54%,#2a2414 54.2%,#3a3018 100%)",
    ink: "#e6c873",
    inkSoft: "rgba(230,200,115,.72)",
    foil: "#d9b45a",
    foilGradient: GOLD_FOIL,
    guilloche: "rgba(230,200,115,.12)",
    edge: "#0d0d0c",
    holo: 0.1,
    swatch: "#1b1a17",
  },
  onyx: {
    key: "onyx",
    label: "Matte black and gold",
    base: "radial-gradient(120% 140% at 20% 10%,#2a2a28 0%,#161615 55%,#0b0b0a 100%)",
    ink: "#e6c873",
    inkSoft: "rgba(230,200,115,.7)",
    foil: "#d9b45a",
    foilGradient: GOLD_FOIL,
    guilloche: "rgba(230,200,115,.12)",
    edge: "#0b0b0a",
    holo: 0.12,
    swatch: "#161615",
  },
};

export const finishFor = (key: string) => FINISHES[key] ?? FINISHES.emerald;
