/**
 * Seam: rendered screens through React Testing Library (D-19, Sprint 003 #45).
 * `/profile` and `/profile/projects/new` are driven through the full App with an injected builder
 * auth state and a fake marketplace API. The engine decides every skill's `status` and `evidence`;
 * these tests only check that the screen renders what the API said (AGENTS.md non-negotiable 4).
 */
import type {
  BuilderProfile,
  Credential,
  CredentialInput,
  ProfileInput,
  ProjectInput,
} from "@venture-route/contracts";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { ApiNotFoundError } from "../src/api/client";
import { createOfflineSource } from "../src/api/offline";
import { App } from "../src/App";
import type { AuthState } from "../src/auth/authContext";
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

function profile(overrides: Partial<BuilderProfile> = {}): BuilderProfile {
  return {
    builderId: "amina-otieno",
    displayName: "Amina Otieno",
    headline: "Python and MeTTa builder",
    cohortId: "cohort-2026a",
    location: "Nairobi",
    dayRate: 150,
    modes: { remote: true, hybrid: true, onSite: false },
    selfDescribedSkills: ["backend"],
    contact: { email: "amina@example.com", phone: null, linkedin: null },
    sharing: { email: true, phone: false, linkedin: false },
    availability: [{ start: "2026-09-22", end: "2026-09-29" }],
    skills: [
      { id: "python", name: "Python", status: "verified", evidence: "both" },
      { id: "backend", name: "Backend", status: "self-described", evidence: null },
    ],
    accountStatus: "pending",
    confirmed: false,
    skillSet: [],
    suggestedSkills: [],
    githubUrl: null,
    linkedinUrl: null,
    demoData: true,
    ...overrides,
  };
}

const noRows = { listCredentials: async (): Promise<Credential[]> => [], listProjects: async () => [] };

describe("/profile", () => {
  it("shows the pending banner, the Both badge on python and display-only wording on backend", async () => {
    const marketplace = fakeMarketplace({ getProfile: async () => profile(), ...noRows });

    render(<App initialPath="/profile" source={source} auth={builderAuth} marketplace={marketplace} />);

    expect(await screen.findByText("Pending BASIX confirmation")).toBeInTheDocument();
    expect(screen.getByText(/absent from routes and candidate views/)).toBeInTheDocument();
    expect(screen.queryByText(/bids/)).not.toBeInTheDocument();
    const skills = screen.getByRole("list", { name: "Skills" });
    const python = within(skills).getByRole("listitem", { name: "Python" });
    expect(within(python).getByTestId("evidence-badge")).toHaveTextContent("Both");
    const backend = within(skills).getByRole("listitem", { name: "Backend" });
    expect(within(backend).getByText("Self-described · display only")).toBeInTheDocument();
    expect(within(backend).queryByText(/verified/i)).not.toBeInTheDocument();
    expect(within(backend).queryByTestId("evidence-badge")).not.toBeInTheDocument();
    expect(screen.getAllByText("Demo data").length).toBeGreaterThan(0);
  });

  it("shows no pending banner for a confirmed builder", async () => {
    const marketplace = fakeMarketplace({
      getProfile: async () => profile({ accountStatus: "confirmed", confirmed: true }),
      ...noRows,
    });

    render(<App initialPath="/profile" source={source} auth={builderAuth} marketplace={marketplace} />);

    expect(await screen.findByDisplayValue("Amina Otieno")).toBeInTheDocument();
    expect(screen.queryByText("Pending BASIX confirmation")).not.toBeInTheDocument();
  });

  it("creates a profile from the empty form with one availability window from the calendar", async () => {
    const user = userEvent.setup();
    const saved: ProfileInput[] = [];
    const marketplace = fakeMarketplace({
      getProfile: async () => {
        throw new ApiNotFoundError("no profile yet");
      },
      putProfile: async (input) => {
        saved.push(input);
        return profile({ ...input, accountStatus: "pending", confirmed: false });
      },
      ...noRows,
    });

    render(<App initialPath="/profile" source={source} auth={builderAuth} marketplace={marketplace} />);

    const form = await screen.findByRole("form", { name: "Builder profile" });
    await user.type(within(form).getByLabelText("Display name"), "Amina Otieno");
    await user.type(within(form).getByLabelText("Primary location / base"), "Nairobi");
    await user.type(within(form).getByLabelText("Day rate"), "150");
    await user.click(within(form).getByRole("checkbox", { name: "Remote" }));
    // Two months side by side: October's grid repeats September's last days as outside days.
    await user.click((await screen.findAllByRole("button", { name: /September 22nd, 2026/ }))[0]!);
    await user.click(screen.getAllByRole("button", { name: /September 29th, 2026/ })[0]!);
    await user.click(within(form).getByRole("button", { name: "Save profile" }));

    await waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0]).toMatchObject({
      displayName: "Amina Otieno",
      location: "Nairobi",
      dayRate: 150,
      modes: { remote: true, hybrid: false, onSite: false },
      availability: [{ start: "2026-09-22", end: "2026-09-29" }],
    });
    expect(saved[0]!.availability).toHaveLength(1);
    expect(await screen.findByText("Profile saved.")).toBeInTheDocument();
    // Two calendar months plus typed fields through the full app shell are slow in jsdom under parallel workers.
  }, 40_000);

  it("adds a credential and lists it as pending", async () => {
    const user = userEvent.setup();
    const posted: CredentialInput[] = [];
    const marketplace = fakeMarketplace({
      getProfile: async () => profile({ accountStatus: "confirmed", confirmed: true }),
      ...noRows,
      postCredential: async (input) => {
        posted.push(input);
        return {
          id: "cred-1",
          ...input,
          // The server always returns a fully-populated row; unset optional fields on the
          // request come back null, never absent (W0 integration fix).
          issuedOn: input.issuedOn ?? null,
          credentialUrl: input.credentialUrl ?? null,
          status: "pending",
          demoData: true,
        };
      },
    });

    render(<App initialPath="/profile" source={source} auth={builderAuth} marketplace={marketplace} />);

    const form = await screen.findByRole("form", { name: "Add credential" });
    await user.type(within(form).getByLabelText("Credential title"), "Advanced Python");
    await user.type(within(form).getByLabelText("Issuer"), "MeTTa OmniUniversity");
    await user.selectOptions(within(form).getByLabelText("Skill"), "python");
    await user.click(within(form).getByRole("button", { name: "Add credential" }));

    await waitFor(() => expect(posted).toEqual([{ title: "Advanced Python", issuer: "MeTTa OmniUniversity", skillId: "python" }]));
    const credentials = await screen.findByRole("list", { name: "Credentials" });
    const row = within(credentials).getByRole("listitem", { name: "Advanced Python" });
    expect(within(row).getByText("Pending")).toBeInTheDocument();
    expect(within(row).getByText("Demo data")).toBeInTheDocument();
  });
});

