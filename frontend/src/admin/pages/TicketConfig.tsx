import { useEffect, useState } from "react";
import { api } from "../../api/client";

interface ConfigItem { id: string; name: string; active: boolean; sortOrder: number }

function ConfigSection({ path, label }: { path: "ticket-types" | "modules" | "priorities"; label: string }) {
  const [items, setItems] = useState<ConfigItem[]>([]);
  const [name, setName] = useState("");

  const load = () => api.get<ConfigItem[]>(`/api/admin/config/${path}`).then(setItems);
  useEffect(() => { load(); }, []);

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>{label}</h3>
      <table>
        <thead><tr><th>Name</th><th>Active</th><th></th></tr></thead>
        <tbody>
          {items.map((i) => (
            <tr key={i.id}>
              <td>{i.name}</td>
              <td>{i.active ? "Yes" : "No"}</td>
              <td>
                <button className="btn" onClick={() => api.put(`/api/admin/config/${path}/${i.id}`, { active: !i.active }).then(load)}>
                  {i.active ? "Disable" : "Enable"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <form
        style={{ display: "flex", gap: 8, marginTop: 10 }}
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          api.post(`/api/admin/config/${path}`, { name, sortOrder: items.length }).then(() => { setName(""); load(); });
        }}
      >
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={`New ${label.toLowerCase().replace(/s$/, "")}`} />
        <button className="btn btn-primary" type="submit">Add</button>
      </form>
    </div>
  );
}

export function TicketConfig() {
  return (
    <div>
      <h2>Ticket Types / Modules / Priorities</h2>
      <p style={{ color: "var(--text-muted)" }}>These lists drive the Create Ticket form. Nothing here is hardcoded in the app.</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
        <ConfigSection path="ticket-types" label="Ticket Types" />
        <ConfigSection path="modules" label="Modules" />
        <ConfigSection path="priorities" label="Priorities" />
      </div>
    </div>
  );
}
