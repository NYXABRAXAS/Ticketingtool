import { useEffect, useState } from "react";
import { openApi, RedmineOption, RedmineUserOption } from "./openApi";

export function CreateIssue({ projectId, onCreated, onCancel }: { projectId: number; onCreated: (id: number) => void; onCancel: () => void }) {
  const [trackers, setTrackers] = useState<RedmineOption[]>([]);
  const [priorities, setPriorities] = useState<RedmineOption[]>([]);
  const [users, setUsers] = useState<RedmineUserOption[]>([]);

  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [trackerId, setTrackerId] = useState<string>("");
  const [priorityId, setPriorityId] = useState<string>("");
  const [assignedToId, setAssignedToId] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    openApi.getTrackers().then(setTrackers).catch(() => undefined);
    openApi.getPriorities().then(setPriorities).catch(() => undefined);
    openApi.getUsers().then(setUsers).catch(() => undefined);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const { id } = await openApi.createIssue({
        projectId,
        subject,
        description,
        trackerId: trackerId ? Number(trackerId) : undefined,
        priorityId: priorityId ? Number(priorityId) : undefined,
        assignedToId: assignedToId ? Number(assignedToId) : undefined,
      });
      if (file) {
        const form = new FormData();
        form.append("file", file);
        await openApi.uploadAttachment(id, form).catch(() => undefined);
      }
      onCreated(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create issue.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card" style={{ maxWidth: 640 }}>
      <h3 style={{ marginTop: 0 }}>Create Issue</h3>
      {error && <div className="error-banner">{error}</div>}
      <form onSubmit={submit}>
        <div className="form-grid">
          <div className="form-field">
            <label>Tracker</label>
            <select value={trackerId} onChange={(e) => setTrackerId(e.target.value)}>
              <option value="">Default</option>
              {trackers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label>Priority</label>
            <select value={priorityId} onChange={(e) => setPriorityId(e.target.value)}>
              <option value="">Default</option>
              {priorities.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </div>

        <div className="form-field">
          <label>Subject</label>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} required maxLength={255} />
        </div>
        <div className="form-field">
          <label>Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="form-field">
          <label>Assign To</label>
          <select value={assignedToId} onChange={(e) => setAssignedToId(e.target.value)}>
            <option value="">Unassigned</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.firstname} {u.lastname}</option>)}
          </select>
        </div>
        <div className="form-field">
          <label>Attachment (optional)</label>
          <input type="file" accept=".png,.jpg,.jpeg,.pdf,.doc,.docx,.xls,.xlsx,.txt" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-primary" type="submit" disabled={submitting}>{submitting ? "Creating…" : "Create Issue"}</button>
          <button className="btn" type="button" onClick={onCancel}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