describe("/profile/projects/new", () => {
  it("posts the project with two skills and licensable on, then returns to the profile", async () => {
    const user = userEvent.setup();
    const posted: ProjectInput[] = [];
    const marketplace = fakeMarketplace({
      getProfile: async () => profile({ accountStatus: "confirmed", confirmed: true }),
      ...noRows,
      postProject: async (input) => {
        posted.push(input);
        return {
          id: "proj-1",
          ...input,
          status: "pending",
          demoData: true,
          // Since #94 (ruling R17) the engine returns the ShowcaseProject shape.
          description: "",
          liveUrl: null,
          demoUrl: null,
          pitchVideoUrl: null,
          pitchDeckUrl: null,
          showcased: false,
          showcaseStatus: "none",
        };
      },
    });

    render(<App initialPath="/profile/projects/new" source={source} auth={builderAuth} marketplace={marketplace} />);

    const form = await screen.findByRole("form", { name: "Add a showcase project" });
    await user.type(within(form).getByLabelText("Project title"), "Clinic triage intake flow");
    await user.click(within(form).getByRole("radio", { name: "Health" }));
    await user.click(within(form).getByRole("checkbox", { name: "Python" }));
    await user.click(within(form).getByRole("checkbox", { name: "UI/UX design" }));
    await user.type(within(form).getByLabelText("Completion date"), "2026-08-31");
    await user.click(within(form).getByRole("checkbox", { name: "Licensable as reusable IP" }));
    await user.click(within(form).getByRole("button", { name: "Submit for confirmation" }));

    await waitFor(() =>
      expect(posted).toEqual([
        { title: "Clinic triage intake flow", vertical: "health", licensable: true, completedOn: "2026-08-31", skillIds: ["python", "ui-ux"] },
      ]),
    );
    expect(await screen.findByRole("heading", { level: 1, name: "Your profile" })).toBeInTheDocument();
  });
});
