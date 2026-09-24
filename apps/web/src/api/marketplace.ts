/**
 * The marketplace half of the engine API (Sprint 003). Every call goes through the same
 * contract-parsing request helper as routing; the bearer header is attached by `createRequest`
 * on the guarded prefixes only.
 */
import {
  AdminDecision,
  Bid,
  Booking,
  BuilderProfile,
  Candidate,
  Credential,
  Dashboard,
  Eligibility,
  PendingQueue,
  Project,
  Request,
  RoleResponse,
  type AdminDecision as AdminDecisionT,
  type Bid as BidT,
  type BidCreateInput,
  type Booking as BookingT,
  type BookingCreateInput,
  type BookingProposalInput,
  type BuilderProfile as BuilderProfileT,
  type Candidate as CandidateT,
  type Credential as CredentialT,
  type CredentialInput,
  type Dashboard as DashboardT,
  type DecisionKind,
  type Eligibility as EligibilityT,
  type PendingQueue as PendingQueueT,
  type ProfileInput,
  type Project as ProjectT,
  type ProjectInput,
  type Request as RequestT,
  type RequestCreateInput,
  type RoleChoice,
  type RoleResponse as RoleResponseT,
} from "@venture-route/contracts";
import { z } from "zod";

import { createRequest, jsonPost, jsonPut, type FetchLike, type GetToken } from "./client";

export type MarketplaceApi = {
  // -- Sprint 004 (#67): requests, bids, bookings, dashboard. 403s arrive as ApiForbiddenError
  // whose `reason` is the engine's detail verbatim; 409s as ApiUnreachableError naming the detail.
  /** GET /api/requests: own requests (founder) or every open one with `eligibility` (builder). */
  listRequests(): Promise<RequestT[]>;
  /** GET /api/requests/{id}; `ApiNotFoundError` for another founder's request. */
  getRequest(id: string): Promise<RequestT>;
  /** POST /api/requests (founder): the brief and the route snapshot the client holds → 201. */
  postRequest(input: RequestCreateInput): Promise<RequestT>;
  /** POST /api/requests/{id}/close (owning founder); 409 when already closed. */
  closeRequest(id: string): Promise<RequestT>;
  /** GET /api/requests/{id}/eligibility (builder): the engine's verdict for the signed-in builder. */
  getEligibility(id: string): Promise<EligibilityT>;
  /** POST /api/requests/{id}/bids (builder) → 201; 403 with the engine's reason when not eligible. */
  postBid(id: string, input: BidCreateInput): Promise<BidT>;
  /** GET /api/requests/{id}/bids (owning founder): bids from currently confirmed builders. */
  listBidsOnRequest(id: string): Promise<BidT[]>;
  /** GET /api/me/bids (builder): own bids with each request's title and status. */
  listMyBids(): Promise<BidT[]>;
  /** POST /api/bookings (founder) → 201; 422 with the slot reason. */
  postBooking(input: BookingCreateInput): Promise<BookingT>;
  /** POST /api/bookings/{id}/accept (builder party); 409 with the machine's reason. */
  acceptBooking(id: string): Promise<BookingT>;
  /** POST /api/bookings/{id}/counter (either party) with a new proposal; 409 or 422. */
  counterBooking(id: string, proposal: BookingProposalInput): Promise<BookingT>;
  /** POST /api/bookings/{id}/confirm (founder party); the founder's "Accept" on a counter. */
  confirmBooking(id: string): Promise<BookingT>;
  /** GET /api/me/bookings: own bookings, soonest first. */
  listMyBookings(): Promise<BookingT[]>;
  /** GET /api/me/dashboard (founder): tiles from SQL counts plus the three lists. */
  getDashboard(): Promise<DashboardT>;
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
const Requests = z.array(Request);
const Bids = z.array(Bid);
const Bookings = z.array(Booking);

export function createMarketplaceApi(baseUrl: string, fetchLike: FetchLike, getToken: GetToken): MarketplaceApi {
  const request = createRequest(baseUrl, fetchLike, getToken);
  const id = encodeURIComponent;
  return {
    listRequests: () => request("/api/requests", Requests),
    getRequest: (requestId) => request(`/api/requests/${id(requestId)}`, Request),
    postRequest: (input) => request("/api/requests", Request, jsonPost(input)),
    closeRequest: (requestId) => request(`/api/requests/${id(requestId)}/close`, Request, { method: "POST" }),
    getEligibility: (requestId) => request(`/api/requests/${id(requestId)}/eligibility`, Eligibility),
    postBid: (requestId, input) => request(`/api/requests/${id(requestId)}/bids`, Bid, jsonPost(input)),
    listBidsOnRequest: (requestId) => request(`/api/requests/${id(requestId)}/bids`, Bids),
    listMyBids: () => request("/api/me/bids", Bids),
    postBooking: (input) => request("/api/bookings", Booking, jsonPost(input)),
    acceptBooking: (bookingId) => request(`/api/bookings/${id(bookingId)}/accept`, Booking, { method: "POST" }),
    counterBooking: (bookingId, proposal) =>
      request(`/api/bookings/${id(bookingId)}/counter`, Booking, jsonPost(proposal)),
    confirmBooking: (bookingId) => request(`/api/bookings/${id(bookingId)}/confirm`, Booking, { method: "POST" }),
    listMyBookings: () => request("/api/me/bookings", Bookings),
    getDashboard: () => request("/api/me/dashboard", Dashboard),
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
