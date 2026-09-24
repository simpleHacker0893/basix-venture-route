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
  ShowcaseEditInput,
  ShowcaseProject,
  SkillSuggestions,
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

function showcaseProject(overrides: Partial<ShowcaseProject> = {}): ShowcaseProject {
  return {
    id: "proj-1",
    title: "Venture Route",
    vertical: "education",
    licensable: false,
    completedOn: "2026-08-31",
    skillIds: ["python"],
    status: "confirmed",
    demoData: true,
    description: "",
    liveUrl: null,
    demoUrl: null,
    pitchVideoUrl: null,
    pitchDeckUrl: null,
    showcased: false,
    showcaseStatus: "none",
    ...overrides,
  };
}

describe("/profile skill set and résumé suggestions (spec #86 stories 17-28)", () => {
  it("suggests the nine vocabulary skills, accepts free text, and ignores a case-insensitive duplicate (acceptance §Part A Should 1)", async () => {
    const user = userEvent.setup();
    const marketplace = fakeMarketplace({
      getProfile: async () => profile({ accountStatus: "confirmed", confirmed: true }),
      ...noRows,
    });

    render(<App initialPath="/profile" source={source} auth={builderAuth} marketplace={marketplace} />);

    const input = await screen.findByLabelText("Skill set");
    const options = document.querySelectorAll<HTMLOptionElement>(`#${input.getAttribute("list")} option`);
    expect([...options].map((o) => o.value)).toEqual([
      "Python",
      "AI / MeTTa",
      "UI/UX design",
      "Frontend",
      "Backend",
      "Domain research",
      "Mobile",
      "Rust",
      "Data engineering",
    ]);

    const add = screen.getByRole("button", { name: "Add skill" });
    await user.type(input, "Growth hacking");
    await user.click(add);
    expect(screen.getByText("Growth hacking")).toBeInTheDocument();
    expect(screen.getByText("1 / 20")).toBeInTheDocument();

    await user.type(input, "growth hacking");
    await user.click(add);
    expect(screen.getByText("1 / 20")).toBeInTheDocument();
    expect(screen.getAllByText(/growth hacking/i)).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: "Remove Growth hacking" }));
    expect(screen.getByText("0 / 20")).toBeInTheDocument();
  });

  it("saves GitHub and LinkedIn profile links regardless of contact sharing (stories 27-28)", async () => {
    const user = userEvent.setup();
    const saved: ProfileInput[] = [];
    const marketplace = fakeMarketplace({
      getProfile: async () => profile({ accountStatus: "confirmed", confirmed: true, sharing: { email: false, phone: false, linkedin: false } }),
      ...noRows,
      putProfile: async (input) => {
        saved.push(input);
        return profile({ ...input, accountStatus: "confirmed", confirmed: true });
      },
    });

    render(<App initialPath="/profile" source={source} auth={builderAuth} marketplace={marketplace} />);

    const form = await screen.findByRole("form", { name: "Builder profile" });
    await user.type(within(form).getByLabelText("GitHub profile"), "https://github.com/amina-otieno");
    await user.type(within(form).getByLabelText("LinkedIn profile"), "https://www.linkedin.com/in/amina-otieno");
    await user.click(within(form).getByRole("button", { name: "Save profile" }));

    await waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0]).toMatchObject({
      githubUrl: "https://github.com/amina-otieno",
      linkedinUrl: "https://www.linkedin.com/in/amina-otieno",
    });
  });

  it("accepts a résumé suggestion as self-described, saved to suggestedSkills and never skillSet (stories 20-23, 26)", async () => {
    const user = userEvent.setup();
    const saved: ProfileInput[] = [];
    const marketplace = fakeMarketplace({
      getProfile: async () => profile({ accountStatus: "confirmed", confirmed: true }),
      ...noRows,
      suggestSkills: async (): Promise<SkillSuggestions> => ({
        available: true,
        suggestions: [{ label: "Rust", skillId: "rust" }],
      }),
      putProfile: async (input) => {
        saved.push(input);
        return profile({ ...input, accountStatus: "confirmed", confirmed: true });
      },
    });

    render(<App initialPath="/profile" source={source} auth={builderAuth} marketplace={marketplace} />);

    expect(
      await screen.findByText("Your text is sent to Anthropic's Claude to suggest skills and is not stored."),
    ).toBeInTheDocument();
    const textarea = screen.getByLabelText("Suggest from résumé");
    await user.type(textarea, "x".repeat(60));
    await user.click(screen.getByRole("button", { name: "Suggest skills" }));

    const suggestions = await screen.findByRole("list", { name: "Résumé suggestions" });
    const chip = within(suggestions).getByText("Rust");
    expect(chip).toBeInTheDocument();
    await user.click(within(suggestions).getByRole("button", { name: "Accept Rust" }));

    expect(screen.queryByRole("list", { name: "Résumé suggestions" })).not.toBeInTheDocument();
    const selfDescribed = screen.getByRole("list", { name: "Suggested skills" });
    expect(within(selfDescribed).getByText("Rust")).toBeInTheDocument();
    expect(screen.getByText("Self-described")).toBeInTheDocument();

    const form = await screen.findByRole("form", { name: "Builder profile" });
    await user.click(within(form).getByRole("button", { name: "Save profile" }));
    await waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0]!.suggestedSkills).toEqual(["Rust"]);
    expect(saved[0]!.skillSet).toEqual([]);
  });

  it('disables the Suggest button with "Suggestions need the assistant; add skills by hand." when unavailable, while the manual picker keeps working (story 25)', async () => {
    const user = userEvent.setup();
    const marketplace = fakeMarketplace({
      getProfile: async () => profile({ accountStatus: "confirmed", confirmed: true }),
      ...noRows,
      suggestSkills: async (): Promise<SkillSuggestions> => ({ available: false, suggestions: [] }),
    });

    render(<App initialPath="/profile" source={source} auth={builderAuth} marketplace={marketplace} />);

    const textarea = await screen.findByLabelText("Suggest from résumé");
    await user.type(textarea, "x".repeat(60));
    await user.click(screen.getByRole("button", { name: "Suggest skills" }));

    const disabled = await screen.findByRole("button", { name: "Suggestions need the assistant; add skills by hand." });
    expect(disabled).toBeDisabled();

    const skillInput = screen.getByLabelText("Skill set");
    await user.type(skillInput, "Growth hacking");
    await user.click(screen.getByRole("button", { name: "Add skill" }));
    expect(screen.getByText("Growth hacking")).toBeInTheDocument();
  });
});

