import { useEffect, useState } from "react";
import { api, ApiClientError } from "../../api/client";

interface ClientRow { id: string; code: string; name: string }
interface ProjectRow { id: string; code: string; name: string; redmineProjectId: number; redmineProjectIdent: string; active: boolean; client: ClientRow }
interface RedmineProject { id: number; identifier: string; name: string }

export function Projects() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [redmineProjects, setRedmineProjects] = useState<RedmineProject[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [clientId, setClientId] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [redmineProjectId, setRedmineProjectId] = useState("");

  const load = () => api.get<ProjectRow[]>("/api/admin/projects").then(setProjects);

  useEffect(() => {
    api.get<ClientRow[]>("/api/admin/clients").then(setClients);
    api.get<RedmineProject[]>("/api/admin/projects/redmine-projects").then(setRedmineProjects).catch(() => setRedmineProjects([]));
    load();
  }, []);

  async function createProject(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const rp = redmineProjects.find((p) => String(p.id) === redmineProjectId);
      await api.post("/api/admin/projects", {
        clientId,
        code,
        name: name || rp?.name,
        redmineProjectId: Number(redmineProjectId),
        redmineProjectIdent: rp?.identifier ?? "",
      });
      setCode(""); setName(""); setRedmineProjectId("");
      load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not create project.");
    }
  }

  return (
    <div>
      <h2>Projects</h2>
      <p style={{ color: "var(--text-muted)" }}>Maps a client to a Redmine project. This mapping is what "Strict Project Isolation" is enforced against.</p>

      <div className="card" style={{ padding: 0, marginBottom: 20 }}>
        <table>
          <thead><tr><th>Client</th><th>Code</th><th>Name</th><th>Redmine Project</th><th>Active</th><th></th></tr></thead>
          <tbody>
            {projects.map((p) => (
              <tr key={p.id}>
                <td>{p.client.code}</td>
                <td>{p.code}</td>
                <td>{p.name}</td>
                <td>#{p.redmineProjectId} ({p.redmineProjectIdent})</td>
                <td>{p.active ? "Yes" : "No"}</td>
                <td>
                  <button className="btn" onClick={() => api.put(`/api/admin/projects/${p.id}`, { active: !p.active }).then(load)}>
                    {p.active ? "Deactivate" : "Activate"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {projects.length === 0 && <div className="empty-state">No projects yet.</div>}
      </div>

      <div className="card" style={{ maxWidth: 480 }}>
        <h3 style={{ marginTop: 0 }}>Add Project</h3>
        {error && <div className="error-banner">{error}</div>}
        <form onSubmit={createProject}>
          <div className="form-field">
            <label>Client</label>
            <select value={clientId} onChange={(e) => setClientId(e.target.value)} required>
              <option value="">Select client</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label>Project Code (used in launch tokens, e.g. ESAF-LOS)</label>
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} required />
          </div>
          <div className="form-field">
            <label>Redmine Project</label>
            <select value={redmineProjectId} onChange={(e) => setRedmineProjectId(e.target.value)} required>
              <option value="">Select Redmine project</option>
              {redmineProjects.map((rp) => <option key={rp.id} value={rp.id}>{rp.name} (#{rp.id})</option>)}
            </select>
          </div>
          <div className="form-field">
            <label>Display Name (optional, defaults to Redmine name)</label>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <button className="btn btn-primary" type="submit">Create Project</button>
        </form>
      </div>
    </div>
  );
}
