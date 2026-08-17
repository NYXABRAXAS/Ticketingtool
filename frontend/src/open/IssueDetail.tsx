import { useCallback, useEffect, useState } from "react";
import { openApi, OpenIssue, RedmineOption } from "./openApi";

export function IssueDetail({ issueId, onBack }: { issueId: number; onBack: () => void }) {
  const [issue, setIssue] = useState<OpenIssue | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statuses, setStatuses] = useState<RedmineOption[]>([]);
  const [priorities, setPriorities] = useState<RedmineOption[]>([]);
  const [members, setMembers] = useState<RedmineOption[]>([]);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    openApi.getIssue(issueId).then(setIssue).catch((err) => setError(err.message));
  }, [issueId]);

  useEffect(() => {
    load();
    openApi.getStatuses().then(setStatuses).catch(() => undefined);
    openApi.getPriorities().then(setPriorities).catch(() => undefined);
  }, [load]);

  useEffect(() => {
    if (issue) openApi.getProjectMembers(issue.project.id).then(setMembers).catch(() => undefined);
  }, [issue?.project.id]);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  if (error && !issue) return <div className="error-banner">{error}</div>;
  if (!issue) return <div className="empty-state">Loading…</div>;

  return (
    <div>
      <button className="btn" onClick={onBack} style={{ marginBottom: 16 }}>← Back to issues</button>
      {error && <div className="error-banner">{error}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
        <div>
          <h2>#{issue.id} — {issue.subject}</h2>
          <div className="card" style={{ marginBottom: 16 }}>
            <p style={{ whiteSpace: "pre-wrap" }}>{issue.description || <em>No description</em>}</p>
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <h3 style={{ marginTop: 0 }}>Comments ({issue.comments.length})</h3>
            {issue.comments.map((c) => (
              <div key={c.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                <div style={{ fontWeight: 600 }}>{c.author} <span style={{ color: "var(--text-muted)", fontWeight: 400, fontSize: 12 }}>{new Date(c.createdOn).toLocaleString()}</span></div>
                <div style={{ whiteSpace: "pre-wrap" }}>{c.body}</div>
              </div>
            ))}
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add a comment…" style={{ width: "100%", marginTop: 10 }} />
            <button className="btn btn-primary" style={{ marginTop: 8 }} disabled={busy || !comment.trim()} onClick={() => run(async () => { await openApi.addComment(issue.id, comment); setComment(""); })}>
              Post Comment
            </button>
          </div>

          <div className="card">
            <h3 style={{ marginTop: 0 }}>Attachments ({issue.attachments.length})</h3>
            {issue.attachments.map((a) => (
              <div key={a.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
                <span>{a.fileName} ({Math.round(a.fileSize / 1024)} KB)</span>
                <a className="btn" href={a.downloadUrl} target="_blank" rel="noreferrer">Download</a>
              </div>
            ))}
            <input
              type="file"
              style={{ marginTop: 10 }}
              accept=".png,.jpg,.jpeg,.pdf,.doc,.docx,.xls,.xlsx,.txt"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const form = new FormData();
                form.append("file", f);
                run(() => openApi.uploadAttachment(issue.id, form));
              }}
            />
          </div>
        </div>

        <div className="card" style={{ height: "fit-content" }}>
          <h3 style={{ marginTop: 0 }}>Details</h3>
          <div className="form-field">
            <label>Project</label>
            <div>{issue.project.name}</div>
          </div>
          <div className="form-field">
            <label>Status</label>
            <select disabled={busy} value={issue.status.id} onChange={(e) => run(() => openApi.updateIssue(issue.id, { statusId: Number(e.target.value) }))}>
              {statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label>Priority</label>
            <select disabled={busy} value={issue.priority.id} onChange={(e) => run(() => openApi.updateIssue(issue.id, { priorityId: Number(e.target.value) }))}>
              {priorities.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label>Assigned To</label>
            <select disabled={busy} value={issue.assignedTo?.id ?? ""} onChange={(e) => run(() => openApi.updateIssue(issue.id, { assignedToId: e.target.value ? Number(e.target.value) : null }))}>
              <option value="">Unassigned</option>
              {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label>Created</label>
            <div>{new Date(issue.createdOn).toLocaleString()}</div>
          </div>
          <div className="form-field">
            <label>Updated</label>
            <div>{new Date(issue.updatedOn).toLocaleString()}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
