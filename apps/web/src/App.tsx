import { useMemo } from "react";
import { BrowserRouter, MemoryRouter } from "react-router";

import { createDefaultSource } from "./api/default";
import type { MarketplaceApi } from "./api/marketplace";
import { MarketplaceApiProvider } from "./api/MarketplaceApiProvider";
import type { RouteSource } from "./api/source";
import type { AuthState } from "./auth/authContext";
import { AuthProvider } from "./auth/AuthProvider";
import { FounderVoiceProvider } from "./chloe/FounderVoiceProvider";
import { spokenForm } from "./chloe/script";
import { AppRoutes } from "./router";
import { RoutingProvider } from "./state/RoutingProvider";
import { createVoiceProvider } from "./voice/selectProvider";
import type { VoiceProvider } from "./voice/provider";
import { VoiceSessionProvider } from "./voice/VoiceSession";

type AppProps = {
  /** Tests mount the app at a path without touching window.location. */
  initialPath?: string;
  /** Tests inject a source (the real client over a faked fetch, or the offline snapshot). */
  source?: RouteSource;
  /** Tests inject the auth state so Clerk never loads in jsdom. */
  auth?: AuthState;
  /** Tests inject a fake marketplace API. */
  marketplace?: MarketplaceApi;
  /** Tests inject a voice provider, or null for none; undefined uses createVoiceProvider(). */
  voice?: VoiceProvider | null;
};

export function App({ initialPath, source, auth, marketplace, voice }: AppProps) {
  const resolvedSource = useMemo(() => source ?? createDefaultSource(), [source]);
  const resolvedVoice = useMemo(() => (voice === undefined ? createVoiceProvider({ transform: spokenForm }) : voice), [voice]);
  const tree = (
    <AuthProvider auth={auth}>
      <MarketplaceApiProvider marketplace={marketplace}>
        <RoutingProvider source={resolvedSource}>
          {/* One voice session above every route (#102): the top-nav switch, /route's Chloe and
              the dashboard and booking read-aloud all share it. */}
          <VoiceSessionProvider voice={resolvedVoice}>
            <FounderVoiceProvider>
              <AppRoutes />
            </FounderVoiceProvider>
          </VoiceSessionProvider>
        </RoutingProvider>
      </MarketplaceApiProvider>
    </AuthProvider>
  );
  if (initialPath !== undefined) {
    return <MemoryRouter initialEntries={[initialPath]}>{tree}</MemoryRouter>;
  }
  return <BrowserRouter>{tree}</BrowserRouter>;
}
