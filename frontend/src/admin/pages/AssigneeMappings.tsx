import { useEffect, useState } from "react";
import { api, ApiClientError } from "../../api/client";

interface ProjectRow { id: string; name: string; client: { code: string } }
interface AssigneeRow { id: string; redmineUserId: number; displayName: string; email?: string; active: boolean }

export function AssigneeMappings() {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [projectId, setProjectId] = useState("");
  const [assignees, setAssignees] = useState<AssigneeRow[]>([]);
  const [redmineUserId, setRedmineUserId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { api.get<ProjectRow[]>("/api/admin/projects").then((p) => { setProjects(p); if (p[0]) setProjectId(p[0].id); }); }, []);

  const load = (pid: string) => api.get<AssigneeRow[]>(`/api/admin/assignee-mappings?projectId=${pid}`).then(setAssignees);
  useEffect(() => { if (projectId) load(projectId); }, [projectId]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post("/api/admin/assignee-mappings", { projectId, redmineUserId: Number(redmineUserId), displayName });
      setRedmineUserId(""); setDisplayName("");
      load(projectId);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not add assignee.");
    }
  }

  return (
    <div>
      <h2>Assignee Mapping</h2>
      <p style={{ color: "var(--text-muted)" }}>Only users listed here for a project can be selected in "Assign To" - this is what keeps the full Redmine user directory from leaking to LOS users.</p>

      <div className="form-field" style={{ maxWidth: 320 }}>
        <label>Project</label>
        <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.client.code} — {p.name}</option>)}
        </select>
      </div>

      <div className="card" style={{ padding: 0, marginBottom: 20 }}>
        <table>
          <thead><tr><th>Redmine User ID</th><th>Display Name</th><th>Active</th><th></th></tr></thead>
          <tbody>
            {assignees.map((a) => (
              <tr key={a.id}>
                <td>{a.redmineUserId}</td>
                <td>{a.displayName}</td>
                <td>{a.active ? "Yes" : "No"}</td>
                <td>
                  <button className="btn" onClick={() => api.put(`/api/admin/assignee-mappings/${a.id}`, { active: !a.active }).then(() => load(projectId))}>
                    {a.active ? "Deactivate" : "Activate"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {assignees.length === 0 && <div className="empty-state">No assignees configured for this project.</div>}
      </div>

      <div className="card" style={{ maxWidth: 420 }}>
        <h3 style={{ marginTop: 0 }}>Add Assignee</h3>
        {error && <div className="error-banner">{error}</div>}
        <form onSubmit={add}>
          <div className="form-field">
            <label>Redmine User ID</label>
            <input type="number" value={redmineUserId} onChange={(e) => setRedmineUserId(e.target.value)} required />
          </div>
          <div className="form-field">
            <label>Display Name</label>
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
          </div>
          <button className="btn btn-primary" type="submit">Add Assignee</button>
        </form>
      </div>
    </div>
  );
}
