import { useMemo } from "react";
import { BrowserRouter, MemoryRouter } from "react-router";

import { createDefaultSource } from "./api/default";
import type { RouteSource } from "./api/source";
import { AppRoutes } from "./router";
import { RoutingProvider } from "./state/RoutingProvider";

type AppProps = {
  /** Tests mount the app at a path without touching window.location. */
  initialPath?: string;
  /** Tests inject a source (the real client over a faked fetch, or the offline snapshot). */
  source?: RouteSource;
};

export function App({ initialPath, source }: AppProps) {
  const resolvedSource = useMemo(() => source ?? createDefaultSource(), [source]);
  const tree = (
    <RoutingProvider source={resolvedSource}>
      <AppRoutes />
    </RoutingProvider>
  );
  if (initialPath !== undefined) {
    return <MemoryRouter initialEntries={[initialPath]}>{tree}</MemoryRouter>;
  }
  return <BrowserRouter>{tree}</BrowserRouter>;
}
