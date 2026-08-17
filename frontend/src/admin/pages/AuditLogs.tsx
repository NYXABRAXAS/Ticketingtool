import { useEffect, useState } from "react";
import { api } from "../../api/client";

interface LogRow { id: string; actor: string; action: string; entityType: string; entityId: string | null; result: string; ipAddress: string | null; createdAt: string }

export function AuditLogs() {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 50;

  useEffect(() => {
    api.get<{ items: LogRow[]; total: number }>(`/api/admin/audit-logs?page=${page}&pageSize=${pageSize}`).then((r) => { setRows(r.items); setTotal(r.total); });
  }, [page]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <h2>Audit Logs</h2>
      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Entity</th><th>Result</th><th>IP</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{new Date(r.createdAt).toLocaleString()}</td>
                <td>{r.actor}</td>
                <td>{r.action}</td>
                <td>{r.entityType}{r.entityId ? ` #${r.entityId.slice(0, 8)}` : ""}</td>
                <td style={{ color: r.result === "SUCCESS" ? "var(--success)" : "var(--danger)" }}>{r.result}</td>
                <td>{r.ipAddress ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <div className="empty-state">No audit events yet.</div>}
      </div>
      {totalPages > 1 && (
        <div className="pagination">
          <button className="btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
          <span>Page {page} of {totalPages}</span>
          <button className="btn" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      )}
    </div>
  );
}
