/**
 * Role gate around an <Outlet /> (D-03). Signed out → /sign-in; signed in without a role →
 * /choose-role; wrong role → that role's own home. Without a Clerk key it explains where the key
 * lives instead of failing.
 */
import { Navigate, Outlet } from "react-router";

import { SiteFooter } from "../components/SiteFooter";
import { TopNav } from "../components/TopNav";
import { NotConfiguredPanel } from "../features/auth/NotConfiguredPanel";
import { useAuthState } from "./authContext";
import { ROLE_HOME, type Role } from "./config";

/** The public header and footer around the gate's own screens (no key, loading). */
function GateFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-ground text-ink">
      <TopNav />
      <main id="main" tabIndex={-1} className="flex-1 outline-none">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}

export function RequireRole({ roles }: { roles: readonly Role[] }) {
  const auth = useAuthState();
  if (!auth.configured) {
    return (
      <GateFrame>
        <div className="mx-auto w-full max-w-[1200px] px-6 py-12">
          <NotConfiguredPanel />
        </div>
      </GateFrame>
    );
  }
  if (!auth.isLoaded) {
    return (
      <GateFrame>
        <p className="mx-auto w-full max-w-[1200px] px-6 py-12 text-sm text-ink-muted" aria-live="polite">
          Loading…
        </p>
      </GateFrame>
    );
  }
  if (!auth.isSignedIn) return <Navigate to="/sign-in" replace />;
  if (auth.role === null) return <Navigate to="/choose-role" replace />;
  if (!roles.includes(auth.role)) return <Navigate to={ROLE_HOME[auth.role]} replace />;
  return <Outlet />;
}
