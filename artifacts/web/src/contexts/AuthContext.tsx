import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useAuth as useClerkAuth, useUser, useClerk } from "@clerk/react";

interface LocalUser {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  role: string;
  isVerified: boolean;
  reportsCount: number;
  createdAt: string;
}

interface AuthContextValue {
  user: LocalUser | null;
  token: string | null;
  isLoading: boolean;
  setAuth: (token: string) => void;
  clearAuth: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  token: null,
  isLoading: true,
  setAuth: () => {},
  clearAuth: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoaded } = useClerkAuth();
  const { user: clerkUser } = useUser();
  const { signOut } = useClerk();
  const [localUser, setLocalUser] = useState<LocalUser | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !clerkUser || synced || syncing) return;

    setSyncing(true);
    const email = clerkUser.primaryEmailAddress?.emailAddress ?? "";
    const name = clerkUser.fullName || email.split("@")[0];

    fetch("/api/auth/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name, email }),
    })
      .then((r) => {
        if (!r.ok) throw new Error("sync failed");
        return r.json();
      })
      .then((user) => {
        setLocalUser(user);
        setSynced(true);
      })
      .catch(() => {})
      .finally(() => setSyncing(false));
  }, [isSignedIn, isLoaded, clerkUser, synced, syncing]);

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      setLocalUser(null);
      setSynced(false);
    }
  }, [isSignedIn, isLoaded]);

  const clearAuth = useCallback(() => {
    setLocalUser(null);
    setSynced(false);
    signOut();
  }, [signOut]);

  const isLoading = !isLoaded || (!!isSignedIn && !synced && !localUser);

  return (
    <AuthContext.Provider
      value={{
        user: localUser,
        token: null,
        isLoading,
        setAuth: () => {},
        clearAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
