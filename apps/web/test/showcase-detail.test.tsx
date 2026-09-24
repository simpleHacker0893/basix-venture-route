/**
 * Seam: rendered screens through React Testing Library (D-19, Sprint 005a #105). `/showcase/:id`
 * is driven through the full App with an injected auth state and a fake marketplace API. Named
 * risks: the pitch video must never load before the visitor clicks, external links must never
 * open without `rel="noopener noreferrer"`, and no contact detail may ever render here (D-43).
 */
import type { ShowcaseDetail } from "@venture-route/contracts";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { ApiNotFoundError } from "../src/api/client";
import { createOfflineSource } from "../src/api/offline";
import { App } from "../src/App";
import type { AuthState } from "../src/auth/authContext";
import { DEMO_SHOWCASE_DETAIL, fakeMarketplace } from "./fakeMarketplace";

const source = createOfflineSource();

const founderAuth: AuthState = {
  configured: true,
  isLoaded: true,
  isSignedIn: true,
  role: "founder",
  getToken: async () => "tok-founder",
  reload: async () => undefined,
  signOut: async () => undefined,
};

const builderAuth: AuthState = { ...founderAuth, role: "builder", getToken: async () => "tok-builder" };

const PITCH_ID = "dQw4w9WgXcQ";

/** The demo fixture plus a pitch video and a confirmed certification, for this ticket's assertions only. */
const DETAIL: ShowcaseDetail = {
  ...DEMO_SHOWCASE_DETAIL,
  pitchVideoUrl: "https://youtu.be/dQw4w9WgXcQ",
  pitchVideoId: PITCH_ID,
  builder: {
    ...DEMO_SHOWCASE_DETAIL.builder,
    certifications: [
      {
        id: "cred-1",
        title: "MeTTa fundamentals",
        issuer: "BASIX Academy",
        skillId: "ai-metta",
        issuedOn: "2026-03-12",
        credentialUrl: "https://example.org/verify/cred-1",
        status: "confirmed",
        demoData: true,
      },
    ],
  },
};

function renderDetail(auth: AuthState | undefined, get: () => Promise<ShowcaseDetail> = async () => DETAIL) {
  const marketplace = fakeMarketplace({ showcase: { list: async () => ({ items: [], total: 0 }), get } });
  return render(<App initialPath="/showcase/venture-route" source={source} auth={auth} marketplace={marketplace} />);
}

