import { Outlet, Route, Routes } from "react-router";

import { OfflineBanner } from "./components/OfflineBanner";
import { SiteFooter } from "./components/SiteFooter";
import { TopNav } from "./components/TopNav";
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
      </Route>
    </Routes>
  );
}