describe("/profile certifications (spec #86 stories 14-16)", () => {
  it("adds a certification with an issue date and a verification link, with no vocabulary skill", async () => {
    const user = userEvent.setup();
    const posted: CredentialInput[] = [];
    const marketplace = fakeMarketplace({
      getProfile: async () => profile({ accountStatus: "confirmed", confirmed: true }),
      ...noRows,
      postCredential: async (input) => {
        posted.push(input);
        return {
          id: "cred-2",
          title: input.title,
          issuer: input.issuer,
          skillId: input.skillId ?? null,
          issuedOn: input.issuedOn ?? null,
          credentialUrl: input.credentialUrl ?? null,
          status: "pending",
          demoData: true,
        };
      },
    });

    render(<App initialPath="/profile" source={source} auth={builderAuth} marketplace={marketplace} />);

    const form = await screen.findByRole("form", { name: "Add credential" });
    await user.type(within(form).getByLabelText("Credential title"), "Public speaking workshop");
    await user.type(within(form).getByLabelText("Issuer"), "Toastmasters Nairobi");
    await user.type(within(form).getByLabelText("Issue date"), "2026-05-01");
    await user.type(within(form).getByLabelText("Verification link"), "https://example.org/cert/123");
    await user.click(within(form).getByRole("button", { name: "Add credential" }));

    await waitFor(() => expect(posted).toHaveLength(1));
    expect(posted[0]).toMatchObject({
      title: "Public speaking workshop",
      issuer: "Toastmasters Nairobi",
      issuedOn: "2026-05-01",
      credentialUrl: "https://example.org/cert/123",
    });

    const credentials = await screen.findByRole("list", { name: "Credentials" });
    const row = within(credentials).getByRole("listitem", { name: "Public speaking workshop" });
    expect(within(row).getByText(/Display only · no vocabulary skill/)).toBeInTheDocument();
  });
});

describe("/profile Showcase editor (spec #86 stories 1-6)", () => {
  it("shows the status pill and pending note, and saving sends the entry to review", async () => {
    const user = userEvent.setup();
    const saved: { projectId: string; body: ShowcaseEditInput }[] = [];
    const marketplace = fakeMarketplace({
      getProfile: async () => profile({ accountStatus: "confirmed", confirmed: true }),
      listCredentials: async () => [],
      listProjects: async () => [showcaseProject()],
      saveShowcase: async (projectId, body) => {
        saved.push({ projectId, body });
        return showcaseProject({ ...body, showcaseStatus: "pending" });
      },
    });

    render(<App initialPath="/profile" source={source} auth={builderAuth} marketplace={marketplace} />);

    const projects = await screen.findByRole("list", { name: "Projects" });
    const row = within(projects).getByRole("listitem", { name: "Venture Route" });
    expect(within(row).getByText("Not shown")).toBeInTheDocument();
    await user.click(within(row).getByRole("button", { name: "Edit showcase" }));

    const editor = within(row).getByRole("form", { name: "Showcase details for Venture Route" });
    await user.type(within(editor).getByLabelText("Description"), "The MeTTa-routed marketplace.");
    await user.click(within(editor).getByRole("checkbox", { name: "Show on Showcase" }));
    await user.click(within(editor).getByRole("button", { name: "Save showcase details" }));

    await waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0]!.projectId).toBe("proj-1");
    expect(saved[0]!.body).toMatchObject({ description: "The MeTTa-routed marketplace.", showcased: true });

    expect(await within(row).findByText("Pending review")).toBeInTheDocument();
    expect(
      within(row).getByText("A BASIX admin reviews every change before it goes live."),
    ).toBeInTheDocument();
  });
});
