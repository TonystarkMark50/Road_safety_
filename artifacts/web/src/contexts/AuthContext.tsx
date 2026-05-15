import { createContext, useContext, useEffect, useState } from "react";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { useGetMe } from "@workspace/api-client-react";

interface AuthContextValue {
  user: {
    id: number;
    name: string;
    email: string;
    phone?: string | null;
    role: string;
    isVerified: boolean;
    reportsCount: number;
    createdAt: string;
  } | null;
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
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("auth_token"));

  useEffect(() => {
    setAuthTokenGetter(() => localStorage.getItem("auth_token"));
  }, []);

  const { data: user, isLoading } = useGetMe({
    query: {
      enabled: !!token,
      retry: false,
      queryKey: ["getMe", token],
    },
  });

  function setAuth(newToken: string) {
    localStorage.setItem("auth_token", newToken);
    setToken(newToken);
  }

  function clearAuth() {
    localStorage.removeItem("auth_token");
    setToken(null);
  }

  return (
    <AuthContext.Provider value={{ user: user ?? null, token, isLoading: !!token && isLoading, setAuth, clearAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
