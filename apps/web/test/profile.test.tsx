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

import { ApiNotFoundError, ApiValidationError } from "../src/api/client";
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
    hourlyRate: 19,
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
    // The page content says nothing about bids; the app shell's nav links to them.
    expect(within(screen.getByRole("main")).queryByText(/bids/)).not.toBeInTheDocument();
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
    await user.type(within(form).getByLabelText("Hourly rate (USD, 0–50)"), "19");
    await user.click(within(form).getByRole("checkbox", { name: "Remote" }));
    // Two months side by side: October's grid repeats September's last days as outside days.
    await user.click((await screen.findAllByRole("button", { name: /September 22nd, 2026/ }))[0]!);
    await user.click(screen.getAllByRole("button", { name: /September 29th, 2026/ })[0]!);
    await user.click(within(form).getByRole("button", { name: "Save profile" }));

    await waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0]).toMatchObject({
      displayName: "Amina Otieno",
      location: "Nairobi",
      hourlyRate: 19,
      modes: { remote: true, hybrid: false, onSite: false },
      availability: [{ start: "2026-09-22", end: "2026-09-29" }],
    });
    expect(saved[0]!.availability).toHaveLength(1);
    expect(await screen.findByText("Profile saved.")).toBeInTheDocument();
    // Two calendar months plus typed fields through the full app shell are slow in jsdom under parallel workers.
  }, 40_000);

  it("labels the rate per hour as a whole number from 0 to 50 and shows the bound inline (D-59)", async () => {
    const user = userEvent.setup();
    const saved: ProfileInput[] = [];
    const marketplace = fakeMarketplace({
      getProfile: async () => profile(),
      putProfile: async (input) => {
        saved.push(input);
        return profile({ ...input });
      },
      ...noRows,
    });

    render(<App initialPath="/profile" source={source} auth={builderAuth} marketplace={marketplace} />);

    const form = await screen.findByRole("form", { name: "Builder profile" });
    const rate = within(form).getByLabelText("Hourly rate (USD, 0–50)");
    expect(rate).toHaveValue(19);
    expect(rate).toHaveAttribute("min", "0");
    expect(rate).toHaveAttribute("max", "50");
    expect(rate).toHaveAttribute("step", "1");
    expect(within(form).getByText("an hour")).toBeInTheDocument();

    await user.clear(rate);
    await user.type(rate, "51");
    await user.click(within(form).getByRole("button", { name: "Save profile" }));

    expect(await within(form).findByRole("alert")).toHaveAttribute("id", "error-hourlyRate");
    expect(rate).toHaveAttribute("aria-invalid", "true");
    expect(saved).toHaveLength(0);

    await user.clear(rate);
    await user.type(rate, "0");
    await user.click(within(form).getByRole("button", { name: "Save profile" }));

    await waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0]!.hourlyRate).toBe(0);
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
  it("posts the project with two skills and licensable on, then returns to My showcase", async () => {
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
    await user.click(within(form).getByRole("button", { name: "Save project" }));

    await waitFor(() =>
      expect(posted).toEqual([
        { title: "Clinic triage intake flow", vertical: "health", licensable: true, completedOn: "2026-08-31", skillIds: ["python", "ui-ux"] },
      ]),
    );
    expect(await screen.findByRole("heading", { level: 1, name: "My showcase" })).toBeInTheDocument();
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

    expect(textarea).toHaveAccessibleDescription("Your text is sent to Anthropic's Claude to suggest skills and is not stored.");

    const suggestions = await screen.findByRole("list", { name: "Résumé suggestions" });
    const chip = within(suggestions).getByText("Rust");
    expect(chip).toBeInTheDocument();
    await user.click(within(suggestions).getByRole("button", { name: "Accept Rust" }));

    expect(screen.queryByRole("list", { name: "Résumé suggestions" })).not.toBeInTheDocument();
    const selfDescribed = screen.getByRole("list", { name: "Suggested skills" });
    expect(within(selfDescribed).getByText("Rust")).toBeInTheDocument();
    expect(screen.getByText("Save your profile to keep these.")).toBeInTheDocument();
    // "Self-described" is shown as a badge on both chip groups (hand-picked and résumé-accepted).
    expect(screen.getAllByText("Self-described")).toHaveLength(2);
    // The picker's own counter is the combined total across both lists (fix round 1, item 2):
    // one accepted suggestion and zero hand-picked skills reads "1 / 20", not "0 / 19".
    expect(screen.getByText("1 / 20")).toBeInTheDocument();

    const form = await screen.findByRole("form", { name: "Builder profile" });
    await user.click(within(form).getByRole("button", { name: "Save profile" }));
    await waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0]!.suggestedSkills).toEqual(["Rust"]);
    expect(saved[0]!.skillSet).toEqual([]);
  });

  it("ignores a duplicate typed into the picker even when it only duplicates an accepted résumé chip (fix round 1, item 1)", async () => {
    const user = userEvent.setup();
    const marketplace = fakeMarketplace({
      getProfile: async () => profile({ accountStatus: "confirmed", confirmed: true }),
      ...noRows,
      suggestSkills: async (): Promise<SkillSuggestions> => ({
        available: true,
        suggestions: [{ label: "Rust", skillId: "rust" }],
      }),
    });

    render(<App initialPath="/profile" source={source} auth={builderAuth} marketplace={marketplace} />);

    const textarea = await screen.findByLabelText("Suggest from résumé");
    await user.type(textarea, "x".repeat(60));
    await user.click(screen.getByRole("button", { name: "Suggest skills" }));
    const suggestions = await screen.findByRole("list", { name: "Résumé suggestions" });
    await user.click(within(suggestions).getByRole("button", { name: "Accept Rust" }));
    await screen.findByRole("list", { name: "Suggested skills" });

    const skillInput = screen.getByLabelText("Skill set");
    await user.type(skillInput, "rust");
    await user.click(screen.getByRole("button", { name: "Add skill" }));

    // Not added to skillSet: the picker checks the combined list (skillSet + suggestedSkills)
    // case-insensitively, so "rust" here would otherwise 422 against the engine's own check.
    // No `skillSet` chip list renders at all: nothing was ever added to it.
    expect(screen.queryByRole("list", { name: "Skill set" })).not.toBeInTheDocument();
    expect(screen.getByText("1 / 20")).toBeInTheDocument();
  });

  it("keeps a résumé chip on screen and shows why when it duplicates the skill set or the 20-skill cap is reached (fix round 1, item 3)", async () => {
    const user = userEvent.setup();
    const existing = Array.from({ length: 19 }, (_, i) => `Existing skill ${i}`);
    const marketplace = fakeMarketplace({
      getProfile: async () => profile({ accountStatus: "confirmed", confirmed: true, skillSet: ["Rust", ...existing] }),
      ...noRows,
      suggestSkills: async (): Promise<SkillSuggestions> => ({
        available: true,
        suggestions: [
          { label: "rust", skillId: "rust" },
          { label: "Go", skillId: null },
        ],
      }),
    });

    render(<App initialPath="/profile" source={source} auth={builderAuth} marketplace={marketplace} />);

    const textarea = await screen.findByLabelText("Suggest from résumé");
    await user.type(textarea, "x".repeat(60));
    await user.click(screen.getByRole("button", { name: "Suggest skills" }));
    const suggestions = await screen.findByRole("list", { name: "Résumé suggestions" });

    await user.click(within(suggestions).getByRole("button", { name: "Accept rust" }));
    expect(within(suggestions).getByText("rust")).toBeInTheDocument();
    expect(within(suggestions).getByText("Already in your skill set")).toBeInTheDocument();

    await user.click(within(suggestions).getByRole("button", { name: "Accept Go" }));
    expect(within(suggestions).getByText("Go")).toBeInTheDocument();
    expect(within(suggestions).getByText("20-skill limit reached")).toBeInTheDocument();

    expect(screen.queryByRole("list", { name: "Suggested skills" })).not.toBeInTheDocument();
  });

  it('keeps the Suggest button named "Suggest skills" but disabled, describing "Suggestions need the assistant; add skills by hand." when unavailable, while the manual picker keeps working (story 25, fix round 1, item 4)', async () => {
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

    const button = await screen.findByRole("button", { name: "Suggest skills" });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription("Suggestions need the assistant; add skills by hand.");
    expect(screen.getByText("Suggestions need the assistant; add skills by hand.")).toBeInTheDocument();

    const skillInput = screen.getByLabelText("Skill set");
    await user.type(skillInput, "Growth hacking");
    await user.click(screen.getByRole("button", { name: "Add skill" }));
    expect(screen.getByText("Growth hacking")).toBeInTheDocument();
  });
});

