import type { AdminRole } from "@prisma/client";

/**
 * Role permissions. Enforced on the server in every admin page, action and route
 * (requireAdmin / assertAdmin); the navigation just hides what a role can't open.
 */
export type Permission =
  | "overview"
  | "verify" // look up and verify members at the door
  | "applications"
  | "members.view"
  | "members.edit" // edit details, suspend, reinstate, extend
  | "packages"
  | "payments.view"
  | "payments.confirm" // manual cash/bank confirmation
  | "messaging"
  | "events"
  | "audit"
  | "team"
  | "settings"
  | "documents.sensitive"; // junior DOB proofs and ID documents

const MATRIX: Record<AdminRole, Permission[]> = {
  SUPER_ADMIN: [
    "overview", "verify", "applications", "members.view", "members.edit", "packages", "payments.view",
    "payments.confirm", "messaging", "events", "audit", "team", "settings", "documents.sensitive",
  ],
  MANAGER: ["overview", "verify", "applications", "members.view", "members.edit", "packages", "payments.view", "messaging", "events"],
  FRONT_DESK: ["verify"],
  ACCOUNTANT: ["payments.view", "payments.confirm"],
};

export function can(user: { role: AdminRole } | null | undefined, p: Permission) {
  return !!user && MATRIX[user.role].includes(p);
}

export const ROLE_LABELS: Record<AdminRole, string> = {
  SUPER_ADMIN: "Super Admin",
  MANAGER: "Manager",
  FRONT_DESK: "Front desk / Reception",
  ACCOUNTANT: "Accountant",
};

export const ROLE_DESCRIPTIONS: Record<AdminRole, string> = {
  SUPER_ADMIN: "Everything, including team, settings, audit log and junior documents.",
  MANAGER: "Applications, members, packages, messaging and events. No team or settings.",
  FRONT_DESK: "Verify members at the door only.",
  ACCOUNTANT: "Payment ledger, exports and manual payment confirmation only.",
};

/** The first page a role lands on. */
export function homeFor(role: AdminRole) {
  return role === "FRONT_DESK" ? "/admin/verify" : role === "ACCOUNTANT" ? "/admin/payments" : "/admin";
}
