import { useEffect, useState } from "react";
import { api } from "../../api/client";

interface Priority { id: string; name: string }
interface Project { id: string; name: string; client: { code: string } }
interface SlaRuleRow { id: string; projectId: string | null; priority: Priority; project: Project | null; responseMins: number; resolveMins: number }

export function Sla() {
  const [rules, setRules] = useState<SlaRuleRow[]>([]);
  const [priorities, setPriorities] = useState<Priority[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [priorityId, setPriorityId] = useState("");
  const [responseMins, setResponseMins] = useState(60);
  const [resolveMins, setResolveMins] = useState(480);

  const load = () => api.get<SlaRuleRow[]>("/api/admin/sla").then(setRules);
  useEffect(() => {
    load();
    api.get<Priority[]>("/api/admin/config/priorities").then(setPriorities);
    api.get<Project[]>("/api/admin/projects").then(setProjects);
  }, []);

  return (
    <div>
      <h2>SLA Rules</h2>
      <p style={{ color: "var(--text-muted)" }}>Rules with no project apply as the default across all projects unless a project-specific override exists.</p>

      <div className="card" style={{ padding: 0, marginBottom: 20 }}>
        <table>
          <thead><tr><th>Project</th><th>Priority</th><th>Response (mins)</th><th>Resolve (mins)</th></tr></thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.id}>
                <td>{r.project ? `${r.project.client.code} — ${r.project.name}` : "Default (all projects)"}</td>
                <td>{r.priority.name}</td>
                <td>{r.responseMins}</td>
                <td>{r.resolveMins}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card" style={{ maxWidth: 480 }}>
        <h3 style={{ marginTop: 0 }}>Set / Override SLA</h3>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            api.post("/api/admin/sla", { projectId: projectId || null, priorityId, responseMins: Number(responseMins), resolveMins: Number(resolveMins) }).then(load);
          }}
        >
          <div className="form-field">
            <label>Project (leave blank for default)</label>
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">Default (all projects)</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.client.code} — {p.name}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label>Priority</label>
            <select value={priorityId} onChange={(e) => setPriorityId(e.target.value)} required>
              <option value="">Select priority</option>
              {priorities.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="form-grid">
            <div className="form-field">
              <label>Response Time (minutes)</label>
              <input type="number" value={responseMins} onChange={(e) => setResponseMins(Number(e.target.value))} required />
            </div>
            <div className="form-field">
              <label>Resolution Time (minutes)</label>
              <input type="number" value={resolveMins} onChange={(e) => setResolveMins(Number(e.target.value))} required />
            </div>
          </div>
          <button className="btn btn-primary" type="submit">Save Rule</button>
        </form>
      </div>
    </div>
  );
}
