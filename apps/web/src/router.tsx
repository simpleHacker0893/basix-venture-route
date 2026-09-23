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
      <OfflineBanner />
      <TopNav />
      <main className="flex-1">
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