describe("/my-showcase and /profile 422 field messages (Ruling R24)", () => {
  it("shows a 422 message under pitchVideoUrl in the Showcase editor", async () => {
    const user = userEvent.setup();
    const marketplace = fakeMarketplace({
      getProfile: async () => profile({ accountStatus: "confirmed", confirmed: true }),
      listCredentials: async () => [],
      listProjects: async () => [showcaseProject()],
      saveShowcase: async () => {
        throw new ApiValidationError({ type: "validation-error", message: "pitchVideoUrl: only YouTube links are supported" });
      },
    });

    render(<App initialPath="/my-showcase" source={source} auth={builderAuth} marketplace={marketplace} />);

    const projects = await screen.findByRole("list", { name: "Projects" });
    const row = within(projects).getByRole("listitem", { name: "Venture Route" });
    await user.click(within(row).getByRole("button", { name: "Edit details and links" }));
    const editor = within(row).getByRole("form", { name: "Showcase details for Venture Route" });
    await user.type(within(editor).getByLabelText("YouTube pitch link"), "https://example.com/not-youtube");
    await user.click(within(editor).getByRole("button", { name: "Save showcase details" }));

    expect(await within(editor).findByText("only YouTube links are supported")).toBeInTheDocument();
  });

  it("shows a 422 message under githubUrl on the profile form", async () => {
    const user = userEvent.setup();
    const marketplace = fakeMarketplace({
      getProfile: async () => profile({ accountStatus: "confirmed", confirmed: true }),
      ...noRows,
      putProfile: async () => {
        throw new ApiValidationError({ type: "validation-error", message: "githubUrl: host must be github.com" });
      },
    });

    render(<App initialPath="/profile" source={source} auth={builderAuth} marketplace={marketplace} />);

    const form = await screen.findByRole("form", { name: "Builder profile" });
    await user.type(within(form).getByLabelText("GitHub profile"), "https://example.com/amina");
    await user.click(within(form).getByRole("button", { name: "Save profile" }));

    expect(await within(form).findByText("host must be github.com")).toBeInTheDocument();
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

describe("/my-showcase editor (spec #86 stories 1-6)", () => {
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

    render(<App initialPath="/my-showcase" source={source} auth={builderAuth} marketplace={marketplace} />);

    const projects = await screen.findByRole("list", { name: "Projects" });
    const row = within(projects).getByRole("listitem", { name: "Venture Route" });
    expect(within(row).getByTestId("state-pill")).toHaveTextContent("Draft");
    const toggle = within(row).getByRole("button", { name: "Edit details and links" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await user.click(toggle);
    // The toggle keeps its name; the open state is `aria-expanded`, not a renamed "Close" button.
    expect(within(row).getByRole("button", { name: "Edit details and links" })).toHaveAttribute("aria-expanded", "true");

    const editor = within(row).getByRole("form", { name: "Showcase details for Venture Route" });
    await user.type(within(editor).getByLabelText("Description"), "The MeTTa-routed marketplace.");
    await user.click(within(editor).getByRole("checkbox", { name: "Show on Showcase" }));
    await user.click(within(editor).getByRole("button", { name: "Save showcase details" }));

    await waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0]!.projectId).toBe("proj-1");
    expect(saved[0]!.body).toMatchObject({ description: "The MeTTa-routed marketplace.", showcased: true });

    expect(await within(row).findByText("Waiting for review")).toBeInTheDocument();
    expect(within(row).getByText("Not public yet. BASIX is reviewing this project.")).toBeInTheDocument();
  });
});

describe("/profile/projects/new links", () => {
  const created = (input: ProjectInput): ShowcaseProject => ({
    id: "proj-1",
    ...input,
    status: "pending",
    demoData: true,
    description: "",
    liveUrl: null,
    demoUrl: null,
    pitchVideoUrl: null,
    pitchDeckUrl: null,
    showcased: false,
    showcaseStatus: "none",
  });

  async function fillRequired(user: ReturnType<typeof userEvent.setup>) {
    const form = await screen.findByRole("form", { name: "Add a showcase project" });
    await user.type(within(form).getByLabelText("Project title"), "Clinic triage intake flow");
    await user.click(within(form).getByRole("radio", { name: "Health" }));
    await user.click(within(form).getByRole("checkbox", { name: "Python" }));
    await user.type(within(form).getByLabelText("Completion date"), "2026-08-31");
    return form;
  }

  it("saves the links through the showcase endpoint with showcased off by default", async () => {
    const user = userEvent.setup();
    const saved: { projectId: string; body: ShowcaseEditInput }[] = [];
    const marketplace = fakeMarketplace({
      getProfile: async () => profile({ accountStatus: "confirmed", confirmed: true }),
      ...noRows,
      postProject: async (input) => created(input),
      saveShowcase: async (projectId, body) => {
        saved.push({ projectId, body });
        return showcaseProject({ ...body, showcaseStatus: "none" });
      },
    });
    render(<App initialPath="/profile/projects/new" source={source} auth={builderAuth} marketplace={marketplace} />);

    const form = await fillRequired(user);
    await user.type(within(form).getByLabelText("Project link"), "https://github.com/amina/triage");
    await user.type(within(form).getByLabelText("Demo link"), "https://triage.example.org");
    await user.click(within(form).getByRole("button", { name: "Save project" }));

    await waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0]!.projectId).toBe("proj-1");
    expect(saved[0]!.body).toMatchObject({
      liveUrl: "https://github.com/amina/triage",
      demoUrl: "https://triage.example.org",
      showcased: false,
    });
    expect(await screen.findByRole("heading", { level: 1, name: "My showcase" })).toBeInTheDocument();
  });

  it("sends showcased true when Show on Showcase is on", async () => {
    const user = userEvent.setup();
    const saved: ShowcaseEditInput[] = [];
    const marketplace = fakeMarketplace({
      getProfile: async () => profile({ accountStatus: "confirmed", confirmed: true }),
      ...noRows,
      postProject: async (input) => created(input),
      saveShowcase: async (_id, body) => {
        saved.push(body);
        return showcaseProject({ ...body, showcaseStatus: "pending" });
      },
    });
    render(<App initialPath="/profile/projects/new" source={source} auth={builderAuth} marketplace={marketplace} />);

    const form = await fillRequired(user);
    await user.type(within(form).getByLabelText("Project link"), "https://triage.example.org");
    await user.click(within(form).getByRole("checkbox", { name: "Show on Showcase" }));
    await user.click(within(form).getByRole("button", { name: "Save project" }));

    await waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0]).toMatchObject({ showcased: true });
  });

  it("sends the project to review (showcased true, no links) when only the box is ticked, with the helper text", async () => {
    const user = userEvent.setup();
    const saved: ShowcaseEditInput[] = [];
    const marketplace = fakeMarketplace({
      getProfile: async () => profile({ accountStatus: "pending" }),
      ...noRows,
      postProject: async (input) => created(input),
      saveShowcase: async (_id, body) => {
        saved.push(body);
        return showcaseProject({ ...body, showcaseStatus: "pending" });
      },
    });
    render(<App initialPath="/profile/projects/new" source={source} auth={builderAuth} marketplace={marketplace} />);

    const form = await fillRequired(user);
    const box = within(form).getByRole("checkbox", { name: "Show on Showcase" });
    expect(box).not.toBeChecked();
    expect(box).toHaveAccessibleDescription(
      "Sends this project to BASIX for review. It goes public once your account and the project are both confirmed. Leave it off to keep it private for now.",
    );
    expect(await screen.findByText("Your account is still in review. You can save projects now. They stay private until BASIX confirms you.")).toBeInTheDocument();
    await user.click(box);
    await user.click(within(form).getByRole("button", { name: "Save project" }));

    await waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0]).toMatchObject({ showcased: true, liveUrl: null, demoUrl: null });
    expect(await screen.findByRole("heading", { level: 1, name: "My showcase" })).toBeInTheDocument();
  });

  it("does not call the showcase endpoint when no link is entered", async () => {
    const user = userEvent.setup();
    let calls = 0;
    const marketplace = fakeMarketplace({
      getProfile: async () => profile({ accountStatus: "confirmed", confirmed: true }),
      ...noRows,
      postProject: async (input) => created(input),
      saveShowcase: async () => {
        calls += 1;
        return showcaseProject();
      },
    });
    render(<App initialPath="/profile/projects/new" source={source} auth={builderAuth} marketplace={marketplace} />);

    const form = await fillRequired(user);
    await user.click(within(form).getByRole("button", { name: "Save project" }));

    expect(await screen.findByRole("heading", { level: 1, name: "My showcase" })).toBeInTheDocument();
    expect(calls).toBe(0);
  });

  it("keeps the project and says so when the link save fails", async () => {
    const user = userEvent.setup();
    const marketplace = fakeMarketplace({
      getProfile: async () => profile({ accountStatus: "confirmed", confirmed: true }),
      ...noRows,
      postProject: async (input) => created(input),
      saveShowcase: async () => {
        throw new Error("boom");
      },
    });
    render(<App initialPath="/profile/projects/new" source={source} auth={builderAuth} marketplace={marketplace} />);

    const form = await fillRequired(user);
    await user.type(within(form).getByLabelText("Project link"), "https://triage.example.org");
    await user.click(within(form).getByRole("button", { name: "Save project" }));

    expect(await screen.findByRole("heading", { level: 1, name: "My showcase" })).toBeInTheDocument();
    expect(
      screen.getByText("Project saved. We couldn't save the link. Add it from My showcase."),
    ).toBeInTheDocument();
  });

  it("summarises each project on the profile with its link count and status, and links to My showcase", async () => {
    const marketplace = fakeMarketplace({
      getProfile: async () => profile({ accountStatus: "confirmed", confirmed: true }),
      listCredentials: async () => [],
      listProjects: async () => [
        showcaseProject({ liveUrl: "https://github.com/amina/triage", demoUrl: "https://triage.example.org" }),
        showcaseProject({ id: "proj-2", title: "No link yet" }),
      ],
    });
    render(<App initialPath="/profile" source={source} auth={builderAuth} marketplace={marketplace} />);

    const projects = await screen.findByRole("list", { name: "Projects" });
    const linked = within(projects).getByRole("listitem", { name: "Venture Route" });
    expect(linked).toHaveTextContent("2 links");
    expect(linked).toHaveTextContent("Draft");
    expect(within(projects).getByRole("listitem", { name: "No link yet" })).toHaveTextContent("no link yet");
    const card = screen.getByRole("region", { name: "Showcase projects" });
    expect(within(card).getByRole("link", { name: /Manage in My showcase/ })).toHaveAttribute("href", "/my-showcase");
    expect(within(card).getByRole("link", { name: "Add a project" })).toHaveAttribute("href", "/profile/projects/new");
  });
});


