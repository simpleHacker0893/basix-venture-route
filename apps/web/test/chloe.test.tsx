/**
 * Seam: RTL for Chloe on /route (Sprint 006 acceptance Must 2-6 and 8, ticket #97). The fake
 * voice provider is injected through `renderApp(path, fetch, { voice })`; only `fetch` and the
 * speech device are faked, the real store, conductor and screens run. The fake records the
 * DISPLAY text Chloe passes to the session (ruling R10); `spokenForm` only applies at the real
 * speech boundary, covered by the last case.
 */
import type { ChatResponse } from "@venture-route/contracts";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { FORM_FALLBACK_HINT } from "../src/chloe/engineHints";
import {
  CONFIRM_NO_REPLY,
  CONFIRM_PROMPT,
  GREETING,
  MIC_ERRORS,
  OFFLINE_ASSISTANT,
  QUESTIONS,
  spokenForm,
  UNREACHABLE,
} from "../src/chloe/script";
import snapshot from "../src/offline/snapshot.json";
import { createFakeVoiceProvider, type FakeVoiceProvider } from "../src/voice/fakeVoiceProvider";
import { selectProvider } from "../src/voice/selectProvider";
import { useVoice, VoiceSessionProvider } from "../src/voice/VoiceSession";
import { clarificationFor, engineFetch, jsonResponse, renderApp, SEED_BRIEFS, type FetchLike } from "./fakeEngine";

const CAPTION = /Routes are computed by MeTTa rules over demo records\. The assistant only translates your/;

type Post = { url: string; body: unknown };

/** The fake engine, recording every POST body so a test can assert what (if anything) was sent. */
function recordingFetch(base: FetchLike = engineFetch()) {
  const posts: Post[] = [];
  const fetchLike: FetchLike = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (init?.method === "POST") posts.push({ url, body: JSON.parse(String(init.body)) });
    return base(input, init);
  };
  const conversationPosts = () => posts.filter((p) => p.url.endsWith("/api/conversation"));
  return { fetchLike, posts, conversationPosts };
}

/** The engine's NullAdapter clarification: the form-fallback hint prefixes the template list. */
function keylessClarificationFor(partial: Record<string, unknown>): ChatResponse {
  const base = clarificationFor(partial);
  if (base.type !== "clarification") throw new Error("expected a clarification");
  return { ...base, message: `${FORM_FALLBACK_HINT}\n\n${base.message}` };
}

async function enableVoice(user: ReturnType<typeof userEvent.setup>) {
  const toggle = await screen.findByRole("switch", { name: "Voice: Chloe" });
  await user.click(toggle);
  expect(toggle).toHaveAttribute("aria-checked", "true");
}

/** Push-to-talk: press the mic, let the fake recogniser hear `text`, release. */
async function holdAndSay(user: ReturnType<typeof userEvent.setup>, voice: FakeVoiceProvider, text: string | null) {
  const mic = await screen.findByTestId("mic-button");
  await user.pointer({ keys: "[MouseLeft>]", target: mic });
  if (text !== null) act(() => voice.transcribe(text));
  await user.pointer({ keys: "[/MouseLeft]", target: mic });
}

async function openScenarioInChat(user: ReturnType<typeof userEvent.setup>, chip: string) {
  await user.click(await screen.findByRole("button", { name: `Load scenario: ${chip}` }));
  await user.click(await screen.findByRole("button", { name: "Back to chat" }));
}

