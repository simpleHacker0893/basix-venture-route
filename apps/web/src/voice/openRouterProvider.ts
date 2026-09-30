/**
 * The cloud provider (D-53, #127): records the founder with `MediaRecorder` and transcribes the
 * recording through the engine's public `POST /api/voice/transcribe`; speaks through
 * `POST /api/voice/speak` and plays the returned mp3 with `Audio`. The OpenRouter key lives only
 * on the engine. Every browser API is read through the injected `win`, and the network through
 * `fetchLike`, so `test/openrouter-voice.test.ts` can stub them all.
 *
 * Choices the interface leaves open:
 * - `stopListening()` while `getUserMedia` is still pending (permission prompt open) ends the
 *   session at once: `onEnd()` fires with no `onFinal`, and a stream granted later is released
 *   untouched, so `releaseMic()` never waits on the prompt. A later denial is not reported.
 * - `speak()` while a previous speak is in flight cancels the previous one first (it resolves),
 *   exactly like the web provider.
 * - There is no interim result: `onInterim` is never called.
 */
import type { ListenHandlers, VoiceErrorCode, VoiceProvider } from "./provider";

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

type RecorderLike = {
  mimeType: string;
  state: string;
  ondataavailable: ((event: { data: Blob }) => void) | null;
  onstop: (() => void) | null;
  start(): void;
  stop(): void;
};

type RecorderCtor = {
  new (stream: MediaStream, options?: { mimeType?: string }): RecorderLike;
  isTypeSupported?(type: string): boolean;
};

type AudioLike = {
  onended: (() => void) | null;
  onerror: (() => void) | null;
  play(): Promise<void> | void;
  pause(): void;
};

type AudioCtor = new (src: string) => AudioLike;

type RecordingWindow = {
  navigator?: { mediaDevices?: { getUserMedia?: (constraints: MediaStreamConstraints) => Promise<MediaStream> } };
  MediaRecorder?: RecorderCtor;
  Audio?: AudioCtor;
  URL?: Pick<typeof URL, "createObjectURL" | "revokeObjectURL">;
  fetch?: FetchLike;
};

export type OpenRouterProviderOptions = {
  /** The engine origin (`API_URL`); "" means same-origin, as in local dev behind the Vite proxy. */
  baseUrl?: string;
  fetchLike?: FetchLike;
  /** Applied to the text before it is posted to `/api/voice/speak`; identity by default. */
  transform?: (text: string) => string;
};

function mapMediaError(cause: unknown): VoiceErrorCode {
  const name = (cause as { name?: unknown } | null)?.name;
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return "not-allowed";
    case "NotFoundError":
    case "OverconstrainedError":
    case "NotReadableError":
      return "audio-capture";
    default:
      return "unknown";
  }
}

function releaseStream(stream: MediaStream | null): void {
  stream?.getTracks().forEach((track) => track.stop());
}

type ListenSession = {
  handlers: ListenHandlers;
  stream: MediaStream | null;
  recorder: RecorderLike | null;
  controller: AbortController | null;
  /** Set once the session is over from the caller's point of view (stop pre-start, or abort). */
  closed: boolean;
};

