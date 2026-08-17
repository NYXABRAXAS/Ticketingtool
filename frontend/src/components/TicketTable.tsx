import { Link } from "react-router-dom";
import { TicketSummary } from "../types";
import { StatusBadge, PriorityBadge, SlaBadge } from "./Badges";

export function TicketTable({ items }: { items: TicketSummary[] }) {
  if (items.length === 0) {
    return <div className="empty-state">No tickets found.</div>;
  }

  return (
    <div className="card" style={{ padding: 0, overflowX: "auto" }}>
      <table>
        <thead>
          <tr>
            <th>Ticket ID</th>
            <th>Subject</th>
            <th>Type</th>
            <th>Module</th>
            <th>Priority</th>
            <th>Status</th>
            <th>Created By</th>
            <th>Assigned To</th>
            <th>Environment</th>
            <th>Created</th>
            <th>Updated</th>
            <th>SLA</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {items.map((t) => (
            <tr key={t.id}>
              <td>
                <Link to={`/tickets/${t.id}`}>{t.ticketNumber}</Link>
              </td>
              <td style={{ maxWidth: 260, whiteSpace: "normal" }}>{t.subject}</td>
              <td>{t.ticketType}</td>
              <td>{t.module}</td>
              <td>
                <PriorityBadge priority={t.priority} />
              </td>
              <td>
                <StatusBadge status={t.status} />
              </td>
              <td>{t.createdBy?.name ?? "-"}</td>
              <td>{t.assignedTo?.name ?? "Unassigned"}</td>
              <td>{t.environment}</td>
              <td>{new Date(t.createdAt).toLocaleDateString()}</td>
              <td>{new Date(t.updatedAt).toLocaleDateString()}</td>
              <td>
                <SlaBadge state={t.slaState} />
              </td>
              <td>
                <Link className="btn" to={`/tickets/${t.id}`}>
                  View
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
