/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** `web` (default) | `openrouter` | `fake` | `off` — see `selectProvider.ts`. */
  readonly VITE_VOICE_PROVIDER?: string;
}
