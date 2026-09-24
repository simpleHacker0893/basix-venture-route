/**
 * A fake `MarketplaceApi` for rendered-screen tests (D-19). Every method rejects unless a test
 * overrides it, so a screen that calls something the test did not expect fails loudly.
 */
import type { ShowcaseCard, ShowcaseDetail, ShowcasePage } from "@venture-route/contracts";

import type { MarketplaceApi } from "../src/api/marketplace";

function unexpected(name: string): () => Promise<never> {
  return async () => {
    throw new Error(`Unexpected marketplace call: ${name}`);
  };
}

/** Demo data fixtures (spec #86 §Demo seed) so #104/#105 have something to render. */
export const DEMO_SHOWCASE_CARD: ShowcaseCard = {
  id: "venture-route",
  title: "Venture Route",
  builderId: "demo-njuguna-njenga",
  displayName: "Njuguna Njenga",
  cohortId: "cohort-2026a",
  vertical: "education",
  licensable: false,
  description: "The MeTTa-routed marketplace itself, built for the BASIX hackathon.",
  skillIds: ["ai-metta", "python", "frontend", "backend"],
  matchedSkill: null,
  liveUrl: "https://example.org/venture-route/live",
  demoUrl: "https://example.org/venture-route/demo",
  pitchVideoUrl: null,
  pitchDeckUrl: "https://example.org/venture-route/deck",
  pitchVideoId: null,
  demoData: true,
};

export const DEMO_SHOWCASE_DETAIL: ShowcaseDetail = {
  id: DEMO_SHOWCASE_CARD.id,
  title: DEMO_SHOWCASE_CARD.title,
  vertical: DEMO_SHOWCASE_CARD.vertical,
  licensable: DEMO_SHOWCASE_CARD.licensable,
  description: DEMO_SHOWCASE_CARD.description,
  completedOn: "2026-09-01",
  skillIds: DEMO_SHOWCASE_CARD.skillIds,
  liveUrl: DEMO_SHOWCASE_CARD.liveUrl,
  demoUrl: DEMO_SHOWCASE_CARD.demoUrl,
  pitchVideoUrl: DEMO_SHOWCASE_CARD.pitchVideoUrl,
  pitchDeckUrl: DEMO_SHOWCASE_CARD.pitchDeckUrl,
  pitchVideoId: DEMO_SHOWCASE_CARD.pitchVideoId,
  builder: {
    builderId: DEMO_SHOWCASE_CARD.builderId,
    displayName: DEMO_SHOWCASE_CARD.displayName,
    cohortId: DEMO_SHOWCASE_CARD.cohortId,
    verifiedSkills: [{ id: "python", name: "Python", status: "verified", evidence: "both" }],
    skillSet: ["Product thinking", "Technical writing"],
    certifications: [],
    githubUrl: "https://github.com/demo-njuguna-njenga",
    linkedinUrl: "https://www.linkedin.com/in/demo-njuguna-njenga",
  },
  demoData: true,
};

export const DEMO_SHOWCASE_PAGE: ShowcasePage = { items: [DEMO_SHOWCASE_CARD], total: 1 };

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
    getDecided: unexpected("getDecided"),
    confirm: unexpected("confirm"),
    reject: unexpected("reject"),
    // Sprint 004 (#67)
    listRequests: unexpected("listRequests"),
    getRequest: unexpected("getRequest"),
    postRequest: unexpected("postRequest"),
    closeRequest: unexpected("closeRequest"),
    getEligibility: unexpected("getEligibility"),
    postBid: unexpected("postBid"),
    listBidsOnRequest: unexpected("listBidsOnRequest"),
    listMyBids: unexpected("listMyBids"),
    postBooking: unexpected("postBooking"),
    acceptBooking: unexpected("acceptBooking"),
    counterBooking: unexpected("counterBooking"),
    confirmBooking: unexpected("confirmBooking"),
    listMyBookings: unexpected("listMyBookings"),
    getDashboard: unexpected("getDashboard"),
    // Sprint 005a (#96)
    showcase: {
      list: async () => DEMO_SHOWCASE_PAGE,
      get: async () => DEMO_SHOWCASE_DETAIL,
    },
    saveShowcase: unexpected("saveShowcase"),
    suggestSkills: unexpected("suggestSkills"),
    ...overrides,
  };
}
