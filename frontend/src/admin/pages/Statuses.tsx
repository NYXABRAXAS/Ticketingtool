import { useEffect, useState } from "react";
import { api } from "../../api/client";

interface StatusItem { id: string; name: string; active: boolean; isClosed: boolean; redmineStatusId: number | null }
interface Transition { id: string; fromStatus: StatusItem; toStatus: StatusItem }

export function Statuses() {
  const [statuses, setStatuses] = useState<StatusItem[]>([]);
  const [transitions, setTransitions] = useState<Transition[]>([]);
  const [name, setName] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const loadStatuses = () => api.get<StatusItem[]>("/api/admin/config/statuses").then(setStatuses);
  const loadTransitions = () => api.get<Transition[]>("/api/admin/config/status-transitions").then(setTransitions);
  useEffect(() => { loadStatuses(); loadTransitions(); }, []);

  return (
    <div>
      <h2>Statuses & Workflow</h2>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Statuses</h3>
          <table>
            <thead><tr><th>Name</th><th>Closed?</th><th>Redmine Status ID</th><th>Active</th><th></th></tr></thead>
            <tbody>
              {statuses.map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td>{s.isClosed ? "Yes" : "No"}</td>
                  <td>
                    <input
                      type="number"
                      defaultValue={s.redmineStatusId ?? ""}
                      style={{ width: 70 }}
                      onBlur={(e) => api.put(`/api/admin/config/statuses/${s.id}`, { redmineStatusId: e.target.value ? Number(e.target.value) : undefined }).then(loadStatuses)}
                    />
                  </td>
                  <td>{s.active ? "Yes" : "No"}</td>
                  <td>
                    <button className="btn" onClick={() => api.put(`/api/admin/config/statuses/${s.id}`, { active: !s.active }).then(loadStatuses)}>
                      {s.active ? "Disable" : "Enable"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <form
            style={{ display: "flex", gap: 8, marginTop: 10 }}
            onSubmit={(e) => { e.preventDefault(); if (!name.trim()) return; api.post("/api/admin/config/statuses", { name, sortOrder: statuses.length }).then(() => { setName(""); loadStatuses(); }); }}
          >
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New status" />
            <button className="btn btn-primary" type="submit">Add</button>
          </form>
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>Allowed Transitions</h3>
          <table>
            <thead><tr><th>From</th><th>To</th><th></th></tr></thead>
            <tbody>
              {transitions.map((t) => (
                <tr key={t.id}>
                  <td>{t.fromStatus.name}</td>
                  <td>{t.toStatus.name}</td>
                  <td><button className="btn" onClick={() => api.del(`/api/admin/config/status-transitions/${t.id}`).then(loadTransitions)}>Remove</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <form
            style={{ display: "flex", gap: 8, marginTop: 10 }}
            onSubmit={(e) => { e.preventDefault(); if (!from || !to) return; api.post("/api/admin/config/status-transitions", { fromStatusId: from, toStatusId: to }).then(loadTransitions); }}
          >
            <select value={from} onChange={(e) => setFrom(e.target.value)}>
              <option value="">From</option>
              {statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select value={to} onChange={(e) => setTo(e.target.value)}>
              <option value="">To</option>
              {statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <button className="btn btn-primary" type="submit">Add</button>
          </form>
        </div>
      </div>
    </div>
  );
}
