import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { api, ApiClientError } from "../api/client";
import { MeResponse } from "../types";

interface AuthState {
  loading: boolean;
  me: MeResponse | null;
  error: string | null;
  refresh: () => Promise<void>;
  hasPermission: (perm: string) => boolean;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const result = await api.get<MeResponse>("/api/me");
      setMe(result);
      setError(null);
    } catch (err) {
      setMe(null);
      if (err instanceof ApiClientError) setError(err.message);
      else setError("Unable to load your Ticketing Tool session.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const hasPermission = (perm: string) => Boolean(me?.user.permissions.includes(perm) || me?.user.role === "INTERNAL_ADMIN");

  return <AuthContext.Provider value={{ loading, me, error, refresh, hasPermission }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
