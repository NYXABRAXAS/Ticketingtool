import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { ProjectSwitcher } from "./ProjectSwitcher";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/tickets", label: "All Tickets" },
  { to: "/tickets/mine", label: "My Tickets" },
  { to: "/tickets/assigned-to-me", label: "Assigned to Me" },
  { to: "/tickets/new", label: "+ Create Ticket" },
  { to: "/reports", label: "Reports" },
];

export function Layout() {
  const { me } = useAuth();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">Ticketing Tool</div>
        {me && (
          <div className="context">
            <div>{me.client.name}</div>
            <div style={{ fontWeight: 600, color: "var(--text)" }}>{me.project.name}</div>
            <ProjectSwitcher />
          </div>
        )}
        <nav>
          {NAV_ITEMS.map((item) => (
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
            <span style={{ color: "var(--text-muted)" }}>{me?.user.displayName}</span>
            <button
              className="btn"
              onClick={async () => {
                await api.post("/api/launch/logout");
                window.location.reload();
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
