import "server-only";
import fs from "fs/promises";
import path from "path";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { CLUB } from "./site";

/** Shared PDF setup: brand fonts (pre-subset static TTFs embed reliably) and the crest. */
export async function brandedPdf(title: string) {
  const dir = path.join(process.cwd(), "src/assets/fonts");
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  pdf.setTitle(title);
  pdf.setAuthor(CLUB.name);
  const [serif, sans, sansBold, black, crestPng] = await Promise.all([
    fs.readFile(path.join(dir, "Cormorant-SemiBold.ttf")),
    fs.readFile(path.join(dir, "Inter-Regular.ttf")),
    fs.readFile(path.join(dir, "Inter-SemiBold.ttf")),
    fs.readFile(path.join(dir, "Fraktur.ttf")),
    fs.readFile(path.join(process.cwd(), "public/brand/crest.png")),
  ]);
  const fonts = {
    serif: await pdf.embedFont(serif, { subset: false }),
    sans: await pdf.embedFont(sans, { subset: false }),
    sansBold: await pdf.embedFont(sansBold, { subset: false }),
    black: await pdf.embedFont(black, { subset: false }),
  };
  const crest = await pdf.embedPng(crestPng);
  return { pdf, fonts, crest };
}

export const COL = {
  green: rgb(0.078, 0.263, 0.169),
  gold: rgb(0.788, 0.635, 0.294),
  goldInk: rgb(0.478, 0.353, 0.102),
  ink: rgb(0.11, 0.122, 0.11),
  soft: rgb(0.36, 0.36, 0.33),
  line: rgb(0.886, 0.839, 0.737),
};

/** Text that never contains characters outside the embedded fonts. */
export const clean = (s: string) => s.replace(/[^\x20-\x7E -ÿ–—‘’“”•·]/g, "?");

export function textRight(page: PDFPage, s: string, xRight: number, y: number, font: PDFFont, size: number, color = COL.ink) {
  page.drawText(clean(s), { x: xRight - font.widthOfTextAtSize(clean(s), size), y, size, font, color });
}

export function textCenter(page: PDFPage, s: string, cx: number, y: number, font: PDFFont, size: number, color = COL.ink) {
  page.drawText(clean(s), { x: cx - font.widthOfTextAtSize(clean(s), size) / 2, y, size, font, color });
}
