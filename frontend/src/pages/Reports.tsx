import { useEffect, useState } from "react";
import { api } from "../api/client";

interface UserWiseRow { user: string; total: number; open: number; pending: number; resolved: number; closed: number }
interface AssigneeWiseRow { assignee: string; open: number; inProgress: number; pending: number; resolved: number }
interface ModuleRow { module: string; count: number }

export function Reports() {
  const [tab, setTab] = useState<"user" | "assignee" | "module">("user");
  const [userRows, setUserRows] = useState<UserWiseRow[]>([]);
  const [assigneeRows, setAssigneeRows] = useState<AssigneeWiseRow[]>([]);
  const [moduleRows, setModuleRows] = useState<ModuleRow[]>([]);

  useEffect(() => {
    api.get<UserWiseRow[]>("/api/dashboard/user-wise").then(setUserRows).catch(() => undefined);
    api.get<AssigneeWiseRow[]>("/api/dashboard/assignee-wise").then(setAssigneeRows).catch(() => undefined);
    api.get<ModuleRow[]>("/api/dashboard/project-wise").then(setModuleRows).catch(() => undefined);
  }, []);

  return (
    <div>
      <h2>Reports</h2>
      <div className="tabs">
        <button className={tab === "user" ? "active" : ""} onClick={() => setTab("user")}>User-wise</button>
        <button className={tab === "assignee" ? "active" : ""} onClick={() => setTab("assignee")}>Assignee-wise</button>
        <button className={tab === "module" ? "active" : ""} onClick={() => setTab("module")}>Module-wise</button>
      </div>

      {tab === "user" && (
        <div className="card" style={{ padding: 0 }}>
          <table>
            <thead><tr><th>User</th><th>Total</th><th>Open</th><th>Pending</th><th>Resolved</th><th>Closed</th></tr></thead>
            <tbody>
              {userRows.map((r) => (
                <tr key={r.user}><td>{r.user}</td><td>{r.total}</td><td>{r.open}</td><td>{r.pending}</td><td>{r.resolved}</td><td>{r.closed}</td></tr>
              ))}
            </tbody>
          </table>
          {userRows.length === 0 && <div className="empty-state">No data yet.</div>}
        </div>
      )}

      {tab === "assignee" && (
        <div className="card" style={{ padding: 0 }}>
          <table>
            <thead><tr><th>Assignee</th><th>Open</th><th>In Progress</th><th>Pending</th><th>Resolved</th></tr></thead>
            <tbody>
              {assigneeRows.map((r) => (
                <tr key={r.assignee}><td>{r.assignee}</td><td>{r.open}</td><td>{r.inProgress}</td><td>{r.pending}</td><td>{r.resolved}</td></tr>
              ))}
            </tbody>
          </table>
          {assigneeRows.length === 0 && <div className="empty-state">No data yet.</div>}
        </div>
      )}

      {tab === "module" && (
        <div className="card" style={{ padding: 0 }}>
          <table>
            <thead><tr><th>Module</th><th>Ticket Count</th></tr></thead>
            <tbody>
              {moduleRows.map((r) => (
                <tr key={r.module}><td>{r.module}</td><td>{r.count}</td></tr>
              ))}
            </tbody>
          </table>
          {moduleRows.length === 0 && <div className="empty-state">No data yet.</div>}
        </div>
      )}
    </div>
  );
}
