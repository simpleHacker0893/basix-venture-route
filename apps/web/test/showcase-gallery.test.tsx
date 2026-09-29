/**
 * Seam: rendered /showcase through React Testing Library (D-19, Sprint 005a #104). Driven through
 * the full App with a fake MarketplaceApi whose `showcase.list` records every call's params, so
 * the tests prove the filters, search, licensable toggle and paging build the right query and
 * keep it in the URL (spec #86 stories 30-38, acceptance §Part A Must 7 second bullet).
 */
import type { ShowcaseCard, ShowcasePage } from "@venture-route/contracts";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import type { ShowcaseListParams } from "../src/api/marketplace";
import { renderApp } from "./fakeEngine";
import { DEMO_SHOWCASE_CARD, DEMO_SHOWCASE_DETAIL, fakeMarketplace } from "./fakeMarketplace";

function card(overrides: Partial<ShowcaseCard> = {}): ShowcaseCard {
  return { ...DEMO_SHOWCASE_CARD, ...overrides };
}

/** Records every `showcase.list` call and answers with `page` (or `pages` in order, last held). */
function recordingList(pages: ShowcasePage[]) {
  const calls: ShowcaseListParams[] = [];
  const list = async (params: ShowcaseListParams = {}): Promise<ShowcasePage> => {
    calls.push(params);
    return pages[Math.min(calls.length - 1, pages.length - 1)]!;
  };
  return { calls, list };
}

function marketplaceWith(list: ReturnType<typeof recordingList>["list"]) {
  return fakeMarketplace({ showcase: { list, get: async () => DEMO_SHOWCASE_DETAIL } });
}

describe("/showcase gallery: cards, filters, search and paging", () => {
  it("renders cards with the Demo data pill and re-fetches with the skill filter, labelling the matched kind", async () => {
    const first: ShowcasePage = { items: [card()], total: 1 };
    const filtered: ShowcasePage = {
      items: [card({ matchedSkill: { id: null, label: "Product thinking", kind: "self-described" } })],
      total: 1,
    };
    const { calls, list } = recordingList([first, filtered]);
    renderApp("/showcase", undefined, { marketplace: marketplaceWith(list) });

    expect(await screen.findByRole("heading", { level: 3, name: "Venture Route" })).toBeInTheDocument();
    expect(screen.getByText("Demo data")).toBeInTheDocument();

    const skillGroup = screen.getByRole("group", { name: "Skill" });
    await userEvent.setup().click(within(skillGroup).getByRole("button", { name: "Python" }));

    await waitFor(() => expect(calls).toHaveLength(2));
    expect(calls[1]).toMatchObject({ skill: "python" });
    const chip = await screen.findByTestId("matched-skill-chip");
    expect(chip).toHaveTextContent("Self-described");
    expect(chip).not.toHaveTextContent("Verified");
  });

  it("omits the licensable param when the toggle is switched back off", async () => {
    const page: ShowcasePage = { items: [card()], total: 1 };
    const { calls, list } = recordingList([page, page, page]);
    renderApp("/showcase", undefined, { marketplace: marketplaceWith(list) });
    const user = userEvent.setup();

    await screen.findByRole("heading", { level: 3, name: "Venture Route" });
    const toggle = screen.getByRole("checkbox", { name: "Licensable IP" });
    await user.click(toggle);
    await waitFor(() => expect(calls).toHaveLength(2));
    expect(calls[1]).toMatchObject({ licensable: true });

    await user.click(toggle);
    await waitFor(() => expect(calls).toHaveLength(3));
    expect(calls[2]).not.toHaveProperty("licensable");
  });

  it("keeps filters in the URL query string and restores them on load", async () => {
    const page: ShowcasePage = { items: [card()], total: 1 };
    const { calls, list } = recordingList([page]);
    renderApp("/showcase?vertical=health&skill=python&q=triage&licensable=true", undefined, {
      marketplace: marketplaceWith(list),
    });

    await screen.findByRole("heading", { level: 3, name: "Venture Route" });
    expect(calls[0]).toMatchObject({ vertical: "health", skill: "python", q: "triage", licensable: true });

    const verticalGroup = screen.getByRole("group", { name: "Vertical" });
    expect(within(verticalGroup).getByRole("button", { name: "Health" })).toHaveAttribute("aria-pressed", "true");
    const skillGroup = screen.getByRole("group", { name: "Skill" });
    expect(within(skillGroup).getByRole("button", { name: "Python" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("checkbox", { name: "Licensable IP" })).toBeChecked();
    expect(screen.getByRole("searchbox", { name: "Search by title" })).toHaveValue("triage");
  });

  it("shows the empty state and clears every filter on 'Clear filters'", async () => {
    const empty: ShowcasePage = { items: [], total: 0 };
    const page: ShowcasePage = { items: [card()], total: 1 };
    const { calls, list } = recordingList([empty, page]);
    renderApp("/showcase?vertical=health", undefined, { marketplace: marketplaceWith(list) });
    const user = userEvent.setup();

    expect(await screen.findByText("No showcase entries match these filters.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear filters" }));

    await waitFor(() => expect(calls).toHaveLength(2));
    expect(calls[1]).not.toHaveProperty("vertical");
    await screen.findByRole("heading", { level: 3, name: "Venture Route" });
  });

  it("shows only the links present, each opening in a new tab safely, and no iframe on the gallery", async () => {
    const page: ShowcasePage = {
      items: [card({ liveUrl: "https://example.org/live", demoUrl: null, pitchDeckUrl: "https://example.org/deck" })],
      total: 1,
    };
    const { list } = recordingList([page]);
    renderApp("/showcase", undefined, { marketplace: marketplaceWith(list) });

    await screen.findByRole("heading", { level: 3, name: "Venture Route" });
    const live = screen.getByRole("link", { name: "Live" });
    expect(live).toHaveAttribute("href", "https://example.org/live");
    expect(live).toHaveAttribute("target", "_blank");
    expect(live).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.queryByRole("link", { name: "Demo" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Deck" })).toBeInTheDocument();
    expect(document.querySelectorAll("iframe")).toHaveLength(0);
    expect(screen.getByText("No video")).toBeInTheDocument();
  });

  it('shows the pager "Showing 1-12 of N" and pages with Previous/Next', async () => {
    const items = Array.from({ length: 12 }, (_, i) => card({ id: `p-${i}`, title: `Project ${i}` }));
    const firstPage: ShowcasePage = { items, total: 14 };
    const secondPage: ShowcasePage = { items: [card({ id: "p-12", title: "Project 12" })], total: 14 };
    const { calls, list } = recordingList([firstPage, secondPage]);
    renderApp("/showcase", undefined, { marketplace: marketplaceWith(list) });
    const user = userEvent.setup();

    expect(await screen.findByText("Showing 1–12 of 14")).toBeInTheDocument();
    const previous = screen.getByRole("button", { name: "Previous" });
    expect(previous).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(calls).toHaveLength(2));
    expect(calls[1]).toMatchObject({ offset: 12 });
    expect(await screen.findByText("Showing 13–13 of 14")).toBeInTheDocument();
  });
});
