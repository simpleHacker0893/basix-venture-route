/**
 * Seam (D-53 (3)): the OpenRouter `VoiceProvider` against the `VoiceProvider` interface, with a
 * mocked `fetch` and stub `MediaRecorder`, `getUserMedia`, `Audio` and `URL` injected through
 * the window the provider is built with. The engine's `/api/voice/*` proxy is never reached.
 */
import { describe, expect, it, vi } from "vitest";

import { createOpenRouterProvider, MIC_CONSTRAINTS } from "../src/voice/openRouterProvider";
import type { ListenHandlers, VoiceError } from "../src/voice/provider";
import { selectProvider } from "../src/voice/selectProvider";
import {
  BARGE_IN_HOLD_MS,
  BARGE_IN_RMS_THRESHOLD,
  END_SILENCE_MS,
  MAX_UTTERANCE_MS,
  SPEECH_RMS_THRESHOLD,
} from "../src/voice/vad";

const BASE = "http://engine.test";

type StubTrack = { stop: ReturnType<typeof vi.fn> };

type StubRecorder = {
  stream: { getTracks(): StubTrack[] };
  mimeType: string;
  state: "inactive" | "recording";
  ondataavailable: ((event: { data: Blob }) => void) | null;
  onstop: (() => void) | null;
  start(): void;
  stop(): void;
};

type StubAudio = {
  src: string;
  onended: (() => void) | null;
  onerror: (() => void) | null;
  play: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
};

type FakeResponse = { ok: boolean; status: number; json(): Promise<unknown>; blob(): Promise<Blob> };

function jsonReply(body: unknown, status = 200): FakeResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    blob: async () => new Blob([JSON.stringify(body)], { type: "application/json" }),
  };
}

function audioReply(): FakeResponse {
  return {
    ok: true,
    status: 200,
    json: async () => ({}),
    blob: async () => new Blob(["mp3-bytes"], { type: "audio/mpeg" }),
  };
}

type HarnessOptions = {
  webm?: boolean;
  getUserMedia?: () => Promise<unknown>;
  reply?: (url: string, init: RequestInit) => Promise<FakeResponse>;
  playRejects?: boolean;
  startThrows?: boolean;
};

function createHarness(options: HarnessOptions = {}) {
  const recorders: StubRecorder[] = [];
  const audios: StubAudio[] = [];
  const tracks: StubTrack[] = [];
  const recorderOptions: Array<{ mimeType?: string } | undefined> = [];

  function makeStream() {
    const track: StubTrack = { stop: vi.fn() };
    tracks.push(track);
    return { getTracks: () => [track] };
  }

  const getUserMedia = vi.fn(options.getUserMedia ?? (async () => makeStream()));

  function MediaRecorderStub(this: StubRecorder, stream: StubRecorder["stream"], opts?: { mimeType?: string }) {
    recorderOptions.push(opts);
    this.stream = stream;
    this.mimeType = opts?.mimeType === "audio/webm" ? "audio/webm;codecs=opus" : (opts?.mimeType ?? "");
    this.state = "inactive";
    this.ondataavailable = null;
    this.onstop = null;
    this.start = () => {
      if (options.startThrows) throw new DOMException("cannot start", "NotSupportedError");
      this.state = "recording";
    };
    this.stop = () => {
      if (this.state === "inactive") return;
      this.state = "inactive";
      this.ondataavailable?.({ data: new Blob(["audio-bytes"], { type: this.mimeType }) });
      this.onstop?.();
    };
    recorders.push(this);
  }
  MediaRecorderStub.isTypeSupported = (type: string) => (options.webm ?? true) && type === "audio/webm";

  function AudioStub(this: StubAudio, src?: string) {
    this.src = src ?? "";
    this.onended = null;
    this.onerror = null;
    this.play = vi.fn(() => (options.playRejects ? Promise.reject(new Error("autoplay")) : Promise.resolve()));
    this.pause = vi.fn();
    audios.push(this);
  }

  const fetchLike = vi.fn(async (url: string, init: RequestInit) => {
    if (options.reply) return options.reply(url, init);
    if (url.endsWith("/api/voice/speak")) return audioReply();
    return jsonReply({ text: "a clinic booking app" });
  });

  let urlCount = 0;
  const URLStub = {
    createObjectURL: vi.fn(() => `blob:stub-${(urlCount += 1)}`),
    revokeObjectURL: vi.fn(),
  };

  const win = {
    navigator: { mediaDevices: { getUserMedia } },
    MediaRecorder: MediaRecorderStub,
    Audio: AudioStub,
    URL: URLStub,
  } as unknown as Window;

  const provider = createOpenRouterProvider(win, {
    baseUrl: BASE,
    fetchLike: fetchLike as unknown as typeof fetch,
    transform: (text) => text.toUpperCase(),
  });

  return { win, provider, recorders, audios, tracks, recorderOptions, getUserMedia, fetchLike, URLStub, makeStream };
}

