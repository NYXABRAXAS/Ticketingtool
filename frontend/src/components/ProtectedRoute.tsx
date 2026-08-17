import { ReactNode } from "react";
import { useAuth } from "../context/AuthContext";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { loading, me, error } = useAuth();

  if (loading) {
    return <div className="centered-screen">Loading…</div>;
  }

  if (!me) {
    return (
      <div className="centered-screen">
        <h2>No active Ticketing Tool session</h2>
        <p style={{ color: "var(--text-muted)", maxWidth: 480 }}>{error ?? "Please open the Ticketing Tool from your LOS."}</p>
      </div>
    );
  }

  return <>{children}</>;
}

export function RequirePermission({ perm, children }: { perm: string; children: ReactNode }) {
  const { hasPermission } = useAuth();
  if (!hasPermission(perm)) {
    return (
      <div className="empty-state">
        <p>You do not have permission to view this page.</p>
      </div>
    );
  }
  return <>{children}</>;
}
