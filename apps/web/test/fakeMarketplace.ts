/**
 * A fake `MarketplaceApi` for rendered-screen tests (D-19). Every method rejects unless a test
 * overrides it, so a screen that calls something the test did not expect fails loudly.
 */
import type { MarketplaceApi } from "../src/api/marketplace";

function unexpected(name: string): () => Promise<never> {
  return async () => {
    throw new Error(`Unexpected marketplace call: ${name}`);
  };
}

export function fakeMarketplace(overrides: Partial<MarketplaceApi> = {}): MarketplaceApi {
  return {
    postRole: unexpected("postRole"),
    getProfile: unexpected("getProfile"),
    putProfile: unexpected("putProfile"),
    listCredentials: unexpected("listCredentials"),
    postCredential: unexpected("postCredential"),
    listProjects: unexpected("listProjects"),
    postProject: unexpected("postProject"),
    getCandidate: unexpected("getCandidate"),
    getPending: unexpected("getPending"),
    confirm: unexpected("confirm"),
    reject: unexpected("reject"),
    ...overrides,
  };
}
