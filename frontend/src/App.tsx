import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Layout } from "./components/Layout";
import { Launch } from "./pages/Launch";
import { LaunchError } from "./pages/LaunchError";
import { Dashboard } from "./pages/Dashboard";
import { TicketListPage } from "./pages/TicketListPage";
import { CreateTicket } from "./pages/CreateTicket";
import { TicketDetails } from "./pages/TicketDetails";
import { Reports } from "./pages/Reports";
import { AdminApp } from "./admin/AdminApp";
import { OpenApp } from "./open/OpenApp";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/admin/*" element={<AdminApp />} />
        <Route path="/open" element={<OpenApp />} />

        <Route
          path="/*"
          element={
            <AuthProvider>
              <Routes>
                <Route path="/launch" element={<Launch />} />
                <Route path="/launch-error" element={<LaunchError />} />
                <Route
                  path="/*"
                  element={
                    <ProtectedRoute>
                      <Layout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<Dashboard />} />
                  <Route path="dashboard" element={<Dashboard />} />
                  <Route path="tickets" element={<TicketListPage title="All Tickets" endpoint="/api/tickets" />} />
                  <Route path="tickets/mine" element={<TicketListPage title="My Tickets" endpoint="/api/tickets/mine" showFilters={false} />} />
                  <Route path="tickets/assigned-to-me" element={<TicketListPage title="Assigned to Me" endpoint="/api/tickets/assigned-to-me" showFilters={false} />} />
                  <Route path="tickets/new" element={<CreateTicket />} />
                  <Route path="tickets/:id" element={<TicketDetails />} />
                  <Route path="reports" element={<Reports />} />
                </Route>
              </Routes>
            </AuthProvider>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
