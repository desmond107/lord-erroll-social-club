import { requireAdmin } from "@/lib/admin-auth";
import { PageTitle } from "@/components/admin/ui";
import { VerifyClient } from "./VerifyClient";

export default async function VerifyPage() {
  await requireAdmin("verify");
  return (
    <div className="max-w-5xl">
      <PageTitle title="Verify a member" sub="Check a card at the door. Every check is recorded in the audit log." />
      <VerifyClient />
    </div>
  );
}
