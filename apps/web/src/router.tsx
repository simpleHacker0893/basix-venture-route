import { Outlet, Route, Routes } from "react-router";

import { RequireRole } from "./auth/RequireRole";
import { OfflineBanner } from "./components/OfflineBanner";
import { SiteFooter } from "./components/SiteFooter";
import { TopNav } from "./components/TopNav";
import { AdminHome } from "./features/admin/AdminHome";
import { RoleSelect } from "./features/auth/RoleSelect";
import { SignInScreen } from "./features/auth/SignInScreen";
import { AddProjectPage } from "./features/builder/AddProjectPage";
import { ProfilePage } from "./features/builder/ProfilePage";
import { CandidatePage } from "./features/candidate/CandidatePage";
import { HandoffScreen } from "./features/handoff/HandoffScreen";
import { LandingPage } from "./features/landing/LandingPage";
import { RoutePage } from "./features/route/RoutePage";

function Layout() {
  return (
    <div className="flex min-h-screen flex-col bg-ground text-ink">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-card focus:bg-surface-strong focus:px-3 focus:py-2 focus:text-ink focus:ring-2 focus:ring-ring"
      >
        Skip to main content
      </a>
      <OfflineBanner />
      <TopNav />
      <main id="main" tabIndex={-1} className="flex-1 outline-none">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  );
}

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<LandingPage />} />
        <Route path="route" element={<RoutePage />} />
        <Route path="handoff" element={<HandoffScreen />} />
        {/* Clerk's path routing owns the sub-paths (factor steps, SSO callback). */}
        <Route path="sign-in/*" element={<SignInScreen />} />
        <Route path="sign-up/*" element={<SignInScreen />} />
        <Route path="choose-role" element={<RoleSelect />} />
        <Route element={<RequireRole roles={["builder"]} />}>
          <Route path="profile" element={<ProfilePage />} />
          <Route path="profile/projects/new" element={<AddProjectPage />} />
        </Route>
        <Route element={<RequireRole roles={["founder", "admin"]} />}>
          <Route path="builders/:builderId" element={<CandidatePage />} />
        </Route>
        <Route element={<RequireRole roles={["admin"]} />}>
          <Route path="admin" element={<AdminHome />} />
        </Route>
      </Route>
    </Routes>
  );
}
