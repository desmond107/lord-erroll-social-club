import { redirect } from "next/navigation";
import { getAdmin } from "@/lib/admin-auth";
import { can, ROLE_LABELS, type Permission } from "@/lib/roles";
import { prisma } from "@/lib/db";
import { AdminNav } from "@/components/admin/AdminNav";

export const metadata = { title: "Administration", robots: { index: false, follow: false } };

const NAV: { href: string; label: string; p: Permission }[] = [
  { href: "/admin", label: "Overview", p: "overview" },
  { href: "/admin/verify", label: "Verify a member", p: "verify" },
  { href: "/admin/applications", label: "Applications", p: "applications" },
  { href: "/admin/members", label: "Members", p: "members.view" },
  { href: "/admin/payments", label: "Payments", p: "payments.view" },
  { href: "/admin/packages", label: "Packages", p: "packages" },
  { href: "/admin/messages", label: "Messages", p: "messaging" },
  { href: "/admin/events", label: "Events", p: "events" },
  { href: "/admin/data-requests", label: "Data requests", p: "members.edit" },
  { href: "/admin/audit", label: "Audit log", p: "audit" },
  { href: "/admin/team", label: "Team", p: "team" },
  { href: "/admin/settings", label: "Settings", p: "settings" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getAdmin();
  if (!user) redirect("/admin/login");
  const [pendingApps, openRequests] = await Promise.all([
    can(user, "applications") ? prisma.application.count({ where: { status: "PENDING" } }) : 0,
    can(user, "members.edit") ? prisma.dataRequest.count({ where: { status: "OPEN" } }) : 0,
  ]);
  const items = NAV.filter((n) => can(user, n.p)).map((n) => ({
    href: n.href,
    label: n.label,
    badge: n.href === "/admin/applications" ? pendingApps : n.href === "/admin/data-requests" ? openRequests : undefined,
  }));
  return (
    <div className="on-paper min-h-screen lg:flex">
      <AdminNav items={items} user={{ name: user.name, role: ROLE_LABELS[user.role] }} />
      <main id="main" className="min-w-0 flex-1 px-4 py-6 sm:px-8 sm:py-8">{children}</main>
    </div>
  );
}