export function createOpenRouterProvider(win: Window = window, options: OpenRouterProviderOptions = {}): VoiceProvider {
  const w = win as unknown as RecordingWindow;
  const getUserMedia = w.navigator?.mediaDevices?.getUserMedia;
  const RecorderCtor = w.MediaRecorder ?? null;
  const AudioCtorRef = w.Audio ?? null;
  const supported = typeof getUserMedia === "function" && typeof RecorderCtor === "function" && typeof AudioCtorRef === "function";
  const baseUrl = options.baseUrl ?? "";
  const fetchLike: FetchLike = options.fetchLike ?? ((input, init) => (w.fetch as FetchLike)(input, init));
  const transform = options.transform ?? ((text: string) => text);
  const urls = w.URL ?? URL;

  let session: ListenSession | null = null;
  let cancelCurrent: (() => void) | null = null;

  function pickMime(): string {
    return RecorderCtor?.isTypeSupported?.("audio/webm") ? "audio/webm" : "audio/mp4";
  }

  function transcribe(current: ListenSession, blob: Blob, mime: string): void {
    const controller = new AbortController();
    current.controller = controller;
    const finish = (): void => {
      if (session === current) session = null;
      current.handlers.onEnd();
    };
    fetchLike(`${baseUrl}/api/voice/transcribe`, {
      method: "POST",
      headers: { "Content-Type": mime },
      body: blob,
      signal: controller.signal,
    })
      .then(async (response) => {
        if (current.closed) return;
        if (!response.ok) throw new Error(`transcribe ${response.status}`);
        const body = (await response.json()) as { text?: unknown };
        if (current.closed) return;
        const text = typeof body.text === "string" ? body.text.trim() : "";
        if (text) current.handlers.onFinal(text);
        finish();
      })
      .catch(() => {
        if (current.closed) return;
        current.handlers.onError({ code: "network" });
        finish();
      });
  }

  function beginRecording(current: ListenSession, stream: MediaStream): void {
    current.stream = stream;
    const mime = pickMime();
    const failToStart = (): void => {
      releaseStream(stream);
      session = null;
      current.handlers.onError({ code: "unknown" });
      current.handlers.onEnd();
    };
    let recorder: RecorderLike;
    try {
      recorder = new RecorderCtor!(stream, { mimeType: mime });
    } catch {
      failToStart();
      return;
    }
    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) chunks.push(event.data);
    };
    recorder.onstop = () => {
      releaseStream(stream);
      if (current.closed) return;
      const type = recorder.mimeType || mime;
      const blob = new Blob(chunks, { type });
      if (blob.size === 0) {
        if (session === current) session = null;
        current.handlers.onEnd();
        return;
      }
      transcribe(current, blob, type);
    };
    try {
      recorder.start();
    } catch {
      // Never leave a session whose stop() cannot end it: releaseMic() would hang.
      recorder.onstop = null;
      failToStart();
      return;
    }
    current.recorder = recorder;
  }

  function startListening(handlers: ListenHandlers): void {
    if (!supported || !getUserMedia) {
      handlers.onEnd();
      return;
    }
    // One recording at a time: a new press discards whatever the previous one was doing.
    if (session) abortListening();
    const current: ListenSession = { handlers, stream: null, recorder: null, controller: null, closed: false };
    session = current;
    getUserMedia.call(w.navigator!.mediaDevices, { audio: true }).then(
      (stream) => {
        if (current.closed) {
          releaseStream(stream);
          return;
        }
        beginRecording(current, stream);
      },
      (cause: unknown) => {
        if (current.closed) return;
        session = null;
        handlers.onError({ code: mapMediaError(cause) });
        handlers.onEnd();
      },
    );
  }

  function stopListening(): void {
    const current = session;
    if (!current) return;
    if (current.recorder) {
      if (current.recorder.state !== "inactive") current.recorder.stop();
      return;
    }
    // getUserMedia is still pending: end now with no transcript (see the header comment).
    current.closed = true;
    session = null;
    current.handlers.onEnd();
  }

  function abortListening(): void {
    const current = session;
    if (!current) return;
    current.closed = true;
    session = null;
    current.controller?.abort();
    if (current.recorder && current.recorder.state !== "inactive") current.recorder.stop();
    releaseStream(current.stream);
  }

  function speak(text: string): Promise<void> {
    cancelSpeech();
    return new Promise((resolve) => {
      const spoken = transform(text);
      if (!supported || !AudioCtorRef || spoken.trim() === "") {
        resolve();
        return;
      }
      const controller = new AbortController();
      let audio: AudioLike | null = null;
      let objectUrl: string | null = null;
      let settled = false;
      const finish = (): void => {
        if (settled) return;
        settled = true;
        if (cancelCurrent === cancel) cancelCurrent = null;
        if (audio) {
          audio.onended = null;
          audio.onerror = null;
        }
        if (objectUrl) urls.revokeObjectURL(objectUrl);
        resolve();
      };
      const cancel = (): void => {
        controller.abort();
        audio?.pause();
        finish();
      };
      cancelCurrent = cancel;
      fetchLike(`${baseUrl}/api/voice/speak`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: spoken }),
        signal: controller.signal,
      })
        .then(async (response) => {
          if (!response.ok) throw new Error(`speak ${response.status}`);
          const blob = await response.blob();
          if (settled) return;
          objectUrl = urls.createObjectURL(blob);
          audio = new AudioCtorRef(objectUrl);
          audio.onended = finish;
          audio.onerror = finish;
          await audio.play();
        })
        .catch(() => finish());
    });
  }

  function cancelSpeech(): void {
    cancelCurrent?.();
  }

  return { kind: "openrouter", supported, speak, cancelSpeech, startListening, stopListening, abortListening };
}
