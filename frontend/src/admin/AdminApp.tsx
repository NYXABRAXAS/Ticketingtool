import { Routes, Route, Navigate } from "react-router-dom";
import { AdminAuthProvider, useAdminAuth } from "./AdminAuthContext";
import { AdminLogin } from "./AdminLogin";
import { AdminLayout } from "./AdminLayout";
import { Clients } from "./pages/Clients";
import { Projects } from "./pages/Projects";
import { UserMappings } from "./pages/UserMappings";
import { AssigneeMappings } from "./pages/AssigneeMappings";
import { TicketConfig } from "./pages/TicketConfig";
import { Statuses } from "./pages/Statuses";
import { Sla } from "./pages/Sla";
import { RedmineConfig } from "./pages/Redmine";
import { Integration } from "./pages/Integration";
import { Origins } from "./pages/Origins";
import { AuditLogs } from "./pages/AuditLogs";

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { loading, admin } = useAdminAuth();
  if (loading) return <div className="centered-screen">Loading…</div>;
  if (!admin) return <Navigate to="/admin/login" replace />;
  return <>{children}</>;
}

export function AdminApp() {
  return (
    <AdminAuthProvider>
      <Routes>
        <Route path="login" element={<AdminLogin />} />
        <Route
          path="/*"
          element={
            <RequireAdmin>
              <AdminLayout />
            </RequireAdmin>
          }
        >
          <Route index element={<Navigate to="clients" replace />} />
          <Route path="clients" element={<Clients />} />
          <Route path="projects" element={<Projects />} />
          <Route path="user-mappings" element={<UserMappings />} />
          <Route path="assignee-mappings" element={<AssigneeMappings />} />
          <Route path="ticket-config" element={<TicketConfig />} />
          <Route path="statuses" element={<Statuses />} />
          <Route path="sla" element={<Sla />} />
          <Route path="redmine" element={<RedmineConfig />} />
          <Route path="integration" element={<Integration />} />
          <Route path="origins" element={<Origins />} />
          <Route path="audit-logs" element={<AuditLogs />} />
        </Route>
      </Routes>
    </AdminAuthProvider>
  );
}
