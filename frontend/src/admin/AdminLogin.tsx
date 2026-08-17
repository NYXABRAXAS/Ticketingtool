import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiClientError } from "../api/client";
import { useAdminAuth } from "./AdminAuthContext";

export function AdminLogin() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { refresh } = useAdminAuth();
  const navigate = useNavigate();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post("/api/admin/auth/login", { username, password });
      await refresh();
      navigate("/admin", { replace: true });
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Login failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="centered-screen">
      <form className="card" onSubmit={onSubmit} style={{ width: 320 }}>
        <h2 style={{ marginTop: 0 }}>Ticketing Tool Admin</h2>
        <p style={{ color: "var(--text-muted)", fontSize: 12.5 }}>Internal administrators only. LOS users never see this screen.</p>
        {error && <div className="error-banner">{error}</div>}
        <div className="form-field">
          <label>Username</label>
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
        </div>
        <div className="form-field">
          <label>Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <button className="btn btn-primary" type="submit" disabled={busy} style={{ width: "100%" }}>
          {busy ? "Signing in…" : "Sign In"}
        </button>
      </form>
    </div>
  );
}
