/**
 * Voice mode's state machine (#128, D-55): ChatGPT / Claude style, half-duplex.
 *
 *   off ──enter──▶ speaking ──floor free──▶ listening ──heard──▶ thinking ──Chloe speaks──▶ speaking
 *                     ▲  └──interrupt (tap, voice)──▶ listening ◀──silence (restart)──┘
 *   listening | thinking | speaking ──mute──▶ muted ──unmute──▶ speaking | listening
 *   any ──end──▶ off
 *
 * Pure: `useVoiceMode.ts` turns the outside world (Chloe's utterance queue, the routing store's
 * `busy`, whether the intake chat is on screen) into `sync` actions and runs the side effects.
 */

export type VoiceModePhase = "off" | "listening" | "thinking" | "speaking" | "muted";
export type ActivePhase = Exclude<VoiceModePhase, "off">;

/** The state label under the orb, announced through its polite live region. */
export const VOICE_MODE_LABELS: Record<ActivePhase, string> = {
  listening: "Listening",
  thinking: "Thinking",
  speaking: "Speaking",
  muted: "Muted",
};

export type VoiceModeState = {
  phase: VoiceModePhase;
  /** Bumped every time a new listening turn should open, including a silent turn's restart. */
  turn: number;
  /** True from a heard utterance until `submitTranscript` has returned. */
  pending: boolean;
};

/** What `sync` needs to know about the world outside the machine. */
export type VoiceModeWorld = {
  /** Chloe has a line playing or queued. */
  chloeSpeaking: boolean;
  /** A request to the engine is in flight. */
  busy: boolean;
  /** The intake chat is on screen, so a turn can be heard and submitted. */
  canListen: boolean;
};

export type VoiceModeAction =
  | { type: "enter"; chloeSpeaking: boolean }
  | { type: "heard" }
  | { type: "submitted" }
  | { type: "silence" }
  | { type: "interrupt" }
  | { type: "mute" }
  | { type: "unmute"; chloeSpeaking: boolean }
  | { type: "end" }
  | ({ type: "sync" } & VoiceModeWorld);

export const VOICE_MODE_OFF: VoiceModeState = { phase: "off", turn: 0, pending: false };

/** After this long in voice mode with no speech from the founder, the mic mutes itself. */
export const IDLE_MUTE_MS = 120_000;

function listening(state: VoiceModeState): VoiceModeState {
  return { phase: "listening", turn: state.turn + 1, pending: false };
}

export function voiceModeReducer(state: VoiceModeState, action: VoiceModeAction): VoiceModeState {
  switch (action.type) {
    case "enter":
      if (state.phase !== "off") return state;
      // Half-duplex: whatever Chloe is saying (the greeting on the first turn) finishes first.
      return action.chloeSpeaking ? { ...state, phase: "speaking", pending: false } : listening(state);
    case "heard":
      return state.phase === "listening" ? { ...state, phase: "thinking", pending: true } : state;
    case "submitted":
      return state.pending ? { ...state, pending: false } : state;
    case "silence":
      // Silence costs nothing (D-55): the turn just reopens.
      return state.phase === "listening" ? listening(state) : state;
    case "interrupt":
      return state.phase === "speaking" ? listening(state) : state;
    case "mute":
      return state.phase === "off" || state.phase === "muted" ? state : { ...state, phase: "muted", pending: false };
    case "unmute":
      if (state.phase !== "muted") return state;
      return action.chloeSpeaking ? { ...state, phase: "speaking" } : listening(state);
    case "end":
      return state.phase === "off" ? state : { ...VOICE_MODE_OFF, turn: state.turn };
    case "sync":
      return sync(state, action);
    default:
      return state;
  }
}

/** Follow the world: Chloe speaking takes the floor; once it is free, listen again (or leave). */
function sync(state: VoiceModeState, world: VoiceModeWorld): VoiceModeState {
  switch (state.phase) {
    case "listening":
      if (!world.canListen) return { ...VOICE_MODE_OFF, turn: state.turn };
      return world.chloeSpeaking ? { ...state, phase: "speaking" } : state;
    case "thinking":
    case "speaking": {
      if (world.chloeSpeaking) return state.phase === "speaking" ? state : { ...state, phase: "speaking" };
      if (world.busy || state.pending) return state.phase === "thinking" ? state : { ...state, phase: "thinking" };
      // The floor is free. Off the intake chat (the route is on screen, or the founder moved to
      // the form or review), voice mode is over once Chloe has finished.
      return world.canListen ? listening(state) : { ...VOICE_MODE_OFF, turn: state.turn };
    }
    case "muted":
      return world.canListen ? state : { ...VOICE_MODE_OFF, turn: state.turn };
    default:
      return state;
  }
}
