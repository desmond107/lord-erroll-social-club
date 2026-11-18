"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { guarded, int, str, InputError, type ActionResult } from "@/lib/admin-action";
import { FINISHES } from "@/lib/finishes";
import { audit } from "@/lib/audit";

function parse(fd: FormData) {
  const name = str(fd, "name", 60);
  if (name.length < 2) throw new InputError("Give the package a name.");
  const fee = int(fd, "annualFeeKes");
  if (fee < 0 || fee > 10_000_000) throw new InputError("Enter an annual fee in KES.");
  const finish = str(fd, "finish", 30);
  if (!FINISHES[finish]) throw new InputError("Choose a card finish.");
  const benefits = str(fd, "benefits", 5000).split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 30);
  if (!benefits.length) throw new InputError("List at least one benefit (one per line).");
  const ribbon = str(fd, "ribbon", 30);
  return { name, annualFeeKes: fee, finish, benefits, ribbon, tagline: str(fd, "tagline", 160), maxLinked: Math.max(0, Math.min(8, Number(fd.get("maxLinked")) || 0)) };
}

const refresh = () => {
  revalidatePath("/admin/packages");
  revalidatePath("/membership");
  revalidatePath("/");
};

export async function savePackage(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return guarded("packages", async (u) => {
    const id = str(fd, "id");
    const data = parse(fd);
    const before = await prisma.package.findUniqueOrThrow({ where: { id } });
    await prisma.package.update({ where: { id }, data: { ...data, confirmed: true } });
    await audit(u, "package.update", "Package", id, { from: { fee: before.annualFeeKes, name: before.name }, to: { fee: data.annualFeeKes, name: data.name } });
    refresh();
    return `${data.name} saved.`;
  });
}

export async function createPackage(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return guarded("packages", async (u) => {
    const data = parse(fd);
    const kind = str(fd, "kind") as "MAIN" | "JUNIOR" | "FAMILY";
    if (!["MAIN", "JUNIOR", "FAMILY"].includes(kind)) throw new InputError("Choose a package type.");
    const slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (await prisma.package.findUnique({ where: { slug } })) throw new InputError("A package with that name already exists.");
    const last = await prisma.package.findFirst({ orderBy: { sortOrder: "desc" } });
    const topRank = await prisma.package.findFirst({ where: { kind: "MAIN" }, orderBy: { rank: "desc" } });
    const p = await prisma.package.create({ data: { ...data, slug, kind, rank: kind === "MAIN" ? (topRank?.rank ?? 0) + 1 : 0, sortOrder: (last?.sortOrder ?? 0) + 1, confirmed: true } });
    await audit(u, "package.create", "Package", p.id, { name: p.name, fee: p.annualFeeKes });
    refresh();
    return `${p.name} created.`;
  });
}

export async function toggleActive(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return guarded("packages", async (u) => {
    const id = str(fd, "id");
    const p = await prisma.package.findUniqueOrThrow({ where: { id } });
    await prisma.package.update({ where: { id }, data: { active: !p.active } });
    await audit(u, p.active ? "package.deactivate" : "package.activate", "Package", id);
    refresh();
    return p.active ? `${p.name} deactivated. Existing members keep it until renewal.` : `${p.name} is available again.`;
  });
}

/** Moves a package one place up or down. Main tiers also swap ladder rank. */
export async function move(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return guarded("packages", async (u) => {
    const id = str(fd, "id");
    const dir = str(fd, "dir") === "up" ? -1 : 1;
    const all = await prisma.package.findMany({ orderBy: [{ sortOrder: "asc" }] });
    const i = all.findIndex((p) => p.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= all.length) return "Already at the end.";
    const a = all[i], b = all[j];
    const ops = [
      prisma.package.update({ where: { id: a.id }, data: { sortOrder: b.sortOrder } }),
      prisma.package.update({ where: { id: b.id }, data: { sortOrder: a.sortOrder } }),
    ];
    if (a.kind === "MAIN" && b.kind === "MAIN") {
      ops.push(prisma.package.update({ where: { id: a.id }, data: { rank: b.rank } }), prisma.package.update({ where: { id: b.id }, data: { rank: a.rank } }));
    }
    await prisma.$transaction(ops);
    await audit(u, "package.reorder", "Package", id, { dir });
    refresh();
    return "Order updated.";
  });
}
