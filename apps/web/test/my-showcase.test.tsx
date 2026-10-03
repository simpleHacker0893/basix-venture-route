/**
 * Seam: /my-showcase through the full App with an injected builder and a fake marketplace API.
 * The engine decides every status; the page only mirrors the public rule (showcased, showcase
 * confirmed, project confirmed, account confirmed) to say why an entry is or is not public, and
 * Publish / Withdraw send the saved description and links back so nothing is wiped.
 */
import type { AccountStatus, BuilderProfile, ShowcaseEditInput, ShowcaseProject } from "@venture-route/contracts";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { ApiNotFoundError } from "../src/api/client";
import { createOfflineSource } from "../src/api/offline";
import { App } from "../src/App";
import type { AuthState } from "../src/auth/authContext";
import {
  cardCopy,
  countStates,
  showcaseBody,
  showcaseCardState,
} from "../src/features/builder/showcaseState";
import { fakeMarketplace } from "./fakeMarketplace";

const source = createOfflineSource();

const builderAuth: AuthState = {
  configured: true,
  isLoaded: true,
  isSignedIn: true,
  role: "builder",
  getToken: async () => "tok-builder",
  reload: async () => undefined,
  signOut: async () => undefined,
};

function profile(accountStatus: AccountStatus): BuilderProfile {
  return {
    builderId: "amina-otieno",
    displayName: "Amina Otieno",
    headline: "Python builder",
    cohortId: null,
    location: "Nairobi",
    hourlyRate: 15,
    modes: { remote: true, hybrid: false, onSite: false },
    selfDescribedSkills: [],
    contact: { email: "amina@example.com", phone: null, linkedin: null },
    sharing: { email: false, phone: false, linkedin: false },
    availability: [],
    skills: [],
    accountStatus,
    confirmed: accountStatus === "confirmed",
    skillSet: [],
    suggestedSkills: [],
    githubUrl: null,
    linkedinUrl: null,
    demoData: true,
  };
}

function project(overrides: Partial<ShowcaseProject> = {}): ShowcaseProject {
  return {
    id: "proj-1",
    title: "Elimu Mtaani",
    vertical: "education",
    licensable: false,
    completedOn: "2026-08-31",
    skillIds: ["python"],
    status: "confirmed",
    demoData: true,
    description: "A tutoring marketplace.",
    liveUrl: null,
    demoUrl: null,
    pitchVideoUrl: null,
    pitchDeckUrl: null,
    showcased: false,
    showcaseStatus: "none",
    ...overrides,
  };
}

function renderPage(account: AccountStatus, projects: ShowcaseProject[], extra: Parameters<typeof fakeMarketplace>[0] = {}) {
  const marketplace = fakeMarketplace({
    getProfile: async () => profile(account),
    listProjects: async () => projects,
    ...extra,
  });
  render(<App initialPath="/my-showcase" source={source} auth={builderAuth} marketplace={marketplace} />);
}

describe("showcaseCardState (the five states and the two approved-but-not-live cases)", () => {
  it("maps the public rule's four conditions to a state", () => {
    expect(showcaseCardState(project(), "confirmed")).toBe("draft");
    expect(showcaseCardState(project({ showcased: true, showcaseStatus: "pending" }), "pending")).toBe("waiting");
    expect(showcaseCardState(project({ showcased: true, showcaseStatus: "confirmed" }), "confirmed")).toBe("live");
    expect(showcaseCardState(project({ showcased: true, showcaseStatus: "confirmed" }), "pending")).toBe("approved-account");
    expect(showcaseCardState(project({ showcased: true, showcaseStatus: "confirmed", status: "pending" }), "confirmed")).toBe("approved-project");
    expect(showcaseCardState(project({ showcased: true, showcaseStatus: "rejected" }), "confirmed")).toBe("needs-changes");
    // A withdrawn entry that was once confirmed is a draft again.
    expect(showcaseCardState(project({ showcased: false, showcaseStatus: "none" }), "confirmed")).toBe("draft");
  });

  it("counts waiting to include approved-but-not-live entries and keeps needs-changes apart", () => {
    expect(countStates(["live", "waiting", "approved-account", "draft", "needs-changes"])).toEqual({
      live: 1,
      waiting: 2,
      draft: 1,
      needsChanges: 1,
    });
  });

  it("sends the saved description and every link back with only showcased changed", () => {
    const saved = project({
      description: "d",
      liveUrl: "https://a.example",
      demoUrl: "https://b.example",
      pitchVideoUrl: "https://www.youtube.com/watch?v=abcdefghijk",
      pitchDeckUrl: "https://c.example",
    });
    expect(showcaseBody(saved, true)).toEqual({
      description: "d",
      liveUrl: "https://a.example",
      demoUrl: "https://b.example",
      pitchVideoUrl: "https://www.youtube.com/watch?v=abcdefghijk",
      pitchDeckUrl: "https://c.example",
      showcased: true,
    });
    expect(cardCopy("waiting", "pending").why).toBe("Not public yet. BASIX confirms your account first, then this project.");
  });
});

