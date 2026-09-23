/**
 * Publishes one `AuthState` (authContext.ts). With a configured key the tree is wrapped in
 * Clerk's provider and the state is derived from `useAuth` / `useUser`; without a key the
 * no-key state is published and Clerk never loads. Tests pass a fake `auth` so jsdom never
 * touches Clerk.
 */
import { ClerkProvider, useAuth, useUser } from "@clerk/react";
import { useMemo, type ReactNode } from "react";
import { useNavigate } from "react-router";

import { AuthContext, ClerkMountedContext, NO_KEY_AUTH, type AuthState } from "./authContext";
import { CLERK_PUBLISHABLE_KEY, isClerkConfigured, parseRole } from "./config";

type Props = { auth?: AuthState; children: ReactNode };

export function AuthProvider({ auth, children }: Props) {
  if (auth) return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
  if (!isClerkConfigured(CLERK_PUBLISHABLE_KEY)) {
    return <AuthContext.Provider value={NO_KEY_AUTH}>{children}</AuthContext.Provider>;
  }
  return <ClerkAuthProvider>{children}</ClerkAuthProvider>;
}

function ClerkAuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  return (
    <ClerkProvider
      publishableKey={CLERK_PUBLISHABLE_KEY}
      routerPush={(to) => navigate(to)}
      routerReplace={(to) => navigate(to, { replace: true })}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      afterSignOutUrl="/"
    >
      <ClerkStateBridge>{children}</ClerkStateBridge>
    </ClerkProvider>
  );
}

function ClerkStateBridge({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, getToken, signOut } = useAuth();
  const { user } = useUser();
  const role = parseRole(user?.publicMetadata.role);
  const value = useMemo<AuthState>(
    () => ({
      configured: true,
      isLoaded,
      isSignedIn: isSignedIn === true,
      role,
      getToken: () => getToken(),
      reload: async () => {
        await user?.reload();
      },
      signOut: () => signOut(),
    }),
    [isLoaded, isSignedIn, role, getToken, signOut, user],
  );
  return (
    <ClerkMountedContext.Provider value={true}>
      <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
    </ClerkMountedContext.Provider>
  );
}