function recordingHandlers() {
  const events: string[] = [];
  const errors: VoiceError[] = [];
  const handlers: ListenHandlers = {
    onInterim: (text) => events.push(`interim:${text}`),
    onFinal: (text) => events.push(`final:${text}`),
    onError: (error) => {
      errors.push(error);
      events.push(`error:${error.code}`);
    },
    onEnd: () => events.push("end"),
  };
  return { handlers, events, errors };
}

async function flush(rounds = 5): Promise<void> {
  for (let i = 0; i < rounds; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("OpenRouter voice provider (D-53 seam)", () => {
  it("is openrouter and supported only when getUserMedia, MediaRecorder and Audio all exist", () => {
    const { provider, win } = createHarness();
    expect(provider.kind).toBe("openrouter");
    expect(provider.supported).toBe(true);

    const base = win as unknown as Record<string, unknown>;
    const withoutRecorder = { ...base, MediaRecorder: undefined } as unknown as Window;
    const withoutAudio = { ...base, Audio: undefined } as unknown as Window;
    const withoutMic = { ...base, navigator: {} } as unknown as Window;
    for (const w of [withoutRecorder, withoutAudio, withoutMic]) {
      expect(createOpenRouterProvider(w, { baseUrl: BASE }).supported).toBe(false);
    }
  });

  it("records audio/webm when the browser supports it, otherwise audio/mp4", async () => {
    const webm = createHarness({ webm: true });
    webm.provider.startListening(recordingHandlers().handlers);
    await flush();
    expect(webm.recorderOptions[0]).toEqual({ mimeType: "audio/webm" });

    const mp4 = createHarness({ webm: false });
    mp4.provider.startListening(recordingHandlers().handlers);
    await flush();
    expect(mp4.recorderOptions[0]).toEqual({ mimeType: "audio/mp4" });
  });

  it("stop posts the recording with the recorder's mime, then calls onFinal and onEnd and releases the mic", async () => {
    const h = createHarness();
    const { handlers, events } = recordingHandlers();
    h.provider.startListening(handlers);
    await flush();
    expect(h.getUserMedia).toHaveBeenCalledWith(MIC_CONSTRAINTS);
    expect(h.recorders[0]?.state).toBe("recording");

    h.provider.stopListening();
    await flush();

    expect(h.fetchLike).toHaveBeenCalledTimes(1);
    const [url, init] = h.fetchLike.mock.calls[0]!;
    expect(url).toBe(`${BASE}/api/voice/transcribe`);
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("audio/webm;codecs=opus");
    expect(init.body).toBeInstanceOf(Blob);
    expect((init.body as Blob).type).toBe("audio/webm;codecs=opus");
    expect((init.body as Blob).size).toBeGreaterThan(0);

    expect(events).toEqual(["final:a clinic booking app", "end"]);
    expect(h.tracks[0]?.stop).toHaveBeenCalled();
  });

  it("never calls onInterim", async () => {
    const h = createHarness();
    const { handlers, events } = recordingHandlers();
    h.provider.startListening(handlers);
    await flush();
    h.provider.stopListening();
    await flush();
    expect(events.some((event) => event.startsWith("interim:"))).toBe(false);
  });

  it("an empty transcript calls onEnd without onFinal", async () => {
    const h = createHarness({ reply: async () => jsonReply({ text: "" }) });
    const { handlers, events } = recordingHandlers();
    h.provider.startListening(handlers);
    await flush();
    h.provider.stopListening();
    await flush();
    expect(events).toEqual(["end"]);
  });

  it("a 502 from the engine is a network error, then onEnd", async () => {
    const h = createHarness({ reply: async () => jsonReply({ detail: "upstream" }, 502) });
    const { handlers, events } = recordingHandlers();
    h.provider.startListening(handlers);
    await flush();
    h.provider.stopListening();
    await flush();
    expect(events).toEqual(["error:network", "end"]);
    expect(h.tracks[0]?.stop).toHaveBeenCalled();
  });

  it("a rejected fetch is a network error, then onEnd", async () => {
    const h = createHarness({
      reply: async () => {
        throw new TypeError("Failed to fetch");
      },
    });
    const { handlers, events } = recordingHandlers();
    h.provider.startListening(handlers);
    await flush();
    h.provider.stopListening();
    await flush();
    expect(events).toEqual(["error:network", "end"]);
  });

  it("NotAllowedError maps to not-allowed and NotFoundError to audio-capture, each followed by onEnd", async () => {
    const denied = createHarness({
      getUserMedia: async () => {
        throw new DOMException("denied", "NotAllowedError");
      },
    });
    const a = recordingHandlers();
    denied.provider.startListening(a.handlers);
    await flush();
    expect(a.events).toEqual(["error:not-allowed", "end"]);

    const missing = createHarness({
      getUserMedia: async () => {
        throw new DOMException("no mic", "NotFoundError");
      },
    });
    const b = recordingHandlers();
    missing.provider.startListening(b.handlers);
    await flush();
    expect(b.events).toEqual(["error:audio-capture", "end"]);
  });

  it("abort discards the audio, releases the mic, sends nothing and does not call onEnd", async () => {
    const h = createHarness();
    const { handlers, events } = recordingHandlers();
    h.provider.startListening(handlers);
    await flush();
    h.provider.abortListening();
    await flush();
    expect(h.fetchLike).not.toHaveBeenCalled();
    expect(h.tracks[0]?.stop).toHaveBeenCalled();
    expect(events).toEqual([]);
  });

  it("abort while getUserMedia is pending releases the late stream and sends nothing", async () => {
    let grant: (stream: unknown) => void = () => undefined;
    const h = createHarness({ getUserMedia: () => new Promise((resolve) => (grant = resolve)) });
    const { handlers, events } = recordingHandlers();
    h.provider.startListening(handlers);
    h.provider.abortListening();
    grant(h.makeStream());
    await flush();
    expect(h.recorders).toHaveLength(0);
    expect(h.tracks[0]?.stop).toHaveBeenCalled();
    expect(h.fetchLike).not.toHaveBeenCalled();
    expect(events).toEqual([]);
  });

  it("stop while getUserMedia is pending ends at once with no transcript, and releases the late stream", async () => {
    let grant: (stream: unknown) => void = () => undefined;
    const h = createHarness({ getUserMedia: () => new Promise((resolve) => (grant = resolve)) });
    const { handlers, events } = recordingHandlers();
    h.provider.startListening(handlers);
    h.provider.stopListening();
    // The caller's finishListening() must not wait on the permission prompt: onEnd fires immediately.
    expect(events).toEqual(["end"]);

    grant(h.makeStream());
    await flush();
    expect(h.recorders).toHaveLength(0);
    expect(h.tracks[0]?.stop).toHaveBeenCalled();
    expect(h.fetchLike).not.toHaveBeenCalled();
    expect(events).toEqual(["end"]);
  });

  it("stop while getUserMedia is pending and then denied ends once, with no error", async () => {
    let deny: (error: unknown) => void = () => undefined;
    const h = createHarness({ getUserMedia: () => new Promise((_resolve, reject) => (deny = reject)) });
    const { handlers, events } = recordingHandlers();
    h.provider.startListening(handlers);
    h.provider.stopListening();
    deny(new DOMException("denied", "NotAllowedError"));
    await flush();
    expect(events).toEqual(["end"]);
  });

  it("abort during transcription drops the reply and calls nothing", async () => {
    let answer: (response: FakeResponse) => void = () => undefined;
    const h = createHarness({ reply: () => new Promise((resolve) => (answer = resolve)) });
    const { handlers, events } = recordingHandlers();
    h.provider.startListening(handlers);
    await flush();
    h.provider.stopListening();
    await flush();
    const init = h.fetchLike.mock.calls[0]![1];
    h.provider.abortListening();
    expect((init.signal as AbortSignal).aborted).toBe(true);
    answer(jsonReply({ text: "too late" }));
    await flush();
    expect(events).toEqual([]);
  });

  it("a recorder.start() that throws is unknown, then onEnd, and releases the mic (#127 fix round 1)", async () => {
    const h = createHarness({ startThrows: true });
    const { handlers, events } = recordingHandlers();
    h.provider.startListening(handlers);
    await flush();
    expect(events).toEqual(["error:unknown", "end"]);
    expect(h.tracks[0]?.stop).toHaveBeenCalled();
    // The session is over: a later stop or abort is a no-op, and nothing is sent.
    h.provider.stopListening();
    h.provider.abortListening();
    await flush();
    expect(events).toEqual(["error:unknown", "end"]);
    expect(h.fetchLike).not.toHaveBeenCalled();
  });

  it("unsupported: startListening calls onEnd and touches nothing", () => {
    const { handlers, events } = recordingHandlers();
    const provider = createOpenRouterProvider({} as Window, { baseUrl: BASE });
    provider.startListening(handlers);
    expect(events).toEqual(["end"]);
  });

  it("speak posts the transformed text as JSON, plays it through an object URL and resolves on ended", async () => {
    const h = createHarness();
    let settled = false;
    const done = h.provider.speak("hello there").then(() => {
      settled = true;
    });
    await flush();

    expect(h.fetchLike).toHaveBeenCalledTimes(1);
    const [url, init] = h.fetchLike.mock.calls[0]!;
    expect(url).toBe(`${BASE}/api/voice/speak`);
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init.body as string)).toEqual({ text: "HELLO THERE" });
    expect(init.signal).toBeInstanceOf(AbortSignal);

    expect(h.audios).toHaveLength(1);
    expect(h.audios[0]?.src).toBe("blob:stub-1");
    expect(h.audios[0]?.play).toHaveBeenCalled();
    expect(settled).toBe(false);

    h.audios[0]?.onended?.();
    await done;
    expect(h.URLStub.revokeObjectURL).toHaveBeenCalledWith("blob:stub-1");
  });

  it("speak resolves (never rejects) on an audio error, a rejected play() and a failed fetch", async () => {
    const onError = createHarness();
    const a = onError.provider.speak("one");
    await flush();
    onError.audios[0]?.onerror?.();
    await expect(a).resolves.toBeUndefined();
    expect(onError.URLStub.revokeObjectURL).toHaveBeenCalledWith("blob:stub-1");

    const blocked = createHarness({ playRejects: true });
    await expect(blocked.provider.speak("two")).resolves.toBeUndefined();
    expect(blocked.URLStub.revokeObjectURL).toHaveBeenCalledWith("blob:stub-1");

    const down = createHarness({ reply: async () => jsonReply({ detail: "down" }, 503) });
    await expect(down.provider.speak("three")).resolves.toBeUndefined();
    expect(down.audios).toHaveLength(0);

    const offline = createHarness({
      reply: async () => {
        throw new TypeError("Failed to fetch");
      },
    });
    await expect(offline.provider.speak("four")).resolves.toBeUndefined();
  });

  it("cancelSpeech aborts the in-flight fetch and resolves the pending speak", async () => {
    const h = createHarness({ reply: () => new Promise(() => undefined) });
    const pending = h.provider.speak("hold on");
    await flush();
    const init = h.fetchLike.mock.calls[0]![1];
    h.provider.cancelSpeech();
    expect((init.signal as AbortSignal).aborted).toBe(true);
    await expect(pending).resolves.toBeUndefined();
  });

  it("cancelSpeech pauses playing audio, resolves and revokes the URL", async () => {
    const h = createHarness();
    const pending = h.provider.speak("playing now");
    await flush();
    h.provider.cancelSpeech();
    expect(h.audios[0]?.pause).toHaveBeenCalled();
    await expect(pending).resolves.toBeUndefined();
    expect(h.URLStub.revokeObjectURL).toHaveBeenCalledWith("blob:stub-1");
  });

  it("a second speak cancels the first (mirrors the web provider): the first resolves, only the second plays on", async () => {
    const h = createHarness();
    let firstDone = false;
    const first = h.provider.speak("first").then(() => {
      firstDone = true;
    });
    await flush();
    const second = h.provider.speak("second");
    await first;
    expect(firstDone).toBe(true);
    expect(h.audios[0]?.pause).toHaveBeenCalled();
    await flush();
    expect(h.audios).toHaveLength(1);
    expect(h.audios[0]?.src).toBe("blob:stub-2");
    h.audios[0]?.onended?.();
    await expect(second).resolves.toBeUndefined();
  });

  it("reuses one Audio element across speaks, swapping src, so WebKit keeps it unlocked (I3)", async () => {
    const h = createHarness();
    const first = h.provider.speak("one");
    await flush();
    h.audios[0]?.onended?.();
    await first;
    const second = h.provider.speak("two");
    await flush();

    expect(h.audios).toHaveLength(1);
    expect(h.audios[0]?.src).toBe("blob:stub-2");
    expect(h.audios[0]?.play).toHaveBeenCalledTimes(2);
    h.audios[0]?.onended?.();
    await expect(second).resolves.toBeUndefined();
  });

  it("prime() creates and plays the one Audio element inside the tap; speak then reuses it (I3)", async () => {
    const h = createHarness();
    expect(h.provider.prime).toBeTypeOf("function");
    h.provider.prime!();
    expect(h.audios).toHaveLength(1);
    expect(h.audios[0]?.play).toHaveBeenCalledTimes(1);
    h.provider.prime!();
    expect(h.audios).toHaveLength(1);

    const spoken = h.provider.speak("hello");
    await flush();
    expect(h.audios).toHaveLength(1);
    expect(h.audios[0]?.src).toBe("blob:stub-1");
    h.audios[0]?.onended?.();
    await expect(spoken).resolves.toBeUndefined();
  });

  it("a failed transcribe tells the founder the voice service is busy, not that the network is down (I2)", async () => {
    const h = createHarness({ reply: async () => jsonReply({ detail: "too many voice requests" }, 429) });
    const { handlers, errors } = recordingHandlers();
    h.provider.startListening(handlers);
    await flush();
    h.provider.stopListening();
    await flush();
    expect(errors).toEqual([{ code: "network", message: "Chloe's voice service is busy right now. You can keep typing." }]);
  });

  it("speak with nothing to say resolves without a request", async () => {
    const h = createHarness();
    await expect(h.provider.speak("   ")).resolves.toBeUndefined();
    expect(h.fetchLike).not.toHaveBeenCalled();
  });
});

