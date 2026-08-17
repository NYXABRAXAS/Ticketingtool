import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { DashboardResponse } from "../types";
import { useAuth } from "../context/AuthContext";
import { StatusBadge, PriorityBadge } from "../components/Badges";

export function Dashboard() {
  const { me } = useAuth();
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<DashboardResponse>("/api/dashboard")
      .then(setData)
      .catch(() => setError("Could not load dashboard."));
  }, []);

  if (error) return <div className="error-banner">{error}</div>;
  if (!data) return <div className="empty-state">Loading…</div>;

  const openCount = data.byStatus.find((s) => s.status === "Open")?.count ?? 0;
  const progressCount = data.byStatus.find((s) => s.status === "In Progress")?.count ?? 0;
  const resolvedCount = data.byStatus.find((s) => s.status === "Resolved")?.count ?? 0;
  const closedCount = data.byStatus.find((s) => s.status === "Closed")?.count ?? 0;
  const pendingCount = data.byStatus.filter((s) => s.status.startsWith("Pending")).reduce((sum, s) => sum + s.count, 0);

  return (
    <div>
      <h2>{me?.project.name} — Ticketing Dashboard</h2>

      <div className="stat-grid">
        <div className="stat-card"><div className="value">{data.total}</div><div className="label">Total Tickets</div></div>
        <div className="stat-card"><div className="value">{openCount}</div><div className="label">Open</div></div>
        <div className="stat-card"><div className="value">{progressCount}</div><div className="label">In Progress</div></div>
        <div className="stat-card"><div className="value">{pendingCount}</div><div className="label">Pending</div></div>
        <div className="stat-card"><div className="value">{resolvedCount}</div><div className="label">Resolved</div></div>
        <div className="stat-card"><div className="value">{closedCount}</div><div className="label">Closed</div></div>
      </div>

      <div className="stat-grid">
        <div className="stat-card"><div className="value">{data.myOpenTickets}</div><div className="label">My Open Tickets</div></div>
        <div className="stat-card"><div className="value">{data.assignedToMe}</div><div className="label">Assigned to Me</div></div>
        <div className="stat-card"><div className="value">{data.highPriorityOpen}</div><div className="label">High Priority</div></div>
        <div className="stat-card"><div className="value" style={{ color: data.slaBreached > 0 ? "var(--danger)" : undefined }}>{data.slaBreached}</div><div className="label">SLA Breached</div></div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div className="card">
          <h3>Recently Created</h3>
          <TicketMiniList items={data.recentlyCreated} />
        </div>
        <div className="card">
          <h3>Recently Updated</h3>
          <TicketMiniList items={data.recentlyUpdated} />
        </div>
      </div>
    </div>
  );
}

function TicketMiniList({ items }: { items: DashboardResponse["recentlyCreated"] }) {
  if (items.length === 0) return <div className="empty-state">Nothing yet.</div>;
  return (
    <div>
      {items.map((t) => (
        <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
          <Link to={`/tickets/${t.id}`}>{t.ticketNumber} — {t.subject}</Link>
          <div style={{ display: "flex", gap: 6 }}>
            <PriorityBadge priority={t.priority} />
            <StatusBadge status={t.status} />
          </div>
        </div>
      ))}
    </div>
  );
}
