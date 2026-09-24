import { useCallback, useEffect, useMemo, useRef, type ReactNode } from "react";

import { useAuthState } from "../auth/authContext";
import { useVoice } from "../voice/VoiceSession";
import { FounderVoiceContext, type FounderVoiceValue, readStoredVoice, writeStoredVoice } from "./founderVoice";
import { GREETING } from "./script";

/**
 * Mounted in App under `VoiceSessionProvider`, above every route (#102). For a signed-in founder
 * it restores the switch from sessionStorage (no speech: a restore is not a gesture) and
 * remembers every change; it owns the top-nav switch handler, which on /route is Chloe's
 * conductor `toggleVoice`.
 */
export function FounderVoiceProvider({ children }: { children: ReactNode }) {
  const voice = useVoice();
  const { enabled, greeted, supported, enable, disable, markGreeted, say } = voice;
  const auth = useAuthState();
  const isFounder = auth.isLoaded && auth.isSignedIn && auth.role === "founder";
  const routeToggle = useRef<(() => void) | null>(null);

  // Once per page load, as soon as the founder's auth has loaded.
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current || !isFounder || !supported) return;
    restored.current = true;
    const stored = readStoredVoice();
    if (!stored) return;
    if (stored.greeted) markGreeted();
    if (stored.on) enable();
  }, [isFounder, supported, enable, markGreeted]);

  // Skip the first run: the initial "off" must not overwrite what the restore above reads.
  const persisted = useRef<string | null>(null);
  useEffect(() => {
    const key = JSON.stringify({ on: enabled, greeted });
    if (persisted.current === null) {
      persisted.current = key;
      return;
    }
    if (persisted.current === key) return;
    persisted.current = key;
    if (isFounder) writeStoredVoice({ on: enabled, greeted });
  }, [enabled, greeted, isFounder]);

  const toggle = useCallback(() => {
    if (routeToggle.current) {
      routeToggle.current();
      return;
    }
    if (enabled) {
      disable();
      return;
    }
    enable();
    if (!greeted) {
      markGreeted();
      say(GREETING).catch(() => undefined);
    }
  }, [enabled, greeted, enable, disable, markGreeted, say]);

  const registerRouteToggle = useCallback((next: () => void) => {
    routeToggle.current = next;
    return () => {
      if (routeToggle.current === next) routeToggle.current = null;
    };
  }, []);

  const value = useMemo<FounderVoiceValue>(() => ({ toggle, registerRouteToggle }), [toggle, registerRouteToggle]);
  return <FounderVoiceContext.Provider value={value}>{children}</FounderVoiceContext.Provider>;
}
