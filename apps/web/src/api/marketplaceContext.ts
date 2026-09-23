import { createContext, useContext } from "react";

import type { MarketplaceApi } from "./marketplace";

export const MarketplaceApiContext = createContext<MarketplaceApi | null>(null);

export function useMarketplaceApi(): MarketplaceApi {
  const value = useContext(MarketplaceApiContext);
  if (!value) throw new Error("useMarketplaceApi must be used inside MarketplaceApiProvider");
  return value;
}
