"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { guarded, str, InputError, type ActionResult } from "@/lib/admin-action";
import { audit } from "@/lib/audit";

const refresh = () => {
  revalidatePath("/admin/events");
  revalidatePath("/events");
  revalidatePath("/");
};

function parse(fd: FormData) {
  const title = str(fd, "title", 100);
  const schedule = str(fd, "schedule", 100);
  const description = str(fd, "description", 1000);
  if (title.length < 3 || schedule.length < 3 || description.length < 10) throw new InputError("Fill in the title, schedule and description.");
  return { title, schedule, description, adultOnly: fd.get("adultOnly") === "on", membersOnly: fd.get("membersOnly") === "on", published: fd.get("published") === "on" };
}

export async function saveEvent(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return guarded("events", async (u) => {
    const id = str(fd, "id");
    const data = parse(fd);
    if (id) await prisma.event.update({ where: { id }, data });
    else {
      const last = await prisma.event.findFirst({ orderBy: { sortOrder: "desc" } });
      await prisma.event.create({ data: { ...data, sortOrder: (last?.sortOrder ?? 0) + 1 } });
    }
    await audit(u, id ? "event.update" : "event.create", "Event", id || null, { title: data.title, adultOnly: data.adultOnly });
    refresh();
    return "Event saved.";
  });
}

export async function deleteEvent(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return guarded("events", async (u) => {
    const id = str(fd, "id");
    await prisma.event.delete({ where: { id } });
    await audit(u, "event.delete", "Event", id);
    refresh();
    return "Event deleted.";
  });
}
