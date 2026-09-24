/**
 * Seam: `renderApp(path, fetch, { voice })` (Sprint 006 blueprint, ticket #91). jsdom has no Web
 * Speech API, so the browser provider's `supported` flag is the observable proof the device
 * layer picked the right implementation; the fake provider and the session it drives are
 * exercised directly, the same way `routing-reducer.test.ts` exercises the routing store (D-49).
 */
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import type { VoiceErrorCode } from "../src/voice/provider";
import { createFakeVoiceProvider, installWindowHook, type ChloeVoiceWindowHook } from "../src/voice/fakeVoiceProvider";
import { createVoiceProvider, selectProvider } from "../src/voice/selectProvider";
import { useVoice, VoiceSessionProvider } from "../src/voice/VoiceSession";
import { createWebSpeechProvider } from "../src/voice/webSpeechProvider";
import { renderApp } from "./fakeEngine";

/**
 * A minimal stand-in for `speechSynthesis` / `SpeechSynthesisUtterance`, just enough to exercise
 * `webSpeechProvider.ts`'s speak/cancel bookkeeping without a real browser. `cancel()` mimics the
 * real API: it fires the in-flight utterance's `onerror` synchronously (fix round 1, Critical #1).
 */
type StubUtterance = {
  text: string;
  voice: SpeechSynthesisVoice | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

function createSpeechStub() {
  const spoken: string[] = [];
  let current: StubUtterance | null = null;
  const synth = {
    getVoices: () => [] as SpeechSynthesisVoice[],
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    cancel: () => {
      const utterance = current;
      current = null;
      utterance?.onerror?.();
    },
    speak: (utterance: StubUtterance) => {
      spoken.push(utterance.text);
      current = utterance;
    },
  };
  function SpeechSynthesisUtteranceStub(this: StubUtterance, text: string) {
    this.text = text;
    this.voice = null;
    this.onend = null;
    this.onerror = null;
  }
  const win = {
    speechSynthesis: synth,
    SpeechSynthesisUtterance: SpeechSynthesisUtteranceStub,
  } as unknown as Window;
  return {
    win,
    spoken,
    finishCurrent: () => {
      const utterance = current;
      current = null;
      utterance?.onend?.();
    },
  };
}

function Probe() {
  const voice = useVoice();
  const [transcript, setTranscript] = useState("");
  // Distinguishes "releaseMic() resolved with an empty transcript" from "still pending" — the
  // transcript div alone cannot, since both render as empty text (fix round 1, Important #3).
  const [released, setReleased] = useState(false);
  return (
    <div>
      <div data-testid="status">{voice.status}</div>
      <div data-testid="enabled">{String(voice.enabled)}</div>
      <div data-testid="supported">{String(voice.supported)}</div>
      <div data-testid="interim">{voice.interim}</div>
      <div data-testid="greeted">{String(voice.greeted)}</div>
      <div data-testid="assistant-offline">{String(voice.assistantOffline)}</div>
      <div data-testid="last-error">{voice.lastError?.code ?? ""}</div>
      <div data-testid="transcript">{transcript}</div>
      <div data-testid="released">{String(released)}</div>
      <button onClick={voice.enable}>enable</button>
      <button onClick={voice.disable}>disable</button>
      <button onClick={() => void voice.say("hi there")}>say</button>
      <button onClick={voice.stopSpeaking}>stop</button>
      <button onClick={voice.pressMic}>press</button>
      <button
        onClick={() => {
          setReleased(false);
          void voice.releaseMic().then((text) => {
            setTranscript(text);
            setReleased(true);
          });
        }}
      >
        release
      </button>
      <button onClick={voice.markGreeted}>greet</button>
      <button onClick={voice.markAssistantOffline}>offline</button>
    </div>
  );
}

describe("voice device layer", () => {
  it("the web provider reports unsupported under jsdom", () => {
    const provider = createWebSpeechProvider(window);
    expect(provider.kind).toBe("web");
    expect(provider.supported).toBe(false);
  });

  it("cancelSpeech during a multi-chunk utterance stops the queue instead of speaking the next chunk (fix round 1, Critical #1)", async () => {
    const { win, spoken } = createSpeechStub();
    const provider = createWebSpeechProvider(win);
    // Two sentences, each under the ~180-char cap alone but too long together: chunkSpeech
    // yields two utterances, so a bug that lets `advance()` run after cancel would speak both.
    const text = `${"a".repeat(150)}. ${"b".repeat(150)}.`;

    const promise = provider.speak(text);
    expect(spoken).toEqual([`${"a".repeat(150)}.`]);
    provider.cancelSpeech();
    await promise;

    expect(spoken).toEqual([`${"a".repeat(150)}.`]);
  });

  it("a second speak() cancels the first instead of leaving its promise pending (fix round 1, Missing #4)", async () => {
    const { win, spoken, finishCurrent } = createSpeechStub();
    const provider = createWebSpeechProvider(win);

    let firstResolved = false;
    const first = provider.speak("first utterance.").then(() => {
      firstResolved = true;
    });
    provider.speak("second utterance.");
    await first;

    expect(firstResolved).toBe(true);
    expect(spoken).toEqual(["first utterance.", "second utterance."]);
    finishCurrent();
  });

  it("createWebSpeechProvider applies a transform before chunking and speaking (fix round 1, ruling R13; #97 wires spokenForm)", async () => {
    const { win, spoken, finishCurrent } = createSpeechStub();
    const provider = createWebSpeechProvider(win, { transform: (text) => text.toUpperCase() });

    const promise = provider.speak("hello there.");
    expect(spoken).toEqual(["HELLO THERE."]);
    finishCurrent();
    await promise;
  });

  it("selectProvider yields no provider for off and for the offline demo, and the fake for fake", () => {
    expect(selectProvider("off", false)).toBeNull();
    expect(selectProvider("web", true)).toBeNull();
    expect(selectProvider("fake", false)?.kind).toBe("fake");
    expect(selectProvider("web", false, window)?.kind).toBe("web");
  });

  it("selectProvider('fake', ...) installs window.__chloeVoice so Playwright can drive it (fix round 1, Missing #5)", () => {
    const fakeWindow = {} as Window & { __chloeVoice?: ChloeVoiceWindowHook };
    const provider = selectProvider("fake", false, fakeWindow);
    expect(provider?.kind).toBe("fake");
    expect(fakeWindow.__chloeVoice).toBeDefined();
    fakeWindow.__chloeVoice?.transcribe("hooked through selectProvider");
    // Nobody is listening yet, so transcribe() is a no-op; the point is the hook exists and is
    // wired to the same provider selectProvider returned, not a disconnected instance.
    expect(fakeWindow.__chloeVoice?.spoken()).toEqual([]);
  });

  it("createVoiceProvider defaults to the unsupported web provider under jsdom's pinned env", () => {
    const provider = createVoiceProvider();
    expect(provider?.kind).toBe("web");
    expect(provider?.supported).toBe(false);
  });

  it("the fake provider records spoken text and injects transcripts through its handlers", async () => {
    const provider = createFakeVoiceProvider();
    await provider.speak("hello founder");
    expect(provider.spoken).toEqual(["hello founder"]);

    const interim: string[] = [];
    const final: string[] = [];
    let ended = false;
    provider.startListening({
      onInterim: (text) => interim.push(text),
      onFinal: (text) => final.push(text),
      onError: () => undefined,
      onEnd: () => {
        ended = true;
      },
    });
    provider.transcribe("we need a builder");
    expect(interim).toEqual(["we need a builder"]);
    expect(final).toEqual(["we need a builder"]);

    const errors: VoiceErrorCode[] = [];
    provider.startListening({
      onInterim: () => undefined,
      onFinal: () => undefined,
      onError: (e) => errors.push(e.code),
      onEnd: () => {
        ended = true;
      },
    });
    provider.fail("no-speech");
    expect(errors).toEqual(["no-speech"]);

    provider.stopListening();
    expect(ended).toBe(true);
  });

  it("holdUtterances keeps speak() pending until finishSpeaking(), and cancelSpeech releases it", async () => {
    const held = createFakeVoiceProvider({ holdUtterances: true });
    let resolved = false;
    const promise = held.speak("a long route summary").then(() => {
      resolved = true;
    });
    expect(resolved).toBe(false);
    held.finishSpeaking();
    await promise;
    expect(resolved).toBe(true);

    const cancelled = createFakeVoiceProvider({ holdUtterances: true });
    let cancelledResolved = false;
    const cancelledPromise = cancelled.speak("stop me").then(() => {
      cancelledResolved = true;
    });
    cancelled.cancelSpeech();
    await cancelledPromise;
    expect(cancelledResolved).toBe(true);
  });

  it("installWindowHook exposes window.__chloeVoice on the fake provider only", () => {
    const provider = createFakeVoiceProvider();
    const fakeWindow = {} as Window & { __chloeVoice?: unknown };
    installWindowHook(provider, fakeWindow);
    const hook = fakeWindow.__chloeVoice as {
      spoken(): string[];
      transcribe(text: string): void;
      fail(code: VoiceErrorCode): void;
      finishSpeaking(): void;
    };
    expect(hook).toBeDefined();
    void provider.speak("hooked");
    expect(hook.spoken()).toEqual(["hooked"]);

    let heard = "";
    provider.startListening({
      onInterim: () => undefined,
      onFinal: (text) => {
        heard = text;
      },
      onError: () => undefined,
      onEnd: () => undefined,
    });
    hook.transcribe("said through the hook");
    expect(heard).toBe("said through the hook");
  });

  it("VoiceSessionProvider drives press-to-talk, speaking, and errors over a fake provider", async () => {
    const provider = createFakeVoiceProvider();
    const user = userEvent.setup();
    render(
      <VoiceSessionProvider voice={provider}>
        <Probe />
      </VoiceSessionProvider>,
    );

    expect(screen.getByTestId("supported")).toHaveTextContent("true");
    expect(screen.getByTestId("enabled")).toHaveTextContent("false");

    await user.click(screen.getByRole("button", { name: "enable" }));
    expect(screen.getByTestId("enabled")).toHaveTextContent("true");

    await user.click(screen.getByRole("button", { name: "press" }));
    expect(screen.getByTestId("status")).toHaveTextContent("listening");
    act(() => provider.transcribe("health pilot for farmers"));
    expect(screen.getByTestId("interim")).toHaveTextContent("health pilot for farmers");

    await user.click(screen.getByRole("button", { name: "release" }));
    expect(await screen.findByTestId("transcript")).toHaveTextContent("health pilot for farmers");
    expect(screen.getByTestId("status")).toHaveTextContent("idle");

    await user.click(screen.getByRole("button", { name: "press" }));
    act(() => provider.fail("not-allowed"));
    expect(screen.getByTestId("last-error")).toHaveTextContent("not-allowed");

    await user.click(screen.getByRole("button", { name: "greet" }));
    await user.click(screen.getByRole("button", { name: "offline" }));
    expect(screen.getByTestId("greeted")).toHaveTextContent("true");
    expect(screen.getByTestId("assistant-offline")).toHaveTextContent("true");

    await user.click(screen.getByRole("button", { name: "disable" }));
    expect(screen.getByTestId("enabled")).toHaveTextContent("false");
    // Sticky across the session (blueprint §Conductor: greeting and keyless notice, once each).
    expect(screen.getByTestId("greeted")).toHaveTextContent("true");
    expect(screen.getByTestId("assistant-offline")).toHaveTextContent("true");
  });

  it("VoiceSessionProvider's say() resolves on the fake provider's end and records the utterance", async () => {
    const held = createFakeVoiceProvider({ holdUtterances: true });
    const user = userEvent.setup();
    render(
      <VoiceSessionProvider voice={held}>
        <Probe />
      </VoiceSessionProvider>,
    );

    await user.click(screen.getByRole("button", { name: "say" }));
    expect(screen.getByTestId("status")).toHaveTextContent("speaking");
    expect(held.spoken).toEqual(["hi there"]);

    held.finishSpeaking();
    expect(await screen.findByTestId("status")).toHaveTextContent("idle");
  });

  it("with no provider (null), the session reports unsupported and enable() is a no-op", async () => {
    const user = userEvent.setup();
    render(
      <VoiceSessionProvider voice={null}>
        <Probe />
      </VoiceSessionProvider>,
    );

    expect(screen.getByTestId("supported")).toHaveTextContent("false");
    await user.click(screen.getByRole("button", { name: "enable" }));
    expect(screen.getByTestId("enabled")).toHaveTextContent("false");
  });

  it("releaseMic() resolves immediately with \"\" when nothing is listening, instead of hanging (fix round 1, Important #3)", async () => {
    const provider = createFakeVoiceProvider();
    const user = userEvent.setup();
    render(
      <VoiceSessionProvider voice={provider}>
        <Probe />
      </VoiceSessionProvider>,
    );

    // Never pressed the mic.
    await user.click(screen.getByRole("button", { name: "release" }));
    expect(await screen.findByTestId("released")).toHaveTextContent("true");
    expect(screen.getByTestId("transcript")).toHaveTextContent("");

    // Pressed, then disabled mid-press (abortListening discards without an onEnd callback).
    await user.click(screen.getByRole("button", { name: "press" }));
    await user.click(screen.getByRole("button", { name: "disable" }));
    await user.click(screen.getByRole("button", { name: "release" }));
    expect(await screen.findByTestId("released")).toHaveTextContent("true");
  });

  it("renderApp wires an injected voice provider through App without crashing the intake screen", async () => {
    renderApp("/route", undefined, { voice: createFakeVoiceProvider() });
    expect(await screen.findByRole("heading", { level: 1, name: "Describe your MVP" })).toBeInTheDocument();
  });

  it("renderApp wires an explicit voice: null through App without crashing the intake screen", async () => {
    renderApp("/route", undefined, { voice: null });
    expect(await screen.findByRole("heading", { level: 1, name: "Describe your MVP" })).toBeInTheDocument();
  });

  it("renderApp's default App wiring (no voice option at all) resolves createVoiceProvider() and still renders (fix round 1, Minor #7)", async () => {
    renderApp("/route");
    expect(await screen.findByRole("heading", { level: 1, name: "Describe your MVP" })).toBeInTheDocument();
  });
});
