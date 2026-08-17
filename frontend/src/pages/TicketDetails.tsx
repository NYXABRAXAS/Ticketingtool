import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { api, ApiClientError } from "../api/client";
import { TicketDetail } from "../types";
import { StatusBadge, PriorityBadge, SlaBadge } from "../components/Badges";
import { useAuth } from "../context/AuthContext";

interface ConfigOption { id: string; name: string }
interface Assignee { redmineUserId: number; displayName: string }

export function TicketDetails() {
  const { id } = useParams<{ id: string }>();
  const { hasPermission } = useAuth();
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"details" | "comments" | "attachments" | "history">("details");

  const [statuses, setStatuses] = useState<ConfigOption[]>([]);
  const [priorities, setPriorities] = useState<ConfigOption[]>([]);
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);

  const load = useCallback(() => {
    if (!id) return;
    api
      .get<TicketDetail>(`/api/tickets/${id}`)
      .then(setTicket)
      .catch((err) => setError(err instanceof ApiClientError ? err.message : "Could not load ticket."));
  }, [id]);

  useEffect(() => {
    load();
    api.get<ConfigOption[]>("/api/config/statuses").then(setStatuses);
    api.get<ConfigOption[]>("/api/config/priorities").then(setPriorities);
    api.get<Assignee[]>("/api/config/assignees").then(setAssignees);
  }, [load]);

  if (error) return <div className="error-banner">{error}</div>;
  if (!ticket) return <div className="empty-state">Loading…</div>;

  async function runAction(fn: () => Promise<unknown>) {
    setBusy(true);
    setActionError(null);
    try {
      await fn();
      load();
    } catch (err) {
      setActionError(err instanceof ApiClientError ? err.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <h2 style={{ marginBottom: 4 }}>{ticket.ticketNumber} — {ticket.subject}</h2>
          <div style={{ color: "var(--text-muted)" }}>
            {ticket.redmineIssueId ? `Redmine #${ticket.redmineIssueId}` : "Not yet synchronized to Redmine"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <StatusBadge status={ticket.status} />
          <PriorityBadge priority={ticket.priority} />
          <SlaBadge state={ticket.slaState} />
        </div>
      </div>

      {actionError && <div className="error-banner">{actionError}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
        <div>
          <div className="tabs">
            {(["details", "comments", "attachments", "history"] as const).map((t) => (
              <button key={t} className={tab === t ? "active" : ""} onClick={() => setTab(t)}>
                {t === "details" ? "Description" : t.charAt(0).toUpperCase() + t.slice(1)}
                {t === "comments" ? ` (${ticket.comments.length})` : t === "attachments" ? ` (${ticket.attachments.length})` : ""}
              </button>
            ))}
          </div>

          {tab === "details" && (
            <div className="card">
              {editMode ? (
                <EditTicketForm
                  ticket={ticket}
                  busy={busy}
                  onCancel={() => setEditMode(false)}
                  onSave={(fields) => runAction(async () => { await api.put(`/api/tickets/${id}`, fields); setEditMode(false); })}
                />
              ) : (
                <>
                  <p style={{ whiteSpace: "pre-wrap" }}>{ticket.description}</p>
                  {hasPermission("TICKET_EDIT") && (
                    <button className="btn" onClick={() => setEditMode(true)}>Edit Ticket</button>
                  )}
                </>
              )}
            </div>
          )}

          {tab === "comments" && (
            <div className="card">
              {ticket.comments.length === 0 && <div className="empty-state">No comments yet.</div>}
              {ticket.comments.map((c) => (
                <div key={c.id} style={{ padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                  <div style={{ fontWeight: 600 }}>{c.author} <span style={{ color: "var(--text-muted)", fontWeight: 400, fontSize: 12 }}>{new Date(c.createdAt).toLocaleString()} {c.source === "REDMINE" ? "· via Redmine" : ""}</span></div>
                  <div style={{ whiteSpace: "pre-wrap", marginTop: 4 }}>{c.body}</div>
                </div>
              ))}
              {hasPermission("TICKET_COMMENT") && (
                <div style={{ marginTop: 12 }}>
                  <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add a comment…" style={{ width: "100%" }} />
                  <button
                    className="btn btn-primary"
                    style={{ marginTop: 8 }}
                    disabled={busy || !comment.trim()}
                    onClick={() => runAction(async () => { await api.post(`/api/tickets/${id}/comments`, { body: comment }); setComment(""); })}
                  >
                    Post Comment
                  </button>
                </div>
              )}
            </div>
          )}

          {tab === "attachments" && (
            <div className="card">
              {ticket.attachments.length === 0 && <div className="empty-state">No attachments yet.</div>}
              {ticket.attachments.map((a) => (
                <div key={a.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                  <div>
                    <div>{a.fileName}</div>
                    <div style={{ color: "var(--text-muted)", fontSize: 12 }}>Uploaded by {a.uploadedBy} · {new Date(a.createdAt).toLocaleDateString()} · {Math.round(a.fileSize / 1024)} KB</div>
                  </div>
                  {a.downloadUrl && <a className="btn" href={a.downloadUrl} target="_blank" rel="noreferrer">Download</a>}
                </div>
              ))}
              {hasPermission("TICKET_ATTACHMENT") && (
                <div style={{ marginTop: 12 }}>
                  <input
                    type="file"
                    accept=".png,.jpg,.jpeg,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      const form = new FormData();
                      form.append("file", f);
                      runAction(() => api.upload(`/api/tickets/${id}/attachments`, form));
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {tab === "history" && (
            <div className="card">
              {ticket.history.map((h) => (
                <div key={h.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--border)", fontSize: 13 }}>
                  <span style={{ color: "var(--text-muted)" }}>{new Date(h.createdAt).toLocaleString()}</span>{" "}
                  <strong>{h.actor}</strong> {describeHistory(h)}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card" style={{ height: "fit-content" }}>
          <h3 style={{ marginTop: 0 }}>Ticket Info</h3>
          <InfoRow label="Type" value={ticket.ticketType} />
          <InfoRow label="Module" value={ticket.module} />
          <InfoRow label="Environment" value={ticket.environment} />
          <InfoRow label="Created By" value={ticket.createdBy?.name ?? "-"} />
          <InfoRow label="Assigned To" value={ticket.assignedTo?.name ?? "Unassigned"} />
          <InfoRow label="Application #" value={ticket.applicationNumber ?? "-"} />
          <InfoRow label="Loan #" value={ticket.loanNumber ?? "-"} />
          <InfoRow label="Created" value={new Date(ticket.createdAt).toLocaleString()} />
          <InfoRow label="Updated" value={new Date(ticket.updatedAt).toLocaleString()} />

          {hasPermission("TICKET_STATUS_CHANGE") && (
            <div className="form-field">
              <label>Change Status</label>
              <select
                value={ticket.status}
                disabled={busy}
                onChange={(e) => runAction(() => api.put(`/api/tickets/${id}/status`, { status: e.target.value }))}
              >
                {statuses.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
            </div>
          )}

          {hasPermission("TICKET_PRIORITY_CHANGE") && (
            <div className="form-field">
              <label>Change Priority</label>
              <select
                value={ticket.priority}
                disabled={busy}
                onChange={(e) => runAction(() => api.put(`/api/tickets/${id}/priority`, { priority: e.target.value }))}
              >
                {priorities.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
              </select>
            </div>
          )}

          {(hasPermission("TICKET_ASSIGN") || hasPermission("TICKET_REASSIGN")) && (
            <div className="form-field">
              <label>{ticket.assignedTo ? "Reassign To" : "Assign To"}</label>
              <select
                value=""
                disabled={busy}
                onChange={(e) => {
                  if (!e.target.value) return;
                  const endpoint = ticket.assignedTo ? "reassign" : "assign";
                  runAction(() => api.put(`/api/tickets/${id}/${endpoint}`, { redmineUserId: Number(e.target.value) }));
                }}
              >
                <option value="">Select assignee…</option>
                {assignees.map((a) => <option key={a.redmineUserId} value={a.redmineUserId}>{a.displayName}</option>)}
              </select>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EditTicketForm({
  ticket,
  busy,
  onSave,
  onCancel,
}: {
  ticket: TicketDetail;
  busy: boolean;
  onSave: (fields: { subject: string; description: string; environment: string; applicationNumber?: string; loanNumber?: string }) => void;
  onCancel: () => void;
}) {
  const [subject, setSubject] = useState(ticket.subject);
  const [description, setDescription] = useState(ticket.description);
  const [environment, setEnvironment] = useState(ticket.environment);
  const [applicationNumber, setApplicationNumber] = useState(ticket.applicationNumber ?? "");
  const [loanNumber, setLoanNumber] = useState(ticket.loanNumber ?? "");

  return (
    <div>
      <div className="form-field">
        <label>Subject</label>
        <input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={255} />
      </div>
      <div className="form-field">
        <label>Description</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="form-grid">
        <div className="form-field">
          <label>Environment</label>
          <select value={environment} onChange={(e) => setEnvironment(e.target.value)}>
            {["Development", "UAT", "Production"].map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>
        <div className="form-field">
          <label>Application Number</label>
          <input value={applicationNumber} onChange={(e) => setApplicationNumber(e.target.value)} />
        </div>
      </div>
      <div className="form-field">
        <label>Loan Number</label>
        <input value={loanNumber} onChange={(e) => setLoanNumber(e.target.value)} />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn btn-primary" disabled={busy} onClick={() => onSave({ subject, description, environment, applicationNumber: applicationNumber || undefined, loanNumber: loanNumber || undefined })}>
          Save Changes
        </button>
        <button className="btn" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border)", fontSize: 13 }}>
      <span style={{ color: "var(--text-muted)" }}>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function describeHistory(h: TicketDetail["history"][number]): string {
  switch (h.action) {
    case "CREATE": return `created the ticket`;
    case "ASSIGN": return `assigned it to ${h.toValue}`;
    case "REASSIGN": return `reassigned it to ${h.toValue}`;
    case "STATUS_CHANGE": return `changed status from ${h.fromValue ?? "-"} to ${h.toValue}`;
    case "PRIORITY_CHANGE": return `changed priority from ${h.fromValue ?? "-"} to ${h.toValue}`;
    case "COMMENT": return `added a comment`;
    case "ATTACHMENT": return `attached ${h.toValue}`;
    case "RESOLVE": return `marked it Resolved`;
    case "REOPEN": return `reopened the ticket`;
    case "CLOSE": return `closed the ticket`;
    case "EDIT": return `edited the ticket`;
    case "SYNC": return `synchronized with ${h.toValue}`;
    default: return h.action;
  }
}
