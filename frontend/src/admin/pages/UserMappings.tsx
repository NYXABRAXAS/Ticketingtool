import { useEffect, useState } from "react";
import { api } from "../../api/client";

interface Mapping {
  id: string;
  losUserId: string;
  losUsername: string;
  displayName: string;
  email?: string;
  role: string;
  active: boolean;
  client: string;
  project: string;
  redmineUserId: number | null;
  permissions: string[];
}

const ROLES = ["LOS_USER", "LOS_SUPPORT", "INTERNAL_SUPPORT", "INTERNAL_ADMIN"];

export function UserMappings() {
  const [rows, setRows] = useState<Mapping[]>([]);

  const load = () => api.get<Mapping[]>("/api/admin/user-mappings").then(setRows);
  useEffect(() => { load(); }, []);

  return (
    <div>
      <h2>User Mapping</h2>
      <p style={{ color: "var(--text-muted)" }}>
        LOS User → Ticketing identity → Redmine user. Rows are created automatically the first time a user launches from their LOS; role and permissions are always resolved here, never trusted from the LOS.
      </p>
      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead><tr><th>Client</th><th>Project</th><th>LOS User</th><th>Display Name</th><th>Role</th><th>Redmine User ID</th><th>Active</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.client}</td>
                <td>{r.project}</td>
                <td>{r.losUsername} ({r.losUserId})</td>
                <td>{r.displayName}</td>
                <td>
                  <select value={r.role} onChange={(e) => api.put(`/api/admin/user-mappings/${r.id}`, { role: e.target.value }).then(load)}>
                    {ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
                  </select>
                </td>
                <td>
                  <input
                    type="number"
                    defaultValue={r.redmineUserId ?? ""}
                    style={{ width: 80 }}
                    onBlur={(e) => {
                      const value = e.target.value ? Number(e.target.value) : null;
                      if (value !== r.redmineUserId) api.put(`/api/admin/user-mappings/${r.id}`, { redmineUserId: value }).then(load);
                    }}
                  />
                </td>
                <td>
                  <button className="btn" onClick={() => api.put(`/api/admin/user-mappings/${r.id}`, { active: !r.active }).then(load)}>
                    {r.active ? "Deactivate" : "Activate"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <div className="empty-state">No users have launched the Ticketing Tool yet.</div>}
      </div>
    </div>
  );
}
