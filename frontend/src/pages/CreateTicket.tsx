import { useEffect, useState, DragEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiClientError } from "../api/client";

interface ConfigOption { id: string; name: string }
interface Assignee { redmineUserId: number; displayName: string }

const ENVIRONMENTS = ["Development", "UAT", "Production"];

export function CreateTicket() {
  const navigate = useNavigate();
  const [types, setTypes] = useState<ConfigOption[]>([]);
  const [modules, setModules] = useState<ConfigOption[]>([]);
  const [priorities, setPriorities] = useState<ConfigOption[]>([]);
  const [assignees, setAssignees] = useState<Assignee[]>([]);

  const [ticketType, setTicketType] = useState("");
  const [module, setModule] = useState("");
  const [priority, setPriority] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [environment, setEnvironment] = useState("UAT");
  const [applicationNumber, setApplicationNumber] = useState("");
  const [loanNumber, setLoanNumber] = useState("");
  const [assignedTo, setAssignedTo] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<ConfigOption[]>("/api/config/ticket-types").then((r) => { setTypes(r); if (r[0]) setTicketType(r[0].name); });
    api.get<ConfigOption[]>("/api/config/modules").then(setModules);
    api.get<ConfigOption[]>("/api/config/priorities").then((r) => {
      setPriorities(r);
      const medium = r.find((p) => p.name === "Medium");
      if (medium) setPriority(medium.name);
      else if (r[0]) setPriority(r[0].name);
    });
    api.get<Assignee[]>("/api/config/assignees").then(setAssignees);
  }, []);

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (e.dataTransfer.files?.[0]) setFile(e.dataTransfer.files[0]);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const created = await api.post<{ id: string; ticketNumber: string }>("/api/tickets", {
        ticketType,
        module,
        priority,
        subject,
        description,
        environment,
        applicationNumber: applicationNumber || undefined,
        loanNumber: loanNumber || undefined,
        assignedToRedmineUserId: assignedTo ? Number(assignedTo) : undefined,
      });

      if (file) {
        const form = new FormData();
        form.append("file", file);
        await api.upload(`/api/tickets/${created.id}/attachments`, form).catch(() => undefined);
      }

      navigate(`/tickets/${created.id}`);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not create ticket.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h2>Create New Ticket</h2>
      {error && <div className="error-banner">{error}</div>}
      <form className="card" onSubmit={onSubmit} style={{ maxWidth: 760 }}>
        <div className="form-grid">
          <div className="form-field">
            <label>Ticket Type</label>
            <select value={ticketType} onChange={(e) => setTicketType(e.target.value)} required>
              {types.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label>Module</label>
            <select value={module} onChange={(e) => setModule(e.target.value)} required>
              <option value="">Select module</option>
              {modules.map((m) => <option key={m.id} value={m.name}>{m.name}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label>Priority</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value)} required>
              {priorities.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label>Environment</label>
            <select value={environment} onChange={(e) => setEnvironment(e.target.value)} required>
              {ENVIRONMENTS.map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
        </div>

        <div className="form-field">
          <label>Subject</label>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={255} required placeholder="Short summary of the issue" />
        </div>
        <div className="form-field">
          <label>Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} required placeholder="Steps to reproduce, expected vs actual behavior…" />
        </div>

        <div className="form-grid">
          <div className="form-field">
            <label>Application / Loan Number (optional)</label>
            <input value={applicationNumber} onChange={(e) => setApplicationNumber(e.target.value)} placeholder="Application number" />
          </div>
          <div className="form-field">
            <label>&nbsp;</label>
            <input value={loanNumber} onChange={(e) => setLoanNumber(e.target.value)} placeholder="Loan number" />
          </div>
        </div>

        <div className="form-field">
          <label>Assign To (optional)</label>
          <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
            <option value="">Unassigned</option>
            {assignees.map((a) => <option key={a.redmineUserId} value={a.redmineUserId}>{a.displayName}</option>)}
          </select>
        </div>

        <div className="form-field">
          <label>Attachment (screenshot, log, or document)</label>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
            style={{ border: "1px dashed var(--border)", borderRadius: 8, padding: 20, textAlign: "center", color: "var(--text-muted)" }}
          >
            {file ? (
              <span>{file.name} ({Math.round(file.size / 1024)} KB) <button type="button" className="btn" onClick={() => setFile(null)}>Remove</button></span>
            ) : (
              <span>
                Drag & drop a file here, or{" "}
                <label style={{ color: "var(--primary)", cursor: "pointer" }}>
                  browse
                  <input type="file" style={{ display: "none" }} accept=".png,.jpg,.jpeg,.pdf,.doc,.docx,.xls,.xlsx,.txt" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                </label>
              </span>
            )}
          </div>
        </div>

        <button className="btn btn-primary" type="submit" disabled={submitting}>
          {submitting ? "Creating…" : "Create Ticket"}
        </button>
      </form>
    </div>
  );
}
