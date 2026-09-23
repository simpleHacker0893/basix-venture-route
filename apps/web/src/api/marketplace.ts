/**
 * The marketplace half of the engine API (Sprint 003). Every call goes through the same
 * contract-parsing request helper as routing; the bearer header is attached by `createRequest`
 * on the guarded prefixes only.
 */
import { RoleResponse, type RoleChoice, type RoleResponse as RoleResponseT } from "@venture-route/contracts";

import { createRequest, jsonPost, type FetchLike, type GetToken } from "./client";

export type MarketplaceApi = {
  /** POST /api/me/role, once per account; the engine answers 409 on a second call. */
  postRole(choice: RoleChoice): Promise<RoleResponseT>;
};

export function createMarketplaceApi(baseUrl: string, fetchLike: FetchLike, getToken: GetToken): MarketplaceApi {
  const request = createRequest(baseUrl, fetchLike, getToken);
  return {
    postRole: (choice) => request("/api/me/role", RoleResponse, jsonPost(choice)),
  };
}
