import { useEffect, useState } from "react";
import { api } from "../../api/client";

interface Client { id: string; code: string; name: string }
interface Secret { id: string; client: string; label: string; active: boolean; createdAt: string; lastUsedAt: string | null }

export function Integration() {
  const [clients, setClients] = useState<Client[]>([]);
  const [secrets, setSecrets] = useState<Secret[]>([]);
  const [clientId, setClientId] = useState("");
  const [label, setLabel] = useState("");
  const [justCreated, setJustCreated] = useState<{ secret: string; warning: string } | null>(null);

  const load = () => api.get<Secret[]>("/api/admin/integration-secrets").then(setSecrets);
  useEffect(() => { api.get<Client[]>("/api/admin/clients").then((c) => { setClients(c); if (c[0]) setClientId(c[0].id); }); load(); }, []);

  return (
    <div>
      <h2>LOS Integration</h2>
      <p style={{ color: "var(--text-muted)", maxWidth: 700 }}>
        Each LOS backend authenticates its server-to-server call to <code>POST /api/integration/launch-token</code> with a
        per-client secret, sent as <code>Authorization: Bearer &lt;secret&gt;</code> plus an <code>X-Client-Code</code> header.
        Store the secret in the LOS backend's own configuration - it is shown here exactly once.
      </p>

      {justCreated && (
        <div className="card" style={{ borderColor: "var(--danger)", marginBottom: 16 }}>
          <strong>New integration secret (copy it now — it will not be shown again):</strong>
          <pre style={{ background: "#f4f6f9", padding: 10, borderRadius: 6, overflowX: "auto" }}>{justCreated.secret}</pre>
          <p style={{ color: "var(--text-muted)", fontSize: 12.5 }}>{justCreated.warning}</p>
        </div>
      )}

      <div className="card" style={{ padding: 0, marginBottom: 20 }}>
        <table>
          <thead><tr><th>Client</th><th>Label</th><th>Active</th><th>Last Used</th><th></th></tr></thead>
          <tbody>
            {secrets.map((s) => (
              <tr key={s.id}>
                <td>{s.client}</td>
                <td>{s.label}</td>
                <td>{s.active ? "Yes" : "No"}</td>
                <td>{s.lastUsedAt ? new Date(s.lastUsedAt).toLocaleString() : "Never"}</td>
                <td>{s.active && <button className="btn" onClick={() => api.put(`/api/admin/integration-secrets/${s.id}/revoke`).then(load)}>Revoke</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {secrets.length === 0 && <div className="empty-state">No integration secrets yet.</div>}
      </div>

      <div className="card" style={{ maxWidth: 420 }}>
        <h3 style={{ marginTop: 0 }}>Issue New Secret</h3>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const result = await api.post<{ secret: string; warning: string }>("/api/admin/integration-secrets", { clientId, label });
            setJustCreated(result);
            setLabel("");
            load();
          }}
        >
          <div className="form-field">
            <label>Client</label>
            <select value={clientId} onChange={(e) => setClientId(e.target.value)} required>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label>Label (e.g. "Production LOS backend")</label>
            <input value={label} onChange={(e) => setLabel(e.target.value)} required />
          </div>
          <button className="btn btn-primary" type="submit">Generate Secret</button>
        </form>
      </div>
    </div>
  );
}