describe("/profile layout: strength rail and section checklist", () => {
  it("shows profile strength from the existing fields and a checklist that scrolls to each card", async () => {
    const user = userEvent.setup();
    const scrolled: string[] = [];
    const original = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function scrollIntoView(this: Element) {
      scrolled.push(this.id);
    };
    try {
      const marketplace = fakeMarketplace({
        getProfile: async () => profile({ accountStatus: "pending", skillSet: ["FastAPI"], sharing: { email: true, phone: false, linkedin: false } }),
        listCredentials: async () => [],
        listProjects: async () => [],
      });
      render(<App initialPath="/profile" source={source} auth={builderAuth} marketplace={marketplace} />);

      const strength = await screen.findByRole("region", { name: "Profile strength" });
      // profile() has a name, a headline, skills, availability and an hourly rate, a mode and a location, shared email; no project yet.
      expect(strength).toHaveTextContent("5 of 6 done");
      expect(strength).toHaveTextContent("83%");
      expect(strength).toHaveTextContent("Next: add a project to your showcase.");

      const sections = screen.getByRole("navigation", { name: "Profile sections" });
      const links = within(sections).getAllByRole("link");
      expect(links.map((l) => l.textContent?.replace(/(done|to do)$/, ""))).toEqual([
        "About you",
        "Skills",
        "Availability",
        "Delivery modes",
        "Contact sharing",
        "Showcase projects",
      ]);
      expect(within(sections).getByRole("link", { name: /Showcase projects/ })).toHaveTextContent("to do");
      await user.click(within(sections).getByRole("link", { name: /Availability/ }));
      await user.click(within(sections).getByRole("link", { name: /Showcase projects/ }));
      expect(scrolled).toEqual(["profile-availability", "showcase"]);
    } finally {
      Element.prototype.scrollIntoView = original;
    }
  });

  it("counts sections as they are filled in, without saving", async () => {
    const user = userEvent.setup();
    const marketplace = fakeMarketplace({
      getProfile: async () => profile({ headline: "", sharing: { email: false, phone: false, linkedin: false } }),
      listCredentials: async () => [],
      listProjects: async () => [],
    });
    render(<App initialPath="/profile" source={source} auth={builderAuth} marketplace={marketplace} />);

    const strength = await screen.findByRole("region", { name: "Profile strength" });
    expect(strength).toHaveTextContent("3 of 6 done");
    await user.type(screen.getByLabelText("Headline"), "Python builder");
    expect(strength).toHaveTextContent("4 of 6 done");
    await user.click(screen.getByRole("checkbox", { name: "Share email" }));
    expect(strength).toHaveTextContent("5 of 6 done");
  });

  it("puts the contact-sharing toggles and public links in the one main column and a Save changes button in the top bar", async () => {
    const marketplace = fakeMarketplace({
      getProfile: async () => profile(),
      listCredentials: async () => [],
      listProjects: async () => [],
    });
    render(<App initialPath="/profile" source={source} auth={builderAuth} marketplace={marketplace} />);

    const form = await screen.findByRole("form", { name: "Builder profile" });
    for (const title of ["About you", "Skills", "Availability", "Delivery modes & location", "Contact sharing", "Public profile links", "Account status"]) {
      expect(within(form).getByRole("region", { name: title })).toBeInTheDocument();
    }
    const save = within(screen.getByRole("navigation", { name: "Primary" })).getByRole("button", { name: "Save changes" });
    expect(save).toHaveAttribute("type", "submit");
    expect(save).toHaveAttribute("form", form.id);
  });
});
