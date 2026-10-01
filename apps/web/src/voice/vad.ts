/**
 * Voice-activity detection for the OpenRouter provider (#128, D-55). An `AnalyserNode` over the
 * same echo-cancelled `getUserMedia` stream the recorder uses is sampled every `VAD_FRAME_MS`;
 * each frame's RMS feeds either the endpointer (one listening turn) or the barge-in detector
 * (while Chloe speaks). The decisions are pure functions of (rms, time) so the D-53 seam can
 * script them with a stub `AudioContext` and fake timers.
 */

/** RMS (0..1 full scale) above which a frame counts as speech. */
export const SPEECH_RMS_THRESHOLD = 0.02;
/** Silence after speech that ends a turn. */
export const END_SILENCE_MS = 1200;
/** Hard cap on one turn, speech or not. */
export const MAX_UTTERANCE_MS = 30_000;
/** Louder than speech: what it takes to interrupt Chloe by voice while she plays. */
export const BARGE_IN_RMS_THRESHOLD = 0.08;
/** How long the barge-in level must hold. */
export const BARGE_IN_HOLD_MS = 250;
/** How often the analyser is sampled. An interval, not requestAnimationFrame: rAF stops in a
 * background tab, and a turn must still end there. */
export const VAD_FRAME_MS = 50;

type AnalyserLike = { fftSize: number; getFloatTimeDomainData(buffer: Float32Array): void };
type SourceLike = { connect(node: unknown): void; disconnect?(): void };
type AudioContextLike = {
  createMediaStreamSource(stream: MediaStream): SourceLike;
  createAnalyser(): AnalyserLike;
  close(): Promise<void> | void;
};
export type AudioContextCtor = new () => AudioContextLike;

export type VadWindow = { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor };

export function audioContextOf(win: unknown): AudioContextCtor | null {
  const w = win as VadWindow;
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

export type Vad = { stop(): void };

/**
 * Samples `stream`'s RMS every `VAD_FRAME_MS` and hands each value to `onFrame`. `stop()` clears
 * the interval and closes the context; it does not stop the stream's tracks (the caller owns
 * them).
 */
export function createVad(Ctor: AudioContextCtor, stream: MediaStream, onFrame: (rms: number) => void): Vad {
  const context = new Ctor();
  const source = context.createMediaStreamSource(stream);
  const analyser = context.createAnalyser();
  analyser.fftSize = 1024;
  source.connect(analyser);
  const buffer = new Float32Array(analyser.fftSize);
  let stopped = false;
  const timer = setInterval(() => {
    if (stopped) return;
    analyser.getFloatTimeDomainData(buffer);
    let sum = 0;
    for (let i = 0; i < buffer.length; i += 1) sum += buffer[i]! * buffer[i]!;
    onFrame(Math.sqrt(sum / buffer.length));
  }, VAD_FRAME_MS);
  return {
    stop() {
      if (stopped) return;
      stopped = true;
      clearInterval(timer);
      source.disconnect?.();
      void Promise.resolve(context.close()).catch(() => undefined);
    },
  };
}

export type Endpoint = "speech-ended" | "max-length";

/** One listening turn: speech then `END_SILENCE_MS` of silence, or `MAX_UTTERANCE_MS` total. */
export function createEndpointer(start: number) {
  let heard = false;
  let lastLoud = start;
  return {
    heardSpeech: () => heard,
    frame(rms: number, at: number): Endpoint | null {
      if (rms >= SPEECH_RMS_THRESHOLD) {
        heard = true;
        lastLoud = at;
      }
      if (at - start >= MAX_UTTERANCE_MS) return "max-length";
      if (heard && at - lastLoud >= END_SILENCE_MS) return "speech-ended";
      return null;
    },
  };
}

/** True once `BARGE_IN_RMS_THRESHOLD` has held, unbroken, for `BARGE_IN_HOLD_MS`. */
export function createBargeInDetector() {
  let since: number | null = null;
  return {
    frame(rms: number, at: number): boolean {
      if (rms < BARGE_IN_RMS_THRESHOLD) {
        since = null;
        return false;
      }
      since ??= at;
      return at - since >= BARGE_IN_HOLD_MS;
    },
  };
}
