import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAdmin } from "@/lib/admin-auth";
import { homeFor } from "@/lib/roles";
import { AdminAuthShell, AdminLoginForm } from "./forms";

export const metadata: Metadata = { title: "Staff sign-in", robots: { index: false } };

export default async function AdminLoginPage() {
  const u = await getAdmin();
  if (u) redirect(homeFor(u.role));
  return (
    <AdminAuthShell title="Staff sign-in">
      <AdminLoginForm />
    </AdminAuthShell>
  );
}
