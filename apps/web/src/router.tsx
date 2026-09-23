import { Link, Outlet, Route, Routes } from "react-router";

import { TopNav } from "./components/TopNav";

function Layout() {
  return (
    <div className="min-h-screen bg-ground text-ink">
      <TopNav />
      <main className="mx-auto w-full max-w-[var(--vr-content-max)] px-6 py-12">
        <Outlet />
      </main>
    </div>
  );
}

function LandingPlaceholder() {
  return (
    <section className="flex flex-col gap-6">
      <h1 className="font-display text-[44px] font-medium leading-tight">
        An evidence-backed route through BASIX, decided by rules.
      </h1>
      <p className="max-w-2xl text-lg text-ink-2">
        Describe your MVP in plain language. MeTTa graph rules choose who is eligible and why; a
        language model only translates and explains.
      </p>
      <div>
        <Link
          to="/route"
          className="inline-flex h-10 items-center rounded-card bg-accent-green px-5 font-medium text-white"
        >
          Find a route
        </Link>
      </div>
    </section>
  );
}

function RoutePlaceholder() {
  return (
    <section className="flex flex-col gap-2">
      <h1 className="font-display text-[36px] font-medium leading-tight">Describe your MVP</h1>
      <p className="text-ink-2">Plain language is fine. We will ask for anything missing.</p>
    </section>
  );
}

function HandoffPlaceholder() {
  return <h1 className="font-display text-[36px] font-medium">Venture handoff</h1>;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<LandingPlaceholder />} />
        <Route path="route" element={<RoutePlaceholder />} />
        <Route path="handoff" element={<HandoffPlaceholder />} />
      </Route>
    </Routes>
  );
}
