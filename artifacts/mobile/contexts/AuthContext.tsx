import { useAuth as useClerkAuth, useUser, useClerk } from "@clerk/expo";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: "citizen" | "admin" | "authority" | "emergency";
  isVerified?: boolean;
  reportsCount?: number;
  createdAt: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: (user: AuthUser, token: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  token: null,
  isLoading: true,
  login: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoaded, getToken } = useClerkAuth();
  const { user: clerkUser } = useUser();
  const { signOut } = useClerk();
  const [localUser, setLocalUser] = useState<AuthUser | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    setAuthTokenGetter(() => getToken());
  }, [getToken]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !clerkUser || synced || syncing) return;

    setSyncing(true);
    const email = clerkUser.primaryEmailAddress?.emailAddress ?? "";
    const name = clerkUser.fullName || email.split("@")[0];

    getToken()
      .then((token) =>
        fetch(`https://${process.env.EXPO_PUBLIC_DOMAIN}/api/auth/sync`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ name, email }),
        }),
      )
      .then((r) => {
        if (!r.ok) throw new Error("sync failed");
        return r.json();
      })
      .then((user: AuthUser) => {
        setLocalUser(user);
        setSynced(true);
      })
      .catch(() => {})
      .finally(() => setSyncing(false));
  }, [isSignedIn, isLoaded, clerkUser, synced, syncing, getToken]);

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      setLocalUser(null);
      setSynced(false);
    }
  }, [isSignedIn, isLoaded]);

  const logout = useCallback(async () => {
    setLocalUser(null);
    setSynced(false);
    await signOut();
  }, [signOut]);

  const login = useCallback(async (_user: AuthUser, _token: string) => {}, []);

  const isLoading = !isLoaded || (!!isSignedIn && !synced && !localUser);

  return (
    <AuthContext.Provider value={{ user: localUser, token: null, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
