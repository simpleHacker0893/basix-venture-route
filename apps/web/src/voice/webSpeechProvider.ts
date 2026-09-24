/**
 * The real provider, over the browser's `SpeechRecognition` and `speechSynthesis` APIs
 * (Sprint 006 blueprint §Interfaces). Neither API is in TypeScript's DOM lib as a standard, so
 * the shapes below are the minimal surface this file reads. Under jsdom (every RTL test) both
 * are absent, so `supported` is false and every call is inert — the seam this ticket tests.
 */
import type { ListenHandlers, VoiceError, VoiceErrorCode, VoiceProvider } from "./provider";

type SpeechRecognitionResultLike = {
  isFinal: boolean;
  [index: number]: { transcript: string } | undefined;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
};

type SpeechRecognitionErrorEventLike = { error: string };

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

type SpeechWindow = Window & {
  SpeechRecognition?: SpeechRecognitionCtor;
  webkitSpeechRecognition?: SpeechRecognitionCtor;
  // Declared as a global `var`, not a member of TypeScript's `Window` interface.
  SpeechSynthesisUtterance?: new (text: string) => SpeechSynthesisUtterance;
};

/** Preference order for `pickVoice`, tried in turn before falling back to any English voice. */
export const PREFERRED_VOICES: RegExp[] = [/Google UK English Female/, /Microsoft (Sonia|Libby|Aria|Jenny)/];

export function pickVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  for (const pattern of PREFERRED_VOICES) {
    const match = voices.find((voice) => pattern.test(voice.name));
    if (match) return match;
  }
  return voices.find((voice) => voice.lang.startsWith("en")) ?? null;
}

function mapErrorCode(code: string): VoiceErrorCode {
  switch (code) {
    case "no-speech":
      return "no-speech";
    case "not-allowed":
    case "service-not-allowed":
      return "not-allowed";
    case "network":
      return "network";
    case "audio-capture":
      return "audio-capture";
    case "aborted":
      return "aborted";
    default:
      return "unknown";
  }
}

/** Chrome drops long utterances: split at sentence boundaries, ~180 characters per utterance. */
function chunkSpeech(text: string, maxLen = 180): string[] {
  const sentences = text.split(/(?<=[.!?])\s+/).filter((s) => s.length > 0);
  const chunks: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    const candidate = current ? `${current} ${sentence}` : sentence;
    if (candidate.length <= maxLen) {
      current = candidate;
      continue;
    }
    if (current) chunks.push(current);
    if (sentence.length <= maxLen) {
      current = sentence;
      continue;
    }
    let piece = "";
    for (const word of sentence.split(" ")) {
      const next = piece ? `${piece} ${word}` : word;
      if (next.length > maxLen && piece) {
        chunks.push(piece);
        piece = word;
      } else {
        piece = next;
      }
    }
    current = piece;
  }
  if (current) chunks.push(current);
  return chunks;
}

export function createWebSpeechProvider(win: Window = window): VoiceProvider {
  const speechWin = win as SpeechWindow;
  const RecognitionCtor = speechWin.SpeechRecognition ?? speechWin.webkitSpeechRecognition ?? null;
  const synth = speechWin.speechSynthesis ?? null;
  const UtteranceCtor = speechWin.SpeechSynthesisUtterance ?? null;
  const supported = Boolean(RecognitionCtor) && Boolean(synth) && Boolean(UtteranceCtor);

  let lang: "en-GB" | "en-US" = "en-GB";
  let activeRecognition: SpeechRecognitionLike | null = null;
  let resolvedVoice: SpeechSynthesisVoice | null = null;
  let pendingCancel: (() => void) | null = null;

  function refreshVoice(): void {
    if (!synth) return;
    resolvedVoice = pickVoice(synth.getVoices());
  }

  if (synth) {
    refreshVoice();
    synth.addEventListener("voiceschanged", refreshVoice);
  }

  function speak(text: string): Promise<void> {
    return new Promise((resolve) => {
      if (!synth || !UtteranceCtor) {
        resolve();
        return;
      }
      const chunks = chunkSpeech(text);
      if (chunks.length === 0) {
        resolve();
        return;
      }
      let index = 0;
      pendingCancel = resolve;
      const speakNext = (): void => {
        if (index >= chunks.length) {
          pendingCancel = null;
          resolve();
          return;
        }
        const utterance = new UtteranceCtor(chunks[index]!);
        if (resolvedVoice) utterance.voice = resolvedVoice;
        const advance = (): void => {
          index += 1;
          speakNext();
        };
        utterance.onend = advance;
        utterance.onerror = advance;
        synth.speak(utterance);
      };
      speakNext();
    });
  }

  function cancelSpeech(): void {
    synth?.cancel();
    if (pendingCancel) {
      const resolve = pendingCancel;
      pendingCancel = null;
      resolve();
    }
  }

  function startListening(handlers: ListenHandlers): void {
    if (!supported || !RecognitionCtor) {
      handlers.onEnd();
      return;
    }
    const recognition = new RecognitionCtor();
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const transcript = result?.[0]?.transcript ?? "";
        if (result?.isFinal) handlers.onFinal(transcript);
        else handlers.onInterim(transcript);
      }
    };
    recognition.onerror = (event) => {
      if (event.error === "language-not-supported" && lang === "en-GB") {
        lang = "en-US";
        startListening(handlers);
        return;
      }
      handlers.onError({ code: mapErrorCode(event.error) } satisfies VoiceError);
    };
    recognition.onend = () => {
      activeRecognition = null;
      handlers.onEnd();
    };
    activeRecognition = recognition;
    recognition.start();
  }

  function stopListening(): void {
    activeRecognition?.stop();
  }

  function abortListening(): void {
    activeRecognition?.abort();
  }

  return { kind: "web", supported, speak, cancelSpeech, startListening, stopListening, abortListening };
}
