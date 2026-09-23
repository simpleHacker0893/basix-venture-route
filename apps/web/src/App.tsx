import { useMemo } from "react";
import { BrowserRouter, MemoryRouter } from "react-router";

import { createDefaultSource } from "./api/default";
import type { MarketplaceApi } from "./api/marketplace";
import { MarketplaceApiProvider } from "./api/MarketplaceApiProvider";
import type { RouteSource } from "./api/source";
import type { AuthState } from "./auth/authContext";
import { AuthProvider } from "./auth/AuthProvider";
import { AppRoutes } from "./router";
import { RoutingProvider } from "./state/RoutingProvider";

type AppProps = {
  /** Tests mount the app at a path without touching window.location. */
  initialPath?: string;
  /** Tests inject a source (the real client over a faked fetch, or the offline snapshot). */
  source?: RouteSource;
  /** Tests inject the auth state so Clerk never loads in jsdom. */
  auth?: AuthState;
  /** Tests inject a fake marketplace API. */
  marketplace?: MarketplaceApi;
};

export function App({ initialPath, source, auth, marketplace }: AppProps) {
  const resolvedSource = useMemo(() => source ?? createDefaultSource(), [source]);
  const tree = (
    <AuthProvider auth={auth}>
      <MarketplaceApiProvider marketplace={marketplace}>
        <RoutingProvider source={resolvedSource}>
          <AppRoutes />
        </RoutingProvider>
      </MarketplaceApiProvider>
    </AuthProvider>
  );
  if (initialPath !== undefined) {
    return <MemoryRouter initialEntries={[initialPath]}>{tree}</MemoryRouter>;
  }
  return <BrowserRouter>{tree}</BrowserRouter>;
}
