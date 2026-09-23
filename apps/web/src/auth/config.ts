/**
 * Clerk wiring facts (D-03, D-26). The publishable key arrives only through the environment; an
 * empty value or the `.env.example` placeholder means "not configured" and the app mounts without
 * Clerk so the Sprint 002 routing floor keeps working.
 */
export type Role = "founder" | "builder" | "admin";

export const ROLES: readonly Role[] = ["founder", "builder", "admin"];

/** Where each role lands after sign-in, role choice, or a wrong-role redirect. */
export const ROLE_HOME: Record<Role, string> = {
  founder: "/route",
  builder: "/profile",
  admin: "/admin",
};

export const CLERK_PUBLISHABLE_KEY: string = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ?? "";

export function isClerkConfigured(key: string | undefined): boolean {
  const value = (key ?? "").trim();
  return value !== "" && !value.endsWith("replace-me");
}

export function parseRole(value: unknown): Role | null {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value) ? (value as Role) : null;
}
