import { useEffect, useState } from "react";
import { api, ApiClientError } from "../../api/client";

interface ClientRow { id: string; code: string; name: string; active: boolean; projects: { id: string; name: string }[] }

export function Clients() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = () => api.get<ClientRow[]>("/api/admin/clients").then(setClients);
  useEffect(() => { load(); }, []);

  async function createClient(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post("/api/admin/clients", { code, name });
      setCode(""); setName("");
      load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not create client.");
    }
  }

  return (
    <div>
      <h2>Clients</h2>
      <p style={{ color: "var(--text-muted)" }}>Each client represents one LOS tenant (e.g. ESAF, Muthoot). A client can have multiple Redmine-backed projects.</p>

      <div className="card" style={{ padding: 0, marginBottom: 20 }}>
        <table>
          <thead><tr><th>Code</th><th>Name</th><th>Projects</th><th>Active</th><th></th></tr></thead>
          <tbody>
            {clients.map((c) => (
              <tr key={c.id}>
                <td>{c.code}</td>
                <td>{c.name}</td>
                <td>{c.projects.map((p) => p.name).join(", ") || "-"}</td>
                <td>{c.active ? "Yes" : "No"}</td>
                <td>
                  <button className="btn" onClick={() => api.put(`/api/admin/clients/${c.id}`, { active: !c.active }).then(load)}>
                    {c.active ? "Deactivate" : "Activate"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {clients.length === 0 && <div className="empty-state">No clients yet.</div>}
      </div>

      <div className="card" style={{ maxWidth: 420 }}>
        <h3 style={{ marginTop: 0 }}>Add Client</h3>
        {error && <div className="error-banner">{error}</div>}
        <form onSubmit={createClient}>
          <div className="form-field">
            <label>Code (e.g. ESAF)</label>
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} required />
          </div>
          <div className="form-field">
            <label>Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <button className="btn btn-primary" type="submit">Create Client</button>
        </form>
      </div>
    </div>
  );
}