describe("/my-showcase", () => {
  it("shows each state's pill, why-line and action", async () => {
    renderPage("confirmed", [
      project({ id: "p-draft", title: "Draft project" }),
      project({ id: "p-wait", title: "Waiting project", showcased: true, showcaseStatus: "pending" }),
      project({ id: "p-live", title: "Live project", showcased: true, showcaseStatus: "confirmed" }),
      project({ id: "p-back", title: "Sent back project", showcased: true, showcaseStatus: "rejected" }),
    ]);

    const list = await screen.findByRole("list", { name: "Projects" });
    const draft = within(list).getByRole("listitem", { name: "Draft project" });
    expect(within(draft).getByTestId("state-pill")).toHaveTextContent("Draft");
    expect(draft).toHaveTextContent("Only you can see this. Turn on Show on Showcase to send it to BASIX.");
    expect(within(draft).getByRole("button", { name: "Publish to Showcase" })).toBeInTheDocument();

    const waiting = within(list).getByRole("listitem", { name: "Waiting project" });
    expect(within(waiting).getByTestId("state-pill")).toHaveTextContent("Waiting for review");
    expect(waiting).toHaveTextContent("Not public yet. BASIX is reviewing this project.");
    expect(within(waiting).getByRole("button", { name: "Withdraw from review" })).toBeInTheDocument();

    const live = within(list).getByRole("listitem", { name: "Live project" });
    expect(within(live).getByTestId("state-pill")).toHaveTextContent("Live");
    expect(live).toHaveTextContent("Visible to everyone on the public Showcase. Editing it sends it back to review.");
    expect(within(live).getByRole("link", { name: /View live page/ })).toHaveAttribute("href", "/showcase/p-live");

    const back = within(list).getByRole("listitem", { name: "Sent back project" });
    expect(within(back).getByTestId("state-pill")).toHaveTextContent("Needs changes");
    expect(back).toHaveTextContent("BASIX sent this back. Update it and publish again.");
    expect(within(back).getByRole("button", { name: "Edit and resubmit" })).toBeInTheDocument();

    const totals = screen.getByRole("list", { name: "Showcase totals" });
    expect(totals).toHaveTextContent("1Live");
    expect(totals).toHaveTextContent("1Waiting for review");
    expect(totals).toHaveTextContent("1Draft");
    expect(totals).toHaveTextContent("1Needs changes");
  });

  it("says an approved entry goes live once the account is confirmed, and shows the account banner", async () => {
    renderPage("pending", [project({ showcased: true, showcaseStatus: "confirmed" })]);

    const row = await screen.findByRole("listitem", { name: "Elimu Mtaani" });
    expect(within(row).getByTestId("state-pill")).toHaveTextContent("Approved");
    expect(row).toHaveTextContent("Approved. Goes live once your account is confirmed.");
    expect(within(row).queryByRole("link", { name: /View live page/ })).not.toBeInTheDocument();
    const banner = screen.getByRole("status", { name: "Account status" });
    expect(banner).toHaveTextContent("Your account is waiting for BASIX to confirm it");
    expect(banner).toHaveTextContent("Nothing goes public until your account and the project are both confirmed.");
  });

  it("shows no account banner for a confirmed account", async () => {
    renderPage("confirmed", [project()]);

    await screen.findByRole("listitem", { name: "Elimu Mtaani" });
    expect(screen.queryByRole("status", { name: "Account status" })).not.toBeInTheDocument();
  });

  it("publishes with showcased true and keeps the saved links and description", async () => {
    const user = userEvent.setup();
    const calls: { id: string; body: ShowcaseEditInput }[] = [];
    renderPage("confirmed", [project({ liveUrl: "https://elimu.example.org", pitchDeckUrl: "https://deck.example.org" })], {
      saveShowcase: async (id, body) => {
        calls.push({ id, body });
        return project({ ...body, showcaseStatus: "pending" });
      },
    });

    const row = await screen.findByRole("listitem", { name: "Elimu Mtaani" });
    await user.click(within(row).getByRole("button", { name: "Publish to Showcase" }));

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]).toEqual({
      id: "proj-1",
      body: {
        description: "A tutoring marketplace.",
        liveUrl: "https://elimu.example.org",
        demoUrl: null,
        pitchVideoUrl: null,
        pitchDeckUrl: "https://deck.example.org",
        showcased: true,
      },
    });
    expect(await within(row).findByText("Waiting for review")).toBeInTheDocument();
    expect(within(row).getByRole("button", { name: "Withdraw from review" })).toBeInTheDocument();
  });

  it("withdraws with showcased false and keeps the saved links", async () => {
    const user = userEvent.setup();
    const calls: ShowcaseEditInput[] = [];
    renderPage("confirmed", [project({ showcased: true, showcaseStatus: "pending", demoUrl: "https://demo.example.org" })], {
      saveShowcase: async (_id, body) => {
        calls.push(body);
        return project({ ...body, showcaseStatus: "none" });
      },
    });

    const row = await screen.findByRole("listitem", { name: "Elimu Mtaani" });
    await user.click(within(row).getByRole("button", { name: "Withdraw from review" }));

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]).toMatchObject({ showcased: false, demoUrl: "https://demo.example.org", description: "A tutoring marketplace." });
    expect(await within(row).findByText("Draft")).toBeInTheDocument();
  });

  it("keeps the card and shows an error when publishing fails", async () => {
    const user = userEvent.setup();
    renderPage("confirmed", [project()], {
      saveShowcase: async () => {
        throw new Error("The routing engine answered 500.");
      },
    });

    const row = await screen.findByRole("listitem", { name: "Elimu Mtaani" });
    await user.click(within(row).getByRole("button", { name: "Publish to Showcase" }));

    expect(await within(row).findByRole("alert")).toHaveTextContent("The routing engine answered 500.");
    expect(within(row).getByTestId("state-pill")).toHaveTextContent("Draft");
    expect(within(row).getByRole("button", { name: "Publish to Showcase" })).toBeEnabled();
  });

  it("shows saved links as safe external links, or + Add a link that opens the editor", async () => {
    const user = userEvent.setup();
    renderPage("confirmed", [
      project({ id: "p-linked", title: "Linked", liveUrl: "https://live.example.org", demoUrl: "https://demo.example.org" }),
      project({ id: "p-bare", title: "Bare" }),
    ]);

    const linked = await screen.findByRole("listitem", { name: "Linked" });
    const live = within(linked).getByRole("link", { name: /Project link/ });
    expect(live).toHaveAttribute("href", "https://live.example.org");
    expect(live).toHaveAttribute("target", "_blank");
    expect(live).toHaveAttribute("rel", "noopener noreferrer");
    expect(within(linked).getByRole("link", { name: /Demo link/ })).toHaveAttribute("href", "https://demo.example.org");

    const bare = screen.getByRole("listitem", { name: "Bare" });
    await user.click(within(bare).getByRole("button", { name: "+ Add a link" }));
    expect(within(bare).getByRole("form", { name: "Showcase details for Bare" })).toBeInTheDocument();
  });

  it("shows the empty state with an Add a project button", async () => {
    renderPage("confirmed", []);

    const empty = await screen.findByRole("region", { name: "No projects" });
    expect(empty).toHaveTextContent("No projects yet");
    expect(within(empty).getByRole("link", { name: "Add a project" })).toHaveAttribute("href", "/profile/projects/new");
  });

  it("treats a missing profile as 'nothing confirmed yet' instead of failing", async () => {
    renderPage("pending", [], {
      getProfile: async () => {
        throw new ApiNotFoundError();
      },
    });

    expect(await screen.findByRole("region", { name: "No projects" })).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Account status" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("has the header actions in the top bar and My showcase highlighted in the sidebar", async () => {
    renderPage("confirmed", [project()]);

    await screen.findByRole("listitem", { name: "Elimu Mtaani" });
    const primary = screen.getByRole("navigation", { name: "Primary" });
    expect(within(primary).getByRole("link", { name: "View public Showcase ↗" })).toHaveAttribute("href", "/showcase");
    expect(within(primary).getByRole("link", { name: "Add a project" })).toHaveAttribute("href", "/profile/projects/new");
    const sections = screen.getByRole("navigation", { name: "Sections" });
    expect(within(sections).getByRole("link", { name: "My showcase" })).toHaveAttribute("aria-current", "page");
  });
});
