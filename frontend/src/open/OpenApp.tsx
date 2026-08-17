import { useEffect, useState } from "react";
import { openApi, OpenIssue, RedmineProjectOption } from "./openApi";
import { CreateIssue } from "./CreateIssue";
import { IssueDetail } from "./IssueDetail";

type View = { mode: "list" } | { mode: "create" } | { mode: "detail"; id: number };

export function OpenApp() {
  const [projects, setProjects] = useState<RedmineProjectOption[]>([]);
  const [projectId, setProjectId] = useState<number | null>(null);
  const [issues, setIssues] = useState<OpenIssue[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>({ mode: "list" });

  useEffect(() => {
    openApi
      .getProjects()
      .then((p) => {
        setProjects(p);
        if (p[0]) setProjectId(p[0].id);
      })
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    openApi
      .getIssues(projectId)
      .then(setIssues)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [projectId, view.mode]);

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ marginBottom: 4 }}>Ticketing Tool</h1>
          <p style={{ color: "var(--text-muted)", margin: 0 }}>Direct Redmine access — no login required.</p>
        </div>
        {view.mode !== "create" && (
          <button className="btn btn-primary" disabled={!projectId} onClick={() => setView({ mode: "create" })}>
            + Create Issue
          </button>
        )}
      </div>

      {error && <div className="error-banner">{error}</div>}

      {view.mode === "list" && (
        <>
          <div className="form-field" style={{ maxWidth: 320, marginBottom: 20 }}>
            <label>Project</label>
            <select value={projectId ?? ""} onChange={(e) => setProjectId(Number(e.target.value))}>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          {loading ? (
            <div className="empty-state">Loading…</div>
          ) : issues.length === 0 ? (
            <div className="empty-state">No issues in this project yet.</div>
          ) : (
            <div className="card" style={{ padding: 0, overflowX: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Subject</th>
                    <th>Tracker</th>
                    <th>Status</th>
                    <th>Priority</th>
                    <th>Assigned To</th>
                    <th>Updated</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {issues.map((issue) => (
                    <tr key={issue.id} style={{ cursor: "pointer" }} onClick={() => setView({ mode: "detail", id: issue.id })}>
                      <td>#{issue.id}</td>
                      <td style={{ maxWidth: 320, whiteSpace: "normal" }}>{issue.subject}</td>
                      <td>{issue.tracker.name}</td>
                      <td><span className="badge badge-open">{issue.status.name}</span></td>
                      <td><span className="badge badge-medium">{issue.priority.name}</span></td>
                      <td>{issue.assignedTo?.name ?? "Unassigned"}</td>
                      <td>{new Date(issue.updatedOn).toLocaleDateString()}</td>
                      <td><button className="btn">View</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {view.mode === "create" && projectId && (
        <CreateIssue projectId={projectId} onCreated={(id) => setView({ mode: "detail", id })} onCancel={() => setView({ mode: "list" })} />
      )}

      {view.mode === "detail" && <IssueDetail issueId={view.id} onBack={() => setView({ mode: "list" })} />}
    </div>
  );
}
