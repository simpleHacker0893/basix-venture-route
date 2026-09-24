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
import { createFakeVoiceProvider, installWindowHook } from "../src/voice/fakeVoiceProvider";
import { createVoiceProvider, selectProvider } from "../src/voice/selectProvider";
import { useVoice, VoiceSessionProvider } from "../src/voice/VoiceSession";
import { createWebSpeechProvider } from "../src/voice/webSpeechProvider";
import { renderApp } from "./fakeEngine";

function Probe() {
  const voice = useVoice();
  const [transcript, setTranscript] = useState("");
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
      <button onClick={voice.enable}>enable</button>
      <button onClick={voice.disable}>disable</button>
      <button onClick={() => void voice.say("hi there")}>say</button>
      <button onClick={voice.stopSpeaking}>stop</button>
      <button onClick={voice.pressMic}>press</button>
      <button onClick={() => void voice.releaseMic().then(setTranscript)}>release</button>
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

  it("selectProvider yields no provider for off and for the offline demo, and the fake for fake", () => {
    expect(selectProvider("off", false)).toBeNull();
    expect(selectProvider("web", true)).toBeNull();
    expect(selectProvider("fake", false)?.kind).toBe("fake");
    expect(selectProvider("web", false, window)?.kind).toBe("web");
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

  it("renderApp wires an injected voice provider (or none) through App without crashing the intake screen", async () => {
    renderApp("/route", undefined, { voice: createFakeVoiceProvider() });
    expect(await screen.findByRole("heading", { level: 1, name: "Describe your MVP" })).toBeInTheDocument();
  });

  it("renderApp's default App wiring (no voice option) still resolves the unsupported web provider and renders", async () => {
    renderApp("/route", undefined, { voice: null });
    expect(await screen.findByRole("heading", { level: 1, name: "Describe your MVP" })).toBeInTheDocument();
  });
});
