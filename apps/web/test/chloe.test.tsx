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
import { describe, expect, it, vi } from "vitest";

import { FORM_FALLBACK_HINT } from "../src/chloe/engineHints";
import {
  CONFIRM_NO_REPLY,
  CONFIRM_PROMPT,
  CONFIRM_YES_REPLY,
  CONSENT_CAPTION,
  GREETING,
  MIC_ERRORS,
  OFFLINE_ASSISTANT,
  OPENROUTER_CONSENT_CAPTION,
  QUESTIONS,
  spokenForm,
  UNREACHABLE,
  UNSUPPORTED_CAPTION,
  VOICE_IDLE_MUTED,
} from "../src/chloe/script";
import { IDLE_MUTE_MS } from "../src/chloe/voiceMode";
import snapshot from "../src/offline/snapshot.json";
import { createFakeVoiceProvider, type FakeVoiceProvider } from "../src/voice/fakeVoiceProvider";
import { createOpenRouterProvider, VOICE_SERVICE_BUSY } from "../src/voice/openRouterProvider";
import type { ListenHandlers } from "../src/voice/provider";
import { selectProvider } from "../src/voice/selectProvider";
import { useVoice, VoiceSessionProvider } from "../src/voice/VoiceSession";
import { createWebSpeechProvider } from "../src/voice/webSpeechProvider";
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

/**
 * Voice mode (D-55): tap "Start voice mode" once unless the panel is already up, wait until Chloe
 * has finished and the mic is open by itself, then let the fake provider hear `text` and end the
 * turn on its own ("" is a silent turn).
 */
async function tapAndSay(user: ReturnType<typeof userEvent.setup>, voice: FakeVoiceProvider, text: string) {
  if (!screen.queryByTestId("voice-panel")) await user.click(await screen.findByRole("button", { name: "Start voice mode" }));
  await waitFor(() => expect(voice.isListening()).toBe(true));
  act(() => voice.finishUtterance(text));
}

