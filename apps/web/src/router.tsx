import { useEffect } from "react";
import { Outlet, Route, Routes, useLocation } from "react-router";

import { RequireRole } from "./auth/RequireRole";
import { OfflineBanner } from "./components/OfflineBanner";
import { SiteFooter } from "./components/SiteFooter";
import { TopNav } from "./components/TopNav";
import { AdminHome } from "./features/admin/AdminHome";
import { RoleSelect } from "./features/auth/RoleSelect";
import { SignInScreen } from "./features/auth/SignInScreen";
import { BookingProposePage } from "./features/booking/BookingProposePage";
import { BookingStatusPage } from "./features/booking/BookingStatusPage";
import { AddProjectPage } from "./features/builder/AddProjectPage";
import { ProfilePage } from "./features/builder/ProfilePage";
import { CandidatePage } from "./features/candidate/CandidatePage";
import { DashboardPage } from "./features/dashboard/DashboardPage";
import { EcosystemPage } from "./features/ecosystem/EcosystemPage";
import { HandoffScreen } from "./features/handoff/HandoffScreen";
import { LandingPage } from "./features/landing/LandingPage";
import { PrivacyPage } from "./features/legal/PrivacyPage";
import { RequestsBoard } from "./features/requests/RequestsBoard";
import { RoutePage } from "./features/route/RoutePage";

/**
 * The header and footer link to landing and ecosystem sections by hash (`/#evidence`,
 * `/ecosystem#partners`). A history push never scrolls on its own, so after every navigation
 * with a hash the named element is scrolled into view; without one, a new path starts at the top.
 */
function ScrollToHash() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      document.getElementById(hash.slice(1))?.scrollIntoView({ block: "start" });
    } else if (typeof window.scrollTo === "function") {
      try {
        window.scrollTo({ top: 0 });
      } catch {
        // jsdom and older browsers: nothing to restore
      }
    }
  }, [pathname, hash]);
  return null;
}

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
      <ScrollToHash />
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
        {/* Footer destinations (D-36): the Ecosystem column and Privacy. */}
        <Route path="ecosystem" element={<EcosystemPage />} />
        <Route path="privacy" element={<PrivacyPage />} />
        {/* Clerk's path routing owns the sub-paths (factor steps, SSO callback). */}
        <Route path="sign-in/*" element={<SignInScreen />} />
        <Route path="sign-up/*" element={<SignInScreen />} />
        <Route path="choose-role" element={<RoleSelect />} />
        <Route element={<RequireRole roles={["builder"]} />}>
          <Route path="profile" element={<ProfilePage />} />
          <Route path="profile/projects/new" element={<AddProjectPage />} />
          {/* Sprint 004 screen 10: the requests board with the engine's eligibility verdicts. */}
          <Route path="requests" element={<RequestsBoard />} />
        </Route>
        <Route element={<RequireRole roles={["founder", "admin"]} />}>
          <Route path="builders/:builderId" element={<CandidatePage />} />
        </Route>
        <Route element={<RequireRole roles={["founder"]} />}>
          {/* Sprint 004 screen 11: the founder dashboard fed by GET /api/me/dashboard. */}
          <Route path="dashboard" element={<DashboardPage />} />
          {/* Sprint 004 screen 13, propose variant: ?builder=<slug>&request=<id>. */}
          <Route path="bookings/new" element={<BookingProposePage />} />
        </Route>
        <Route element={<RequireRole roles={["founder", "builder"]} />}>
          {/* Sprint 004 screen 13, status and counter variants, for either party. */}
          <Route path="bookings/:bookingId" element={<BookingStatusPage />} />
        </Route>
        <Route element={<RequireRole roles={["admin"]} />}>
          <Route path="admin" element={<AdminHome />} />
        </Route>
      </Route>
    </Routes>
  );
}