describe("selectProvider with openrouter", () => {
  it("returns the openrouter provider, and null for off or the offline demo", () => {
    expect(selectProvider("openrouter", false, {} as Window)?.kind).toBe("openrouter");
    expect(selectProvider("openrouter", true, {} as Window)).toBeNull();
    expect(selectProvider("off", false, {} as Window)).toBeNull();
  });
});

/**
 * #128 (D-55): voice-activity detection over the same echo-cancelled stream. The stub
 * `AudioContext` hands out one analyser whose RMS is whatever `level` the test scripts; fake
 * timers drive the provider's sampling interval and `Date.now()`.
 */
describe("OpenRouter voice provider: VAD endpointing and barge-in (#128, D-55)", () => {
  type StubAnalyser = { fftSize: number; getFloatTimeDomainData(buffer: Float32Array): void };

  const ECHO_CANCELLED = { audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } };

  function withAudioContext(options: HarnessOptions & { graphThrows?: boolean } = {}) {
    const h = createHarness(options);
    const audio = { level: 0, contexts: 0, closed: 0, resumed: 0 };
    function AudioContextStub() {
      audio.contexts += 1;
      const analyser: StubAnalyser = {
        fftSize: 0,
        getFloatTimeDomainData: (buffer) => buffer.fill(audio.level),
      };
      return {
        createMediaStreamSource: () => {
          if (options.graphThrows) throw new DOMException("no source", "InvalidStateError");
          return { connect: () => undefined, disconnect: () => undefined };
        },
        resume: () => {
          audio.resumed += 1;
          return Promise.resolve();
        },
        createAnalyser: () => analyser,
        close: () => {
          audio.closed += 1;
          return Promise.resolve();
        },
      };
    }
    const win = { ...(h.win as unknown as Record<string, unknown>), AudioContext: AudioContextStub } as unknown as Window;
    const provider = createOpenRouterProvider(win, { baseUrl: BASE, fetchLike: h.fetchLike as unknown as typeof fetch });
    return { ...h, provider, audio };
  }

  it("asks for an echo-cancelled, noise-suppressed, gain-controlled stream", async () => {
    vi.useFakeTimers();
    try {
      const h = withAudioContext();
      h.provider.startListening(recordingHandlers().handlers);
      await vi.advanceTimersByTimeAsync(10);
      expect(h.getUserMedia).toHaveBeenCalledWith(ECHO_CANCELLED);
      h.provider.abortListening();
    } finally {
      vi.useRealTimers();
    }
  });

  it("resumes the AudioContext it creates, since Safari starts one suspended (I3)", async () => {
    vi.useFakeTimers();
    try {
      const h = withAudioContext();
      h.provider.startListening(recordingHandlers().handlers);
      await vi.advanceTimersByTimeAsync(10);
      expect(h.audio.contexts).toBe(1);
      expect(h.audio.resumed).toBe(1);
      h.provider.abortListening();
    } finally {
      vi.useRealTimers();
    }
  });

  it("a graph that throws while being built closes its AudioContext; the turn still records until stop (I3)", async () => {
    vi.useFakeTimers();
    try {
      const h = withAudioContext({ graphThrows: true });
      const { handlers, events } = recordingHandlers();
      h.provider.startListening(handlers);
      await vi.advanceTimersByTimeAsync(10);
      expect(h.audio.contexts).toBe(1);
      expect(h.audio.closed).toBe(1);

      h.provider.stopListening();
      await vi.advanceTimersByTimeAsync(10);
      expect(h.fetchLike).toHaveBeenCalledTimes(1);
      expect(events).toEqual(["final:a clinic booking app", "end"]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("speech then END_SILENCE_MS of silence ends the turn on its own with exactly one POST", async () => {
    vi.useFakeTimers();
    try {
      const h = withAudioContext();
      const { handlers, events } = recordingHandlers();
      const levels: number[] = [];
      h.provider.startListening({ ...handlers, onLevel: (level) => levels.push(level) });
      await vi.advanceTimersByTimeAsync(100);

      h.audio.level = 0.1;
      await vi.advanceTimersByTimeAsync(600);
      h.audio.level = 0;
      await vi.advanceTimersByTimeAsync(END_SILENCE_MS - 200);
      expect(h.fetchLike).not.toHaveBeenCalled();
      expect(events).toEqual([]);

      await vi.advanceTimersByTimeAsync(400);
      expect(h.fetchLike).toHaveBeenCalledTimes(1);
      expect(h.fetchLike.mock.calls[0]![0]).toBe(`${BASE}/api/voice/transcribe`);
      expect(events).toEqual(["final:a clinic booking app", "end"]);
      expect(h.tracks[0]?.stop).toHaveBeenCalled();
      expect(h.audio.closed).toBe(1);
      // The live level reaches the caller for the orb.
      expect(levels.some((level) => level > 0.09)).toBe(true);

      await vi.advanceTimersByTimeAsync(MAX_UTTERANCE_MS);
      expect(h.fetchLike).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("silence only: the turn ends at MAX_UTTERANCE_MS and nothing is ever sent", async () => {
    vi.useFakeTimers();
    try {
      const h = withAudioContext();
      const { handlers, events } = recordingHandlers();
      h.provider.startListening(handlers);
      // Below the speech threshold the whole time: room noise, not speech.
      h.audio.level = SPEECH_RMS_THRESHOLD / 2;
      await vi.advanceTimersByTimeAsync(MAX_UTTERANCE_MS - 500);
      expect(events).toEqual([]);

      await vi.advanceTimersByTimeAsync(1000);
      expect(events).toEqual(["end"]);
      expect(h.fetchLike).not.toHaveBeenCalled();
      expect(h.tracks[0]?.stop).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("a graceful stop with no speech heard sends nothing either", async () => {
    vi.useFakeTimers();
    try {
      const h = withAudioContext();
      const { handlers, events } = recordingHandlers();
      h.provider.startListening(handlers);
      await vi.advanceTimersByTimeAsync(2000);
      h.provider.stopListening();
      await vi.advanceTimersByTimeAsync(10);
      expect(events).toEqual(["end"]);
      expect(h.fetchLike).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("speech that never pauses is cut at MAX_UTTERANCE_MS and sent once", async () => {
    vi.useFakeTimers();
    try {
      const h = withAudioContext();
      const { handlers, events } = recordingHandlers();
      h.provider.startListening(handlers);
      h.audio.level = 0.2;
      await vi.advanceTimersByTimeAsync(MAX_UTTERANCE_MS - 500);
      expect(h.fetchLike).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(1000);
      expect(h.fetchLike).toHaveBeenCalledTimes(1);
      expect(events).toEqual(["final:a clinic booking app", "end"]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("barge-in fires once when the louder threshold holds for BARGE_IN_HOLD_MS, then releases the mic", async () => {
    vi.useFakeTimers();
    try {
      const h = withAudioContext();
      const onBargeIn = vi.fn();
      expect(h.provider.monitorBargeIn).toBeTypeOf("function");
      h.provider.monitorBargeIn!(onBargeIn);
      await vi.advanceTimersByTimeAsync(100);
      expect(h.getUserMedia).toHaveBeenCalledWith(ECHO_CANCELLED);

      // Speech-level sound (Chloe's own echo, a cough) is not enough.
      h.audio.level = (SPEECH_RMS_THRESHOLD + BARGE_IN_RMS_THRESHOLD) / 2;
      await vi.advanceTimersByTimeAsync(2000);
      // Loud, but shorter than the hold.
      h.audio.level = BARGE_IN_RMS_THRESHOLD * 2;
      await vi.advanceTimersByTimeAsync(BARGE_IN_HOLD_MS - 100);
      h.audio.level = 0;
      await vi.advanceTimersByTimeAsync(500);
      expect(onBargeIn).not.toHaveBeenCalled();

      h.audio.level = BARGE_IN_RMS_THRESHOLD * 2;
      await vi.advanceTimersByTimeAsync(BARGE_IN_HOLD_MS + 100);
      expect(onBargeIn).toHaveBeenCalledTimes(1);
      expect(h.tracks[0]?.stop).toHaveBeenCalled();
      expect(h.audio.closed).toBe(1);

      await vi.advanceTimersByTimeAsync(2000);
      expect(onBargeIn).toHaveBeenCalledTimes(1);
      expect(h.fetchLike).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("cancelling the barge-in monitor releases the mic and never fires", async () => {
    vi.useFakeTimers();
    try {
      const h = withAudioContext();
      const onBargeIn = vi.fn();
      const cancel = h.provider.monitorBargeIn!(onBargeIn);
      await vi.advanceTimersByTimeAsync(100);
      cancel();
      expect(h.tracks[0]?.stop).toHaveBeenCalled();
      h.audio.level = 1;
      await vi.advanceTimersByTimeAsync(2000);
      expect(onBargeIn).not.toHaveBeenCalled();

      // Cancelled before the permission prompt resolves: the late stream is released untouched.
      const late = withAudioContext();
      const stop = late.provider.monitorBargeIn!(onBargeIn);
      stop();
      await vi.advanceTimersByTimeAsync(100);
      expect(late.tracks[0]?.stop).toHaveBeenCalled();
      expect(late.audio.contexts).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
