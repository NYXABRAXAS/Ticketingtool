import { useEffect, useState } from "react";
import { api, ApiClientError } from "../../api/client";

interface Client { id: string; code: string }
interface OriginRow { id: string; origin: string; active: boolean; client: Client | null }

export function Origins() {
  const [origins, setOrigins] = useState<OriginRow[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [origin, setOrigin] = useState("");
  const [clientId, setClientId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = () => api.get<OriginRow[]>("/api/admin/allowed-origins").then(setOrigins);
  useEffect(() => { load(); api.get<Client[]>("/api/admin/clients").then(setClients); }, []);

  return (
    <div>
      <h2>Allowed Origins</h2>
      <p style={{ color: "var(--text-muted)" }}>Browser-side CORS allow-list for LOS origins embedding this tool (iframe or same-tab navigation). Server-to-server calls are unaffected.</p>

      <div className="card" style={{ padding: 0, marginBottom: 20 }}>
        <table>
          <thead><tr><th>Origin</th><th>Client</th><th>Active</th><th></th></tr></thead>
          <tbody>
            {origins.map((o) => (
              <tr key={o.id}>
                <td>{o.origin}</td>
                <td>{o.client?.code ?? "Any"}</td>
                <td>{o.active ? "Yes" : "No"}</td>
                <td>
                  <button className="btn" onClick={() => api.put(`/api/admin/allowed-origins/${o.id}`, { active: !o.active }).then(load)}>
                    {o.active ? "Deactivate" : "Activate"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {origins.length === 0 && <div className="empty-state">No origins configured beyond the ALLOWED_ORIGINS environment variable.</div>}
      </div>

      <div className="card" style={{ maxWidth: 420 }}>
        <h3 style={{ marginTop: 0 }}>Add Origin</h3>
        {error && <div className="error-banner">{error}</div>}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setError(null);
            try {
              await api.post("/api/admin/allowed-origins", { origin, clientId: clientId || undefined });
              setOrigin("");
              load();
            } catch (err) {
              setError(err instanceof ApiClientError ? err.message : "Could not add origin.");
            }
          }}
        >
          <div className="form-field">
            <label>Origin URL</label>
            <input value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder="https://esaf-los.example.com" required />
          </div>
          <div className="form-field">
            <label>Client (optional)</label>
            <select value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">Any</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.code}</option>)}
            </select>
          </div>
          <button className="btn btn-primary" type="submit">Add Origin</button>
        </form>
      </div>
    </div>
  );
}
