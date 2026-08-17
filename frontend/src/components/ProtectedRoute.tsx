import { ReactNode, useEffect } from "react";
import { useAuth } from "../context/AuthContext";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { loading, me, error } = useAuth();

  // No real LOS integration is live yet, so someone landing here with no session is
  // almost always a person who typed the bare domain rather than a real LOS launch.
  // Send them to the no-login dashboard instead of a dead-end message.
  useEffect(() => {
    if (!loading && !me) {
      window.location.replace("/dashboard.html");
    }
  }, [loading, me]);

  if (loading) {
    return <div className="centered-screen">Loading…</div>;
  }

  if (!me) {
    return (
      <div className="centered-screen">
        <h2>No active Ticketing Tool session</h2>
        <p style={{ color: "var(--text-muted)", maxWidth: 480 }}>{error ?? "Redirecting to the dashboard…"}</p>
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
