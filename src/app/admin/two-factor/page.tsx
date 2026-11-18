import { redirect } from "next/navigation";
import { getPending2fa } from "@/lib/admin-auth";
import { AdminAuthShell, TwoFactorForm } from "../login/forms";

export default async function TwoFactorPage() {
  if (!(await getPending2fa())) redirect("/admin/login");
  return (
    <AdminAuthShell title="Two-factor check">
      <TwoFactorForm />
    </AdminAuthShell>
  );
}