describe("/showcase/:projectId (#105)", () => {
  it("loads no iframe until Play pitch is clicked, then embeds the nocookie player for the id", async () => {
    const user = userEvent.setup();
    renderDetail(undefined);

    expect(await screen.findByRole("heading", { level: 1, name: "Venture Route" })).toBeInTheDocument();
    expect(screen.queryByTitle(/pitch video/i)).not.toBeInTheDocument();
    expect(document.querySelector("iframe")).not.toBeInTheDocument();
    expect(screen.getByText(/loads from YouTube when you press play/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Play pitch" }));

    const iframe = await screen.findByTitle(/pitch video/i);
    expect(iframe.tagName).toBe("IFRAME");
    expect(iframe).toHaveAttribute("src", `https://www.youtube-nocookie.com/embed/${PITCH_ID}?autoplay=1`);
    expect(document.querySelectorAll("iframe")).toHaveLength(1);
  });

  it("shows 'No pitch video' when the project has none", async () => {
    renderDetail(undefined, async () => ({ ...DETAIL, pitchVideoUrl: null, pitchVideoId: null }));

    await screen.findByRole("heading", { level: 1, name: "Venture Route" });
    expect(screen.getByText("No pitch video")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Play pitch" })).not.toBeInTheDocument();
  });

  it("gives every external link rel=noopener noreferrer and target=_blank", async () => {
    renderDetail(undefined);
    await screen.findByRole("heading", { level: 1, name: "Venture Route" });

    for (const name of ["Live app", "Demo", "Pitch deck", "Verify"]) {
      const link = screen.getByRole("link", { name });
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    }
    const github = screen.getByRole("link", { name: /github/i });
    expect(github).toHaveAttribute("rel", "noopener noreferrer");
    expect(github).toHaveAttribute("target", "_blank");
    const linkedin = screen.getByRole("link", { name: /linkedin/i });
    expect(linkedin).toHaveAttribute("rel", "noopener noreferrer");
    expect(linkedin).toHaveAttribute("target", "_blank");

    expect(screen.getAllByText("Opens in a new tab").length).toBeGreaterThan(0);
  });

  it("shows the demonstrated skills, licensable/demo pills and about section", async () => {
    renderDetail(undefined);
    await screen.findByRole("heading", { level: 1, name: "Venture Route" });

    expect(screen.getByRole("heading", { name: "About this project" })).toBeInTheDocument();
    expect(screen.getByText(DETAIL.description)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Demonstrated skills" })).toBeInTheDocument();
    expect(screen.getAllByText("Demo data").length).toBeGreaterThan(0);
  });

  it("labels skillSet chips 'Self-described' and never 'verified'", async () => {
    renderDetail(undefined);
    await screen.findByRole("heading", { level: 1, name: "Venture Route" });

    const section = screen.getByRole("region", { name: "Self-described" });
    for (const label of DETAIL.builder.skillSet) {
      expect(within(section).getByText(label)).toBeInTheDocument();
    }
    expect(within(section).queryByText(/verified/i)).not.toBeInTheDocument();
  });

  it("shows certifications with a Verify link", async () => {
    renderDetail(undefined);
    await screen.findByRole("heading", { level: 1, name: "Venture Route" });

    const certs = screen.getByRole("region", { name: "Certifications" });
    expect(within(certs).getByText("MeTTa fundamentals")).toBeInTheDocument();
    expect(within(certs).getByText("BASIX Academy")).toBeInTheDocument();
    expect(within(certs).getByRole("link", { name: "Verify" })).toHaveAttribute(
      "href",
      "https://example.org/verify/cred-1",
    );
  });

  it("sends a signed-in founder to /builders/:id on View builder", async () => {
    renderDetail(founderAuth);
    await screen.findByRole("heading", { level: 1, name: "Venture Route" });

    const viewBuilder = screen.getByRole("link", { name: "View builder" });
    expect(viewBuilder).toHaveAttribute("href", "/builders/demo-njuguna-njenga");
    expect(screen.getByText("Contact details are shown only to signed-in founders.")).toBeInTheDocument();
  });

  it("sends a signed-out visitor to /sign-in on View builder", async () => {
    renderDetail(undefined);
    await screen.findByRole("heading", { level: 1, name: "Venture Route" });

    expect(screen.getByRole("link", { name: "View builder" })).toHaveAttribute("href", "/sign-in");
  });

  it("sends a signed-in builder to /sign-in on View builder (founders only see contact)", async () => {
    renderDetail(builderAuth);
    await screen.findByRole("heading", { level: 1, name: "Venture Route" });

    expect(screen.getByRole("link", { name: "View builder" })).toHaveAttribute("href", "/sign-in");
  });

  it("never renders any contact detail", async () => {
    renderDetail(founderAuth);
    await screen.findByRole("heading", { level: 1, name: "Venture Route" });

    expect(screen.queryByText(/@/)).not.toBeInTheDocument();
    expect(screen.queryByText(/email/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/phone/i)).not.toBeInTheDocument();
  });

  it("shows the not-found state for a hidden or missing project", async () => {
    renderDetail(undefined, async () => {
      throw new ApiNotFoundError("no confirmed showcase entry");
    });

    expect(await screen.findByText("This project isn't on the Showcase.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to Showcase" })).toHaveAttribute("href", "/showcase");
  });

  it("shows a generic error state for other failures", async () => {
    renderDetail(undefined, async () => {
      throw new Error("network down");
    });

    expect(await screen.findByRole("alert")).toHaveTextContent(/could not be loaded/i);
  });
});
