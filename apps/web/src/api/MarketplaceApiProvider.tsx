import { useMemo, type ReactNode } from "react";

import { useAuthState } from "../auth/authContext";
import { createMarketplaceApi, type MarketplaceApi } from "./marketplace";
import { MarketplaceApiContext } from "./marketplaceContext";
import { API_URL } from "./source";

type Props = {
  /** Tests inject a fake; production builds the client from API_URL and the auth token. */
  marketplace?: MarketplaceApi;
  children: ReactNode;
};

export function MarketplaceApiProvider({ marketplace, children }: Props) {
  const auth = useAuthState();
  const value = useMemo(
    () => marketplace ?? createMarketplaceApi(API_URL, fetch, auth.getToken),
    [marketplace, auth.getToken],
  );
  return <MarketplaceApiContext.Provider value={value}>{children}</MarketplaceApiContext.Provider>;
}
