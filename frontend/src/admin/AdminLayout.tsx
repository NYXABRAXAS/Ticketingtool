import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useAdminAuth } from "./AdminAuthContext";

const NAV = [
  { to: "/admin/clients", label: "Clients" },
  { to: "/admin/projects", label: "Projects" },
  { to: "/admin/user-mappings", label: "User Mapping" },
  { to: "/admin/assignee-mappings", label: "Assignee Mapping" },
  { to: "/admin/ticket-config", label: "Ticket Types / Modules" },
  { to: "/admin/statuses", label: "Statuses & Workflow" },
  { to: "/admin/sla", label: "SLA" },
  { to: "/admin/redmine", label: "Redmine Connection" },
  { to: "/admin/integration", label: "LOS Integration" },
  { to: "/admin/origins", label: "Allowed Origins" },
  { to: "/admin/audit-logs", label: "Audit Logs" },
];

export function AdminLayout() {
  const { admin } = useAdminAuth();
  const navigate = useNavigate();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">Ticketing Admin</div>
        <nav>
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? "active" : "")}>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="main-area">
        <header className="topbar">
          <div />
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ color: "var(--text-muted)" }}>{admin?.displayName} ({admin?.role})</span>
            <button
              className="btn"
              onClick={async () => {
                await api.post("/api/admin/auth/logout");
                navigate("/admin/login");
              }}
            >
              Sign out
            </button>
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
