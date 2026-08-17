import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, ApiClientError } from "../api/client";
import { useAuth } from "../context/AuthContext";

// Entry point opened by the LOS: /launch?token=<short-lived signed token>.
// Redeems the token exactly once, establishes a session cookie, then drops the user
// straight into the dashboard - no login screen at any point.
export function Launch() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = params.get("token");
    if (!token) {
      navigate("/launch-error?reason=missing_token", { replace: true });
      return;
    }
    api
      .post("/api/launch/validate", { token })
      .then(async () => {
        await refresh();
        navigate("/dashboard", { replace: true });
      })
      .catch((err) => {
        const message = err instanceof ApiClientError ? err.message : "Unable to open the Ticketing Tool.";
        setError(message);
        navigate(`/launch-error?reason=${encodeURIComponent(message)}`, { replace: true });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="centered-screen">
      <div>Opening your Ticketing Tool session…</div>
      {error && <div className="error-banner">{error}</div>}
    </div>
  );
}
