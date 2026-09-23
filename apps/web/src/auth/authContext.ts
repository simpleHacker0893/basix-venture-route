import { createContext, useContext } from "react";

import type { Role } from "./config";

export type { Role } from "./config";

/** The one auth shape screens read; Clerk and the no-key mode both publish it. */
export type AuthState = {
  /** False when VITE_CLERK_PUBLISHABLE_KEY is empty or the placeholder. */
  configured: boolean;
  isLoaded: boolean;
  isSignedIn: boolean;
  /** Clerk `publicMetadata.role` (D-03); null before the role choice. */
  role: Role | null;
  getToken(): Promise<string | null>;
  /** Re-reads the Clerk user so a freshly written `publicMetadata.role` becomes visible. */
  reload(): Promise<void>;
  signOut(): Promise<void>;
};

export const NO_KEY_AUTH: AuthState = {
  configured: false,
  isLoaded: true,
  isSignedIn: false,
  role: null,
  getToken: async () => null,
  reload: async () => undefined,
  signOut: async () => undefined,
};

export const AuthContext = createContext<AuthState | null>(null);

/** True only under a real <ClerkProvider>; Clerk's prebuilt components need it to mount. */
export const ClerkMountedContext = createContext(false);

export function useClerkMounted(): boolean {
  return useContext(ClerkMountedContext);
}

export function useAuthState(): AuthState {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuthState must be used inside AuthProvider");
  return value;
}
