/**
 * The marketplace half of the engine API (Sprint 003). Every call goes through the same
 * contract-parsing request helper as routing; the bearer header is attached by `createRequest`
 * on the guarded prefixes only.
 */
import {
  AdminDecision,
  BuilderProfile,
  Candidate,
  Credential,
  PendingQueue,
  Project,
  RoleResponse,
  type AdminDecision as AdminDecisionT,
  type BuilderProfile as BuilderProfileT,
  type Candidate as CandidateT,
  type Credential as CredentialT,
  type CredentialInput,
  type DecisionKind,
  type PendingQueue as PendingQueueT,
  type ProfileInput,
  type Project as ProjectT,
  type ProjectInput,
  type RoleChoice,
  type RoleResponse as RoleResponseT,
} from "@venture-route/contracts";
import { z } from "zod";

import { createRequest, jsonPost, jsonPut, type FetchLike, type GetToken } from "./client";

export type MarketplaceApi = {
  /** POST /api/me/role, once per account; the engine answers 409 on a second call. */
  postRole(choice: RoleChoice): Promise<RoleResponseT>;
  /** GET /api/me/profile; rejects with `ApiNotFoundError` before the first save. */
  getProfile(): Promise<BuilderProfileT>;
  /** PUT /api/me/profile: create or replace; `ApiValidationError` carries the 422 messages. */
  putProfile(input: ProfileInput): Promise<BuilderProfileT>;
  listCredentials(): Promise<CredentialT[]>;
  /** POST /api/me/credentials → 201; `ApiNotFoundError` until the profile exists. */
  postCredential(input: CredentialInput): Promise<CredentialT>;
  listProjects(): Promise<ProjectT[]>;
  /** POST /api/me/projects → 201; `ApiNotFoundError` until the profile exists. */
  postProject(input: ProjectInput): Promise<ProjectT>;
  /**
   * GET /api/builders/{builderId} (founder or admin): the candidate view with only the shared
   * contact keys. `ApiNotFoundError` for unconfirmed, unknown and seed builder ids.
   */
  getCandidate(builderId: string): Promise<CandidateT>;
  /** GET /api/admin/pending (admin): pending accounts, credentials and projects. */
  getPending(): Promise<PendingQueueT>;
  /** POST /api/admin/confirm/{kind}/{id}: the engine reprojects in the same request (D-15). */
  confirm(kind: DecisionKind, id: string): Promise<AdminDecisionT>;
  /** POST /api/admin/reject/{kind}/{id}: the engine reprojects in the same request (D-15). */
  reject(kind: DecisionKind, id: string): Promise<AdminDecisionT>;
};

const Credentials = z.array(Credential);
const Projects = z.array(Project);

export function createMarketplaceApi(baseUrl: string, fetchLike: FetchLike, getToken: GetToken): MarketplaceApi {
  const request = createRequest(baseUrl, fetchLike, getToken);
  return {
    postRole: (choice) => request("/api/me/role", RoleResponse, jsonPost(choice)),
    getProfile: () => request("/api/me/profile", BuilderProfile),
    putProfile: (input) => request("/api/me/profile", BuilderProfile, jsonPut(input)),
    listCredentials: () => request("/api/me/credentials", Credentials),
    postCredential: (input) => request("/api/me/credentials", Credential, jsonPost(input)),
    listProjects: () => request("/api/me/projects", Projects),
    postProject: (input) => request("/api/me/projects", Project, jsonPost(input)),
    getCandidate: (builderId) => request(`/api/builders/${encodeURIComponent(builderId)}`, Candidate),
    getPending: () => request("/api/admin/pending", PendingQueue),
    confirm: (kind, id) => request(`/api/admin/confirm/${kind}/${encodeURIComponent(id)}`, AdminDecision, { method: "POST" }),
    reject: (kind, id) => request(`/api/admin/reject/${kind}/${encodeURIComponent(id)}`, AdminDecision, { method: "POST" }),
  };
}
