import "server-only";
import { prisma } from "./db";

export async function activePackages() {
  const all = await prisma.package.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { rank: "asc" }] });
  return {
    all,
    main: all.filter((p) => p.kind === "MAIN").sort((a, b) => a.rank - b.rank),
    special: all.filter((p) => p.kind !== "MAIN"),
  };
}

export async function publishedEvents() {
  return prisma.event.findMany({ where: { published: true }, orderBy: { sortOrder: "asc" } });
}
