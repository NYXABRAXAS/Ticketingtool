import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { api } from "../api/client";

interface AdminUser { username: string; displayName: string; role: string }

interface AdminAuthState {
  loading: boolean;
  admin: AdminUser | null;
  refresh: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthState | undefined>(undefined);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    try {
      setAdmin(await api.get<AdminUser>("/api/admin/auth/me"));
    } catch {
      setAdmin(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  return <AdminAuthContext.Provider value={{ loading, admin, refresh }}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth must be used within AdminAuthProvider");
  return ctx;
}
