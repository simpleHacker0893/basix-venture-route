/**
 * Role gate around an <Outlet /> (D-03). Signed out → /sign-in; signed in without a role →
 * /choose-role; wrong role → that role's own home. Without a Clerk key it explains where the key
 * lives instead of failing.
 */
import { Navigate, Outlet } from "react-router";

import { NotConfiguredPanel } from "../features/auth/NotConfiguredPanel";
import { useAuthState } from "./authContext";
import { ROLE_HOME, type Role } from "./config";

export function RequireRole({ roles }: { roles: readonly Role[] }) {
  const auth = useAuthState();
  if (!auth.configured) {
    return (
      <div className="mx-auto w-full max-w-[1200px] px-6 py-12">
        <NotConfiguredPanel />
      </div>
    );
  }
  if (!auth.isLoaded) {
    return (
      <p className="mx-auto w-full max-w-[1200px] px-6 py-12 text-sm text-ink-muted" aria-live="polite">
        Loading…
      </p>
    );
  }
  if (!auth.isSignedIn) return <Navigate to="/sign-in" replace />;
  if (auth.role === null) return <Navigate to="/choose-role" replace />;
  if (!roles.includes(auth.role)) return <Navigate to={ROLE_HOME[auth.role]} replace />;
  return <Outlet />;
}