/** Leave /route through the footer, then come back through the top nav. */
async function leaveAndReturn(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getAllByRole("link", { name: /privacy/i })[0]!);
  await waitFor(() => expect(screen.queryByTestId("mic-button")).not.toBeInTheDocument());
  await user.click(screen.getByRole("link", { name: "Route my venture" }));
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
    expect(voice.spoken.some((line) => line.startsWith("Shall I find your route?"))).toBe(true);
    expect(screen.getByText(CAPTION)).toBeInTheDocument();

    await tapAndSay(user, voice, "yes");

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

    await tapAndSay(user, voice, "not yet");

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
    await tapAndSay(user, voice, "go ahead");

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

    await tapAndSay(user, voice, "hello");

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

  it("a no-speech failure in voice mode just reopens the mic: no error line, nothing spoken, nothing sent (D-55)", async () => {
    const voice = createFakeVoiceProvider();
    const user = userEvent.setup();
    const engine = recordingFetch();
    renderApp("/route", engine.fetchLike, { voice });
    await enableVoice(user);

    await user.click(await screen.findByRole("button", { name: "Start voice mode" }));
    await waitFor(() => expect(voice.isListening()).toBe(true));
    act(() => {
      voice.fail("no-speech");
      voice.finishUtterance("");
    });

    await waitFor(() => expect(voice.isListening()).toBe(true));
    expect(screen.getByTestId("voice-mode-state")).toHaveTextContent("Listening");
    expect(screen.queryByTestId("mic-error")).not.toBeInTheDocument();
    expect(voice.spoken).toEqual([GREETING]);
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

  it("re-pressing while the first release is still transcribing submits each utterance once (#127 fix round 1)", async () => {
    // Like the OpenRouter provider: stop() ends only once the transcribe round-trip settles, and a
    // new startListening() silently discards the previous session (no onEnd for it).
    const fake = createFakeVoiceProvider();
    let active: ListenHandlers | null = null;
    let transcribing: ListenHandlers | null = null;
    const voice = {
      ...fake,
      startListening: (handlers: ListenHandlers) => {
        active = handlers;
      },
      stopListening: () => {
        transcribing = active;
        active = null;
      },
      abortListening: () => {
        active = null;
      },
    };
    function Probe() {
      const session = useVoice();
      const [released, setReleased] = useState<string[]>([]);
      return (
        <div>
          <button onClick={() => session.enable()}>enable</button>
          <button onClick={() => void session.listen().then(({ transcript }) => setReleased((all) => [...all, transcript]))}>
            press
          </button>
          <button onClick={() => session.provider?.stopListening()}>release</button>
          <div data-testid="released">{JSON.stringify(released)}</div>
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
    // First utterance still transcribing; the founder presses again.
    await user.click(screen.getByRole("button", { name: "press" }));
    await user.click(screen.getByRole("button", { name: "release" }));
    act(() => {
      const second = transcribing!;
      second.onFinal("second utterance");
      second.onEnd();
    });

    await waitFor(() => expect(JSON.parse(screen.getByTestId("released").textContent!)).toHaveLength(2));
    const released = JSON.parse(screen.getByTestId("released").textContent!) as string[];
    expect(released.filter((text) => text === "second utterance")).toHaveLength(1);
    expect(released).toEqual(["", "second utterance"]);
  });

  it("disabling voice resolves a listen() still waiting for the recogniser's end", async () => {
    const fake = createFakeVoiceProvider();
    // A recogniser that never reports `end` on its own after stop(), like a slow browser.
    const voice = { ...fake, stopListening: () => undefined };
    function Probe() {
      const session = useVoice();
      const [released, setReleased] = useState<string | null>(null);
      return (
        <div>
          <button onClick={() => session.enable()}>enable</button>
          <button onClick={() => void session.listen().then(({ transcript }) => setReleased(transcript))}>press</button>
          <button onClick={() => session.provider?.stopListening()}>release</button>
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
  it("leaving /route and coming back repeats nothing: no new spoken lines, no new chloe-turns", async () => {
    const voice = createFakeVoiceProvider();
    const user = userEvent.setup();
    renderApp("/route", engineFetch(), { voice });

    await openScenarioInChat(user, "Health pilot");
    await enableVoice(user);
    await waitFor(() => expect(voice.spoken).toContain(CONFIRM_PROMPT));
    const afterReadBack = voice.spoken.length;
    const turnsAfterReadBack = screen.getAllByTestId("chloe-turn").length;

    await leaveAndReturn(user);
    await screen.findByRole("heading", { level: 1, name: "Describe your MVP" });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(voice.spoken).toHaveLength(afterReadBack);
    expect(screen.getAllByTestId("chloe-turn")).toHaveLength(turnsAfterReadBack);

    await user.click(screen.getByRole("button", { name: "Find my route" }));
    expect(await screen.findByTestId("status-badge")).toHaveTextContent("Feasible");
    await waitFor(() => expect(voice.spoken).toContain("Your route is Feasible."));
    const afterRoute = voice.spoken.length;

    await leaveAndReturn(user);
    expect(await screen.findByTestId("status-badge")).toHaveTextContent("Feasible");
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(voice.spoken).toHaveLength(afterRoute);
  });

  it("a typed founder turn after the read-back closes the confirmation: a later yes is a founder turn", async () => {
    const voice = createFakeVoiceProvider();
    const user = userEvent.setup();
    let calls = 0;
    const engine = recordingFetch(
      engineFetch({
        // The first typed turn fails (engine unreachable) so the brief and the intake view stay.
        conversation: (init) => {
          calls += 1;
          if (calls === 1) return jsonResponse({ detail: "down" }, 503);
          return engineFetch()("http://engine.test/api/conversation", init) as unknown as Response;
        },
      }),
    );
    renderApp("/route", engine.fetchLike, { voice });
    await openScenarioInChat(user, "Health pilot");
    await enableVoice(user);
    await waitFor(() => expect(voice.spoken).toContain(CONFIRM_PROMPT));

    await user.type(screen.getByLabelText("Reply to assistant"), "make it five builders");
    await user.click(screen.getByRole("button", { name: "Send" }));
    await screen.findByRole("alert");

    await tapAndSay(user, voice, "yes");

    await waitFor(() => expect(engine.conversationPosts()).toHaveLength(2));
    expect(engine.conversationPosts().map((p) => (p.body as { userMessage: string }).userMessage)).toEqual([
      "make it five builders",
      "yes",
    ]);
  });

  it("a user-driven view change after the read-back closes the confirmation: a later yes is not the empty post", async () => {
    const voice = createFakeVoiceProvider();
    const user = userEvent.setup();
    const engine = recordingFetch();
    renderApp("/route", engine.fetchLike, { voice });
    await openScenarioInChat(user, "Health pilot");
    await enableVoice(user);
    await waitFor(() => expect(voice.spoken).toContain(CONFIRM_PROMPT));

    await user.click(screen.getByRole("button", { name: "Use the form instead" }));
    await user.click(await screen.findByRole("button", { name: "Back to chat" }));
    await tapAndSay(user, voice, "yes");

    await waitFor(() => expect(engine.conversationPosts()).toHaveLength(1));
    expect((engine.conversationPosts()[0]!.body as { userMessage: string }).userMessage).toBe("yes");
  });

  it("leaving /route cancels speech and aborts listening", async () => {
    const fake = createFakeVoiceProvider({ holdUtterances: true });
    const cancelSpeech = vi.fn(() => fake.cancelSpeech());
    const abortListening = vi.fn(() => fake.abortListening());
    const voice = { ...fake, cancelSpeech, abortListening };
    const user = userEvent.setup();
    renderApp("/route", engineFetch(), { voice });
    await enableVoice(user);
    expect(fake.spoken).toEqual([GREETING]);
    cancelSpeech.mockClear();
    abortListening.mockClear();

    await user.click(screen.getAllByRole("link", { name: /privacy/i })[0]!);

    await waitFor(() => expect(screen.queryByRole("switch", { name: "Voice: Chloe" })).not.toBeInTheDocument());
    expect(cancelSpeech).toHaveBeenCalled();
    expect(abortListening).toHaveBeenCalled();
  });

  it("a not-allowed recogniser error shows the mic error line, is spoken once, and sends nothing", async () => {
    const voice = createFakeVoiceProvider();
    const user = userEvent.setup();
    const engine = recordingFetch();
    renderApp("/route", engine.fetchLike, { voice });
    await enableVoice(user);

    await user.click(await screen.findByRole("button", { name: "Start voice mode" }));
    await waitFor(() => expect(voice.isListening()).toBe(true));
    act(() => {
      voice.fail("not-allowed");
      voice.finishUtterance("");
    });

    expect(await screen.findByTestId("mic-error")).toHaveTextContent(MIC_ERRORS["not-allowed"]);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(voice.spoken.filter((line) => line === MIC_ERRORS["not-allowed"])).toHaveLength(1);
    expect(voice.spoken).not.toContain(MIC_ERRORS["no-speech"]);
    expect(engine.conversationPosts()).toHaveLength(0);
  });
  it("turning voice on at intake after a route does not read the route", async () => {
    const voice = createFakeVoiceProvider();
    const user = userEvent.setup();
    renderApp("/route", engineFetch(), { voice });
    await user.click(await screen.findByRole("button", { name: "Load scenario: Health pilot" }));
    await user.click(await screen.findByRole("button", { name: "Find my route" }));
    expect(await screen.findByTestId("status-badge")).toHaveTextContent("Feasible");
    await user.click(screen.getByRole("button", { name: "Change brief" }));
    await user.click(await screen.findByRole("button", { name: "Back to chat" }));

    await enableVoice(user);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(voice.spoken).toEqual([GREETING]);
  });

  it("an unsupported browser disables the switch, shows the caption, and hides the mic (Sprint 006 acceptance Must 7)", async () => {
    const voice = createWebSpeechProvider(window);
    renderApp("/route", engineFetch(), { voice });

    const toggle = await screen.findByRole("switch", { name: "Voice: Chloe" });
    expect(toggle).toBeDisabled();
    expect(await screen.findByText(UNSUPPORTED_CAPTION)).toBeInTheDocument();
    expect(screen.queryByTestId("mic-button")).not.toBeInTheDocument();
  });

  it("with no voice provider the switch is absent (Sprint 006 acceptance Must 7)", async () => {
    renderApp("/route", engineFetch(), { voice: null });
    await screen.findByRole("heading", { level: 1, name: "Describe your MVP" });
    expect(screen.queryByRole("switch", { name: "Voice: Chloe" })).not.toBeInTheDocument();
  });

  it("the consent caption is present while voice is on (Sprint 006 acceptance Should 2)", async () => {
    const voice = createFakeVoiceProvider();
    const user = userEvent.setup();
    renderApp("/route", engineFetch(), { voice });

    await enableVoice(user);
    expect(screen.getByText(CONSENT_CAPTION)).toBeInTheDocument();
  });

  it("with the OpenRouter provider the consent caption names OpenRouter instead (D-53, #127)", async () => {
    // A fake whose kind is openrouter: the caption is chosen from provider.kind alone.
    const voice = { ...createFakeVoiceProvider(), kind: "openrouter" as const };
    const user = userEvent.setup();
    renderApp("/route", engineFetch(), { voice });

    await enableVoice(user);
    expect(screen.getByText(OPENROUTER_CONSENT_CAPTION)).toBeInTheDocument();
    expect(screen.queryByText(CONSENT_CAPTION)).not.toBeInTheDocument();
  });

  it("'Stop Chloe' hides the speaking indicator and empties the queue (Sprint 006 acceptance Should 2)", async () => {
    const voice = createFakeVoiceProvider({ holdUtterances: true });
    const user = userEvent.setup();
    renderApp("/route", engineFetch(), { voice });

    await openScenarioInChat(user, "Health pilot");
    await enableVoice(user);
    // The greeting is being spoken (held); the read-back and confirm prompt wait in the queue.
    expect(voice.spoken).toEqual([GREETING]);
    expect(await screen.findByText("Chloe is speaking")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Stop Chloe" }));
    expect(screen.queryByText("Chloe is speaking")).not.toBeInTheDocument();

    act(() => voice.finishSpeaking());
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(voice.spoken).toEqual([GREETING]);
  });

  it("a brief completed while voice was off still gets a read-back once voice is turned on after a remount (ruling R21)", async () => {
    const voice = createFakeVoiceProvider();
    const user = userEvent.setup();
    renderApp("/route", engineFetch(), { voice });

    // The brief becomes complete while voice is off, and ChloeProvider remounts (leave and
    // return) before voice is ever turned on: a naive seed-on-mount would mark it "already
    // confirmed" and skip the read-back forever.
    await openScenarioInChat(user, "Health pilot");
    await leaveAndReturn(user);
    await screen.findByRole("heading", { level: 1, name: "Describe your MVP" });

    await enableVoice(user);
    await waitFor(() => expect(voice.spoken).toContain(CONFIRM_PROMPT));
    const readBack = voice.spoken.find((line) => line.startsWith("Here's your brief so far."));
    expect(readBack).toBeDefined();
  });
});

/** The fake engine with POST /api/conversation held until the test calls `release()`. */
function gatedConversation(base: FetchLike = engineFetch()) {
  let open: () => void = () => undefined;
  const fetchLike: FetchLike = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.endsWith("/api/conversation")) await new Promise<void>((resolve) => (open = resolve));
    return base(input, init);
  };
  return { fetchLike, release: () => open() };
}

const voiceState = () => screen.getByTestId("voice-mode-state");

async function startVoiceMode(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: "Start voice mode" }));
}

describe("Chloe's voice mode, ChatGPT / Claude style (#128, D-55)", () => {
  it("one tap turns voice on, Chloe greets, then the mic opens by itself with no second tap", async () => {
    const voice = createFakeVoiceProvider({ holdUtterances: true });
    const user = userEvent.setup();
    renderApp("/route", engineFetch(), { voice });

    await startVoiceMode(user);
    expect(voice.spoken).toEqual([GREETING]);
    expect(screen.getByRole("switch", { name: "Voice: Chloe" })).toHaveAttribute("aria-checked", "true");
    // The panel replaces the input row; its state is announced politely.
    expect(screen.getByRole("region", { name: "Voice mode" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Reply to assistant")).not.toBeInTheDocument();
    expect(voiceState()).toHaveTextContent("Speaking");
    expect(screen.getByTestId("voice-mode-announcer")).toHaveAttribute("aria-live", "polite");
    expect(screen.getByTestId("voice-mode-announcer")).toHaveTextContent("Speaking");
    expect(voice.isListening()).toBe(false);

    act(() => voice.finishSpeaking());
    await waitFor(() => expect(voiceState()).toHaveTextContent("Listening"));
    expect(voice.isListening()).toBe(true);
    expect(screen.getByRole("button", { name: "Interrupt" })).toBeDisabled();
    expect(screen.getByText(CONSENT_CAPTION)).toBeInTheDocument();
  });

  it("a finished utterance is submitted: Thinking while busy, Speaking for her reply, then Listening again", async () => {
    const voice = createFakeVoiceProvider({ holdUtterances: true });
    const user = userEvent.setup();
    const gate = gatedConversation();
    const engine = recordingFetch(gate.fetchLike);
    renderApp("/route", engine.fetchLike, { voice });

    await startVoiceMode(user);
    act(() => voice.finishSpeaking());
    await waitFor(() => expect(voice.isListening()).toBe(true));

    act(() => voice.finishUtterance("I want to build something for farmers"));
    await waitFor(() => expect(voiceState()).toHaveTextContent("Thinking"));
    expect(engine.conversationPosts()).toHaveLength(1);
    expect((engine.conversationPosts()[0]!.body as { userMessage: string }).userMessage).toBe(
      "I want to build something for farmers",
    );
    expect(voice.isListening()).toBe(false);

    act(() => gate.release());
    await waitFor(() => expect(voice.spoken.at(-1)).toBe(QUESTIONS.title));
    await waitFor(() => expect(voiceState()).toHaveTextContent("Speaking"));
    expect(voice.isListening()).toBe(false);

    act(() => voice.finishSpeaking());
    await waitFor(() => expect(voiceState()).toHaveTextContent("Listening"));
    expect(voice.isListening()).toBe(true);
    expect(engine.conversationPosts()).toHaveLength(1);
  });

  it("Mute pauses the mic without leaving voice mode; Unmute opens it again", async () => {
    const voice = createFakeVoiceProvider();
    const user = userEvent.setup();
    renderApp("/route", engineFetch(), { voice });
    await startVoiceMode(user);
    await waitFor(() => expect(voice.isListening()).toBe(true));

    await user.click(screen.getByRole("button", { name: "Mute" }));
    expect(voiceState()).toHaveTextContent("Muted");
    expect(voice.isListening()).toBe(false);
    expect(screen.getByRole("region", { name: "Voice mode" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Unmute" }));
    await waitFor(() => expect(voiceState()).toHaveTextContent("Listening"));
    expect(voice.isListening()).toBe(true);
  });

  it("End and Escape each leave voice mode: Chloe stops, the mic closes, the input row and its draft come back", async () => {
    const fake = createFakeVoiceProvider({ holdUtterances: true });
    const cancelSpeech = vi.fn(() => fake.cancelSpeech());
    const voice = { ...fake, cancelSpeech };
    const user = userEvent.setup();
    renderApp("/route", engineFetch(), { voice });
    await user.type(await screen.findByLabelText("Reply to assistant"), "half a thought");

    await startVoiceMode(user);
    expect(voiceState()).toHaveTextContent("Speaking");
    cancelSpeech.mockClear();
    await user.click(screen.getByRole("button", { name: "End voice mode" }));
    expect(cancelSpeech).toHaveBeenCalled();
    expect(screen.queryByTestId("voice-panel")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Reply to assistant")).toHaveValue("half a thought");
    expect(fake.isListening()).toBe(false);

    await startVoiceMode(user);
    await waitFor(() => expect(fake.isListening()).toBe(true));
    await user.keyboard("{Escape}");
    expect(screen.queryByTestId("voice-panel")).not.toBeInTheDocument();
    expect(fake.isListening()).toBe(false);
    expect(fake.spoken).toEqual([GREETING]);
  });

  it("tapping the orb while Chloe speaks interrupts her at once, drops her queued lines and starts listening", async () => {
    const voice = createFakeVoiceProvider({ holdUtterances: true });
    const user = userEvent.setup();
    renderApp("/route", engineFetch(), { voice });
    await openScenarioInChat(user, "Health pilot");

    await startVoiceMode(user);
    // The greeting is playing (held); the read-back and the confirm prompt wait in the queue.
    expect(voice.spoken).toEqual([GREETING]);
    await user.click(screen.getByRole("button", { name: "Interrupt" }));

    await waitFor(() => expect(voiceState()).toHaveTextContent("Listening"));
    expect(voice.isListening()).toBe(true);
    act(() => voice.finishSpeaking());
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(voice.spoken).toEqual([GREETING]);
    expect(voice.isListening()).toBe(true);
  });

  it("a provider with voice barge-in is watched only while Chloe speaks, and talking over her interrupts", async () => {
    const fake = createFakeVoiceProvider({ holdUtterances: true });
    let bargeIn: (() => void) | null = null;
    const stopWatching = vi.fn();
    const monitorBargeIn = vi.fn((onBargeIn: () => void) => {
      bargeIn = onBargeIn;
      return stopWatching;
    });
    const voice = { ...fake, monitorBargeIn };
    const user = userEvent.setup();
    renderApp("/route", engineFetch(), { voice });

    await startVoiceMode(user);
    await waitFor(() => expect(monitorBargeIn).toHaveBeenCalledTimes(1));
    act(() => bargeIn!());

    await waitFor(() => expect(voiceState()).toHaveTextContent("Listening"));
    expect(fake.isListening()).toBe(true);
    expect(stopWatching).toHaveBeenCalled();
    expect(monitorBargeIn).toHaveBeenCalledTimes(1);
  });

  it("the route on screen ends voice mode once Chloe has read it", async () => {
    const voice = createFakeVoiceProvider();
    const user = userEvent.setup();
    renderApp("/route", engineFetch(), { voice });
    await openScenarioInChat(user, "Health pilot");

    await tapAndSay(user, voice, "yes");
    expect(await screen.findByTestId("status-badge")).toHaveTextContent("Feasible");
    await waitFor(() => expect(voice.spoken.at(-1)).toBe("The full route is on screen, with the evidence behind each choice."));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(voice.isListening()).toBe(false);

    await user.click(screen.getByRole("button", { name: "Change brief" }));
    await user.click(await screen.findByRole("button", { name: "Back to chat" }));
    expect(screen.queryByTestId("voice-panel")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start voice mode" })).toBeInTheDocument();
    expect(voice.isListening()).toBe(false);
  });

  it("turning voice off, leaving the chat for the form, and leaving /route each end voice mode", async () => {
    const voice = createFakeVoiceProvider();
    const user = userEvent.setup();
    renderApp("/route", engineFetch(), { voice });

    await startVoiceMode(user);
    await waitFor(() => expect(voice.isListening()).toBe(true));
    await user.click(screen.getByRole("switch", { name: "Voice: Chloe" }));
    expect(screen.queryByTestId("voice-panel")).not.toBeInTheDocument();
    expect(voice.isListening()).toBe(false);

    await startVoiceMode(user);
    await waitFor(() => expect(voice.isListening()).toBe(true));
    await user.click(screen.getByRole("button", { name: "Use the form instead" }));
    await user.click(await screen.findByRole("button", { name: "Back to chat" }));
    expect(screen.queryByTestId("voice-panel")).not.toBeInTheDocument();
    expect(voice.isListening()).toBe(false);

    await startVoiceMode(user);
    await waitFor(() => expect(voice.isListening()).toBe(true));
    await leaveAndReturn(user);
    await screen.findByRole("heading", { level: 1, name: "Describe your MVP" });
    expect(screen.queryByTestId("voice-panel")).not.toBeInTheDocument();
    expect(voice.isListening()).toBe(false);
  });

  it.each(["not-allowed", "audio-capture"] as const)("a %s error is spoken once and ends voice mode", async (code) => {
    const voice = createFakeVoiceProvider();
    const user = userEvent.setup();
    const engine = recordingFetch();
    renderApp("/route", engine.fetchLike, { voice });
    await startVoiceMode(user);
    await waitFor(() => expect(voice.isListening()).toBe(true));

    act(() => {
      voice.fail(code);
      voice.finishUtterance("");
    });

    await waitFor(() => expect(screen.queryByTestId("voice-panel")).not.toBeInTheDocument());
    expect(await screen.findByTestId("mic-error")).toHaveTextContent(MIC_ERRORS[code]);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(voice.spoken.filter((line) => line === MIC_ERRORS[code])).toHaveLength(1);
    expect(voice.isListening()).toBe(false);
    expect(engine.conversationPosts()).toHaveLength(0);
  });

  it("silent turns reopen the mic and send nothing; after two minutes without speech it mutes itself and says so once", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const voice = createFakeVoiceProvider();
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const engine = recordingFetch();
      renderApp("/route", engine.fetchLike, { voice });
      await startVoiceMode(user);

      for (let turn = 0; turn < 2; turn += 1) {
        await waitFor(() => expect(voice.isListening()).toBe(true));
        act(() => voice.finishUtterance(""));
      }
      await waitFor(() => expect(voice.isListening()).toBe(true));
      expect(voiceState()).toHaveTextContent("Listening");
      expect(engine.conversationPosts()).toHaveLength(0);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(IDLE_MUTE_MS);
      });
      await waitFor(() => expect(voiceState()).toHaveTextContent("Muted"));
      expect(voice.isListening()).toBe(false);
      expect(voice.spoken.filter((line) => line === VOICE_IDLE_MUTED)).toHaveLength(1);
      expect(engine.conversationPosts()).toHaveLength(0);

      await user.click(screen.getByRole("button", { name: "Unmute" }));
      await waitFor(() => expect(voice.isListening()).toBe(true));
      expect(voice.spoken.filter((line) => line === VOICE_IDLE_MUTED)).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("a spoken 'not yet' to the read-back keeps the conversation going: her reply, then the mic reopens", async () => {
    const voice = createFakeVoiceProvider();
    const user = userEvent.setup();
    const engine = recordingFetch();
    renderApp("/route", engine.fetchLike, { voice });
    await openScenarioInChat(user, "Health pilot");

    await tapAndSay(user, voice, "not yet");
    await waitFor(() => expect(voice.spoken.at(-1)).toBe(CONFIRM_NO_REPLY));
    await waitFor(() => expect(voice.isListening()).toBe(true));
    expect(voiceState()).toHaveTextContent("Listening");
    expect(engine.conversationPosts()).toHaveLength(0);

    await tapAndSay(user, voice, "make it five builders");
    await waitFor(() => expect(engine.conversationPosts()).toHaveLength(1));
    expect((engine.conversationPosts()[0]!.body as { userMessage: string }).userMessage).toBe("make it five builders");
  });

  it("a non-fatal error repeated on the next turn is spoken once, then voice mode mutes itself; Unmute retries (fix round 1)", async () => {
    const voice = createFakeVoiceProvider();
    const user = userEvent.setup();
    const engine = recordingFetch();
    renderApp("/route", engine.fetchLike, { voice });
    await startVoiceMode(user);

    await waitFor(() => expect(voice.isListening()).toBe(true));
    act(() => {
      voice.fail("network");
      voice.finishUtterance("");
    });
    await waitFor(() => expect(voice.spoken).toContain(MIC_ERRORS.network));
    await waitFor(() => expect(voice.isListening()).toBe(true));

    act(() => {
      voice.fail("network");
      voice.finishUtterance("");
    });
    await waitFor(() => expect(voiceState()).toHaveTextContent("Muted"));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(voice.spoken.filter((line) => line === MIC_ERRORS.network)).toHaveLength(1);
    expect(voice.isListening()).toBe(false);
    expect(engine.conversationPosts()).toHaveLength(0);

    await user.click(screen.getByRole("button", { name: "Unmute" }));
    await waitFor(() => expect(voice.isListening()).toBe(true));
  });

  it("a successful turn between two errors resets the repeat count (fix round 1)", async () => {
    const voice = createFakeVoiceProvider();
    const user = userEvent.setup();
    renderApp("/route", engineFetch(), { voice });
    await startVoiceMode(user);

    await waitFor(() => expect(voice.isListening()).toBe(true));
    act(() => {
      voice.fail("network");
      voice.finishUtterance("");
    });
    await tapAndSay(user, voice, "I want to build something for farmers");
    await waitFor(() => expect(voice.spoken.at(-1)).toBe(QUESTIONS.title));
    await waitFor(() => expect(voice.isListening()).toBe(true));
    act(() => {
      voice.fail("network");
      voice.finishUtterance("");
    });

    await waitFor(() => expect(voice.spoken.filter((line) => line === MIC_ERRORS.network)).toHaveLength(2));
    await waitFor(() => expect(voice.isListening()).toBe(true));
    expect(voiceState()).toHaveTextContent("Listening");
  });

  it("Unmute while a request is in flight stays Thinking, and the mic opens only once the reply has been spoken (fix round 1)", async () => {
    const voice = createFakeVoiceProvider();
    const user = userEvent.setup();
    const gate = gatedConversation();
    renderApp("/route", gate.fetchLike, { voice });
    await startVoiceMode(user);
    await waitFor(() => expect(voice.isListening()).toBe(true));

    act(() => voice.finishUtterance("I want to build something for farmers"));
    await waitFor(() => expect(voiceState()).toHaveTextContent("Thinking"));
    await user.click(screen.getByRole("button", { name: "Mute" }));
    expect(voiceState()).toHaveTextContent("Muted");
    await user.click(screen.getByRole("button", { name: "Unmute" }));

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(voiceState()).toHaveTextContent("Thinking");
    expect(voice.isListening()).toBe(false);

    act(() => gate.release());
    await waitFor(() => expect(voice.spoken.at(-1)).toBe(QUESTIONS.title));
    await waitFor(() => expect(voiceState()).toHaveTextContent("Listening"));
    expect(voice.isListening()).toBe(true);
  });

  it("interrupting Chloe while a request is in flight does not open the mic until the reply is in (fix round 1)", async () => {
    const voice = createFakeVoiceProvider({ holdUtterances: true });
    const user = userEvent.setup();
    // The read-back's "yes" posts the brief while Chloe says "Finding your route."; the engine
    // answers with a clarification so the chat stays on screen.
    const gate = gatedConversation(engineFetch({ conversation: () => jsonResponse(clarificationFor({})) }));
    renderApp("/route", gate.fetchLike, { voice });
    await openScenarioInChat(user, "Health pilot");
    await startVoiceMode(user);
    // Greeting, read-back, confirm prompt.
    for (let line = 0; line < 3; line += 1) {
      await waitFor(() => expect(voice.spoken).toHaveLength(line + 1));
      act(() => voice.finishSpeaking());
    }
    await waitFor(() => expect(voice.isListening()).toBe(true));

    act(() => voice.finishUtterance("yes"));
    await waitFor(() => expect(voice.spoken.at(-1)).toBe(CONFIRM_YES_REPLY));
    await waitFor(() => expect(voiceState()).toHaveTextContent("Speaking"));
    await user.click(screen.getByRole("button", { name: "Interrupt" }));

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(voice.isListening()).toBe(false);
    expect(voiceState()).toHaveTextContent("Thinking");

    act(() => gate.release());
    await waitFor(() => expect(voice.spoken.at(-1)).toBe(QUESTIONS.title));
    expect(voice.isListening()).toBe(false);
    act(() => voice.finishSpeaking());
    await waitFor(() => expect(voiceState()).toHaveTextContent("Listening"));
    expect(voice.isListening()).toBe(true);
  });

  it("dictation (keyless engine) puts the words in the reply box and ends voice mode", async () => {
    const voice = createFakeVoiceProvider();
    const user = userEvent.setup();
    const engine = recordingFetch(engineFetch({ conversation: () => jsonResponse(keylessClarificationFor({})) }));
    renderApp("/route", engine.fetchLike, { voice });
    await enableVoice(user);
    await user.type(screen.getByLabelText("Reply to assistant"), "a clinic triage tool");
    await user.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(voice.spoken).toEqual([GREETING, OFFLINE_ASSISTANT]));

    await tapAndSay(user, voice, "for community health workers");

    await waitFor(() => expect(screen.getByLabelText("Reply to assistant")).toHaveValue("for community health workers"));
    expect(screen.queryByTestId("voice-panel")).not.toBeInTheDocument();
    expect(voice.isListening()).toBe(false);
    expect(engine.conversationPosts()).toHaveLength(1);
  });
});

/**
 * The real OpenRouter provider in the real app, with only the browser devices stubbed (no
 * AudioContext, so a turn records until `stopListening()`) and its own fetch for /api/voice/*.
 */
function stubbedOpenRouter(reply: (url: string) => { ok: boolean; status: number }) {
  const recorders: Array<{ state: string; stop(): void }> = [];
  const voiceUrls: Array<{ url: string; body: unknown }> = [];
  const getUserMedia = vi.fn(async () => ({ getTracks: () => [{ stop: () => undefined }] }));
  function MediaRecorderStub(this: Record<string, unknown>) {
    const self = this as {
      mimeType: string;
      state: string;
      ondataavailable: ((event: { data: Blob }) => void) | null;
      onstop: (() => void) | null;
      start(): void;
      stop(): void;
    };
    self.mimeType = "audio/webm";
    self.state = "inactive";
    self.ondataavailable = null;
    self.onstop = null;
    self.start = () => {
      self.state = "recording";
    };
    self.stop = () => {
      if (self.state === "inactive") return;
      self.state = "inactive";
      self.ondataavailable?.({ data: new Blob(["audio"], { type: "audio/webm" }) });
      self.onstop?.();
    };
    recorders.push(self);
  }
  MediaRecorderStub.isTypeSupported = () => true;
  function AudioStub(this: Record<string, unknown>) {
    this.src = "";
    this.onended = null;
    this.onerror = null;
    this.play = () => Promise.resolve();
    this.pause = () => undefined;
  }
  const win = {
    navigator: { mediaDevices: { getUserMedia } },
    MediaRecorder: MediaRecorderStub,
    Audio: AudioStub,
    URL: { createObjectURL: () => "blob:x", revokeObjectURL: () => undefined },
  } as unknown as Window;
  const fetchLike = async (url: string, init?: RequestInit) => {
    voiceUrls.push({ url, body: typeof init?.body === "string" ? JSON.parse(init.body) : null });
    const { ok, status } = reply(url);
    return { ok, status, json: async () => ({}), blob: async () => new Blob([]) } as unknown as Response;
  };
  const provider = createOpenRouterProvider(win, { baseUrl: "http://engine.test", fetchLike });
  const spokenTexts = () =>
    voiceUrls.filter((call) => call.url.endsWith("/api/voice/speak")).map((call) => (call.body as { text: string }).text);
  return { provider, recorders, getUserMedia, spokenTexts };
}

describe("Chloe's voice mode: final review fixes", () => {
  it("OpenRouter: a refused transcribe is the 'voice service is busy' line, and a failed speak never breaks the loop (I2)", async () => {
    // Every speak answers 503 (silent, resolves); every transcribe answers 429.
    const h = stubbedOpenRouter((url) => (url.endsWith("/api/voice/speak") ? { ok: false, status: 503 } : { ok: false, status: 429 }));
    const user = userEvent.setup();
    const engine = recordingFetch();
    renderApp("/route", engine.fetchLike, { voice: h.provider });

    await startVoiceMode(user);
    // The greeting's speak failed, yet the mic opened by itself.
    await waitFor(() => expect(h.recorders.at(-1)?.state).toBe("recording"));
    expect(h.spokenTexts()).toEqual([GREETING]);

    act(() => h.provider.stopListening());
    expect(await screen.findByTestId("mic-error")).toHaveTextContent(VOICE_SERVICE_BUSY);
    await waitFor(() => expect(h.spokenTexts()).toEqual([GREETING, VOICE_SERVICE_BUSY]));
    expect(screen.queryByText(MIC_ERRORS.network)).not.toBeInTheDocument();

    // Her (failed, silent) line resolved, so the next turn opens on its own.
    await waitFor(() => expect(h.getUserMedia).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(voiceState()).toHaveTextContent("Listening"));
    expect(engine.conversationPosts()).toHaveLength(0);
  });

  it("Unmute resets the error streak: the same error on the next turn is spoken again, not muted (should-fix 7)", async () => {
    const voice = createFakeVoiceProvider();
    const user = userEvent.setup();
    renderApp("/route", engineFetch(), { voice });
    await startVoiceMode(user);
    for (let turn = 0; turn < 2; turn += 1) {
      await waitFor(() => expect(voice.isListening()).toBe(true));
      act(() => {
        voice.fail("network");
        voice.finishUtterance("");
      });
    }
    await waitFor(() => expect(voiceState()).toHaveTextContent("Muted"));

    await user.click(screen.getByRole("button", { name: "Unmute" }));
    await waitFor(() => expect(voice.isListening()).toBe(true));
    act(() => {
      voice.fail("network");
      voice.finishUtterance("");
    });
    await waitFor(() => expect(voice.spoken.filter((line) => line === MIC_ERRORS.network)).toHaveLength(2));
    await waitFor(() => expect(voice.isListening()).toBe(true));
    expect(voiceState()).toHaveTextContent("Listening");
  });

  it("an Escape another handler already consumed (defaultPrevented) does not end voice mode (should-fix 7)", async () => {
    const voice = createFakeVoiceProvider();
    const user = userEvent.setup();
    renderApp("/route", engineFetch(), { voice });
    await startVoiceMode(user);
    await waitFor(() => expect(voice.isListening()).toBe(true));

    const consumed = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
    consumed.preventDefault();
    act(() => {
      window.dispatchEvent(consumed);
    });
    expect(screen.getByTestId("voice-panel")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByTestId("voice-panel")).not.toBeInTheDocument();
  });

  it("focus moves to End on entering voice mode and back to Start voice mode on leaving; the live region stays mounted (should-fix 5)", async () => {
    const voice = createFakeVoiceProvider();
    const user = userEvent.setup();
    renderApp("/route", engineFetch(), { voice });
    const announcer = await screen.findByTestId("voice-mode-announcer");
    expect(announcer).toHaveAttribute("aria-live", "polite");

    await startVoiceMode(user);
    await waitFor(() => expect(screen.getByRole("button", { name: "End voice mode" })).toHaveFocus());
    await waitFor(() => expect(announcer).toHaveTextContent("Listening"));

    await user.click(screen.getByRole("button", { name: "End voice mode" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Start voice mode" })).toHaveFocus());
    // The same node, still mounted, now says voice mode is over.
    expect(screen.getByTestId("voice-mode-announcer")).toBe(announcer);
    expect(announcer).toHaveTextContent("Voice mode ended");

    await startVoiceMode(user);
    await waitFor(() => expect(screen.getByRole("button", { name: "End voice mode" })).toHaveFocus());
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.getByRole("button", { name: "Start voice mode" })).toHaveFocus());
  });

  it("under prefers-reduced-motion the orb ignores the live mic level (should-fix 4)", async () => {
    const original = window.matchMedia;
    const levels: Array<(level: number) => void> = [];
    try {
      for (const reduce of [false, true]) {
        window.matchMedia = ((query: string) => ({
          matches: reduce && query.includes("prefers-reduced-motion: reduce"),
          media: query,
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
          addListener: () => undefined,
          removeListener: () => undefined,
          onchange: null,
          dispatchEvent: () => false,
        })) as unknown as typeof window.matchMedia;
        const fake = createFakeVoiceProvider();
        const voice = {
          ...fake,
          startListening: (handlers: ListenHandlers) => {
            levels.push((level) => handlers.onLevel?.(level));
            fake.startListening(handlers);
          },
        };
        const user = userEvent.setup();
        const { unmount } = renderApp("/route", engineFetch(), { voice });
        await startVoiceMode(user);
        await waitFor(() => expect(fake.isListening()).toBe(true));
        act(() => levels.at(-1)!(0.5));
        const orb = screen.getByRole("button", { name: "Interrupt" }).firstElementChild as HTMLElement;
        expect(orb.style.transform).toBe(reduce ? "" : "scale(1.35)");
        unmount();
      }
    } finally {
      window.matchMedia = original;
    }
  });

  it("the consent caption shows next to Start voice mode before the first tap, and stays in voice mode (should-fix 8)", async () => {
    const voice = createFakeVoiceProvider();
    const user = userEvent.setup();
    renderApp("/route", engineFetch(), { voice });

    await screen.findByRole("button", { name: "Start voice mode" });
    expect(screen.getByRole("switch", { name: "Voice: Chloe" })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByText(CONSENT_CAPTION)).toBeInTheDocument();

    await startVoiceMode(user);
    expect(screen.getByText(CONSENT_CAPTION)).toBeInTheDocument();
  });
});