describe("Chloe on /route", () => {
  it("speaks the greeting once per session inside the toggle click, and one chloe-turn renders", async () => {
    const voice = createFakeVoiceProvider();
    const user = userEvent.setup();
    renderApp("/route", engineFetch(), { voice });

    await enableVoice(user);
    expect(voice.spoken).toEqual([GREETING]);
    expect(screen.getAllByTestId("chloe-turn")).toHaveLength(1);
    expect(screen.getByTestId("chloe-turn")).toHaveTextContent(GREETING);

    const toggle = screen.getByRole("switch", { name: "Voice: Chloe" });
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-checked", "false");
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-checked", "true");

    expect(voice.spoken).toEqual([GREETING]);
    expect(screen.getAllByTestId("chloe-turn")).toHaveLength(1);
    expect(screen.getByText(CAPTION)).toBeInTheDocument();
  });

  it("asks only the first missing field while the thread shows the engine's full clarification list", async () => {
    const voice = createFakeVoiceProvider();
    const user = userEvent.setup();
    renderApp("/route", engineFetch(), { voice });
    await enableVoice(user);

    await user.type(screen.getByLabelText("Reply to assistant"), "I want to build something for farmers");
    await user.click(screen.getByRole("button", { name: "Send" }));

    const assistant = await screen.findByTestId("assistant-turn");
    expect(assistant).toHaveTextContent("To route this brief I still need:");
    for (const field of ["title", "vertical", "requiredSkills", "maximumTeamSize", "availabilityStart", "availabilityEnd", "deliveryMode", "dailyBudget", "preferReusableIp"]) {
      expect(assistant).toHaveTextContent(`- ${field}:`);
    }
    await waitFor(() => expect(voice.spoken).toEqual([GREETING, QUESTIONS.title]));
    expect(screen.getByText(CAPTION)).toBeInTheDocument();
  });

  it("reads the Health pilot back, and a spoken yes posts the seed brief with no founder turn", async () => {
    const voice = createFakeVoiceProvider();
    const user = userEvent.setup();
    const engine = recordingFetch();
    renderApp("/route", engine.fetchLike, { voice });

    await openScenarioInChat(user, "Health pilot");
    await enableVoice(user);

    await waitFor(() => expect(voice.spoken).toContain(CONFIRM_PROMPT));
    const readBack = voice.spoken.find((line) => line.startsWith("Here's your brief so far."));
    expect(readBack).toContain("USD 400 / day");
    expect(CONFIRM_PROMPT).toContain("Shall I find your route?");
    expect(screen.getByText(CAPTION)).toBeInTheDocument();

    await holdAndSay(user, voice, "yes");

    expect(await screen.findByTestId("status-badge")).toHaveTextContent("Feasible");
    const seed = SEED_BRIEFS.find((b) => b.id === "brief-health-01");
    expect(engine.conversationPosts()).toHaveLength(1);
    expect(engine.conversationPosts()[0]!.body).toEqual({ userMessage: "", currentBrief: seed });
    expect(screen.queryByTestId("founder-turn")).not.toBeInTheDocument();
  });

  it("a spoken 'not yet' after the read-back holds and posts nothing", async () => {
    const voice = createFakeVoiceProvider();
    const user = userEvent.setup();
    const engine = recordingFetch();
    renderApp("/route", engine.fetchLike, { voice });

    await openScenarioInChat(user, "Health pilot");
    await enableVoice(user);
    await waitFor(() => expect(voice.spoken).toContain(CONFIRM_PROMPT));

    await holdAndSay(user, voice, "not yet");

    await waitFor(() => expect(voice.spoken.at(-1)).toBe(CONFIRM_NO_REPLY));
    expect(engine.conversationPosts()).toHaveLength(0);
    expect(screen.getByRole("heading", { level: 1, name: "Describe your MVP" })).toBeInTheDocument();
    expect(screen.getByText(CAPTION)).toBeInTheDocument();
  });

  it("speaks a Constrained route: status, the summary verbatim, the gap and both next actions in order", async () => {
    const voice = createFakeVoiceProvider();
    const user = userEvent.setup();
    renderApp("/route", engineFetch(), { voice });

    await openScenarioInChat(user, "Constrained brief");
    await enableVoice(user);
    await waitFor(() => expect(voice.spoken).toContain(CONFIRM_PROMPT));
    await holdAndSay(user, voice, "go ahead");

    expect(await screen.findByTestId("status-badge")).toHaveTextContent("Partial");
    const route = snapshot.routes["brief-constrained-01"];
    const gap = route.gaps[0]!;
    expect(await screen.findByTestId("gap")).toHaveTextContent(gap.statement);

    await waitFor(() => expect(voice.spoken).toContain("Your route is Partial."));
    const from = voice.spoken.indexOf("Your route is Partial.");
    const routeLines = voice.spoken.slice(from).join("\n");
    const order = ["Your route is Partial.", route.summary, gap.statement, gap.nextActions[0]!, gap.nextActions[1]!];
    const positions = order.map((text) => routeLines.indexOf(text));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(voice.spoken[from + 1]).toBe(route.summary);
  });

  it("announces a keyless engine once, then the mic is dictation only", async () => {
    const voice = createFakeVoiceProvider();
    const user = userEvent.setup();
    const engine = recordingFetch(
      engineFetch({ conversation: () => jsonResponse(keylessClarificationFor({})) }),
    );
    renderApp("/route", engine.fetchLike, { voice });
    await enableVoice(user);

    await user.type(screen.getByLabelText("Reply to assistant"), "a clinic triage tool");
    await user.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(voice.spoken).toEqual([GREETING, OFFLINE_ASSISTANT]));
    expect(OFFLINE_ASSISTANT).toContain("the assistant behind me is offline");

    await user.type(screen.getByLabelText("Reply to assistant"), "for community health workers");
    await user.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(screen.getAllByTestId("assistant-turn")).toHaveLength(2));
    expect(voice.spoken).toEqual([GREETING, OFFLINE_ASSISTANT]);
    expect(engine.conversationPosts()).toHaveLength(2);

    await holdAndSay(user, voice, "hello");

    await waitFor(() => expect(screen.getByLabelText("Reply to assistant")).toHaveValue("hello"));
    expect(engine.conversationPosts()).toHaveLength(2);
    expect(screen.getByText(CAPTION)).toBeInTheDocument();
  });

  it("speaks the unreachable line once when /api/scenarios answers 503", async () => {
    const voice = createFakeVoiceProvider();
    const user = userEvent.setup();
    renderApp("/route", engineFetch({ scenarios: () => jsonResponse({ detail: "down" }, 503) }), { voice });

    const banner = await screen.findByRole("alert");
    expect(within(banner).getByRole("link", { name: "Use the form instead" })).toBeInTheDocument();
    await enableVoice(user);

    await waitFor(() => expect(voice.spoken).toContain(UNREACHABLE));
    expect(UNREACHABLE).toContain("I can't reach the routing engine");
    await user.type(screen.getByLabelText("Reply to assistant"), "x");
    expect(voice.spoken.filter((line) => line === UNREACHABLE)).toHaveLength(1);
  });

  it("speaks a validation-error with the field label", async () => {
    const voice = createFakeVoiceProvider();
    const user = userEvent.setup();
    const fetchLike = engineFetch({
      conversation: () =>
        jsonResponse({ type: "validation-error", message: "availabilityEnd: must be on or after the start date" }, 422),
    });
    renderApp("/route", fetchLike, { voice });
    await enableVoice(user);

    await user.type(screen.getByLabelText("Reply to assistant"), "ends before it starts");
    await user.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() =>
      expect(voice.spoken.at(-1)).toBe(
        "The engine found a problem with the brief: End: must be on or after the start date. Fix it in the brief panel or the form.",
      ),
    );
  });

  it("a no-speech failure on release shows the mic error line, speaks it, and sends nothing", async () => {
    const voice = createFakeVoiceProvider();
    const user = userEvent.setup();
    const engine = recordingFetch();
    renderApp("/route", engine.fetchLike, { voice });
    await enableVoice(user);

    const mic = await screen.findByTestId("mic-button");
    await user.pointer({ keys: "[MouseLeft>]", target: mic });
    act(() => voice.fail("no-speech"));
    await user.pointer({ keys: "[/MouseLeft]", target: mic });

    expect(await screen.findByTestId("mic-error")).toHaveTextContent(MIC_ERRORS["no-speech"]);
    await waitFor(() => expect(voice.spoken.at(-1)).toBe(MIC_ERRORS["no-speech"]));
    expect(voice.spoken.filter((line) => line === MIC_ERRORS["no-speech"])).toHaveLength(1);
    expect(engine.conversationPosts()).toHaveLength(0);
    expect(screen.getByText(CAPTION)).toBeInTheDocument();
  });

  it("a user-driven view change cancels speech and drops the queued lines", async () => {
    const voice = createFakeVoiceProvider({ holdUtterances: true });
    const user = userEvent.setup();
    renderApp("/route", engineFetch(), { voice });

    await openScenarioInChat(user, "Health pilot");
    await enableVoice(user);
    // The greeting is being spoken (held); the read-back and confirm prompt wait in the queue.
    expect(voice.spoken).toEqual([GREETING]);

    await user.click(screen.getByRole("button", { name: "Load scenario: Agri marketplace" }));
    await screen.findByRole("heading", { level: 1, name: "Confirm your brief" });
    act(() => voice.finishSpeaking());

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(voice.spoken).toEqual([GREETING]);
  });

  it("disabling voice resolves a releaseMic still waiting for the recogniser's end", async () => {
    const fake = createFakeVoiceProvider();
    // A recogniser that never reports `end` on its own after stop(), like a slow browser.
    const voice = { ...fake, stopListening: () => undefined };
    function Probe() {
      const session = useVoice();
      const [released, setReleased] = useState<string | null>(null);
      return (
        <div>
          <button onClick={() => session.enable()}>enable</button>
          <button onClick={() => session.pressMic()}>press</button>
          <button onClick={() => void session.releaseMic().then(setReleased)}>release</button>
          <button onClick={() => session.disable()}>disable</button>
          <div data-testid="released">{released === null ? "pending" : `resolved:${released}`}</div>
        </div>
      );
    }
    const user = userEvent.setup();
    render(
      <VoiceSessionProvider voice={voice}>
        <Probe />
      </VoiceSessionProvider>,
    );
    await user.click(screen.getByRole("button", { name: "enable" }));
    await user.click(screen.getByRole("button", { name: "press" }));
    await user.click(screen.getByRole("button", { name: "release" }));
    expect(screen.getByTestId("released")).toHaveTextContent("pending");

    await user.click(screen.getByRole("button", { name: "disable" }));
    expect(await screen.findByTestId("released")).toHaveTextContent("resolved:");
  });

  it("applies spokenForm only at the real speech boundary", async () => {
    const said: string[] = [];
    function Utterance(this: { text: string; onend: (() => void) | null }, text: string) {
      this.text = text;
      this.onend = null;
    }
    const win = {
      SpeechRecognition: function Recognition() {},
      SpeechSynthesisUtterance: Utterance,
      speechSynthesis: {
        getVoices: () => [],
        addEventListener: () => undefined,
        cancel: () => undefined,
        speak: (u: { text: string; onend: (() => void) | null }) => {
          said.push(u.text);
          u.onend?.();
        },
      },
    } as unknown as Window;
    const provider = selectProvider("web", false, win, { transform: spokenForm });

    await provider!.speak("Budget USD 400 / day.");
    expect(said).toEqual(["Budget USD 400 a day."]);
  });
});
