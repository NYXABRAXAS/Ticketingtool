import { useEffect, useState } from "react";
import { api } from "../api/client";
import { TicketSummary } from "../types";
import { TicketTable } from "../components/TicketTable";

interface ConfigOption {
  id: string;
  name: string;
}

interface Props {
  title: string;
  endpoint: "/api/tickets" | "/api/tickets/mine" | "/api/tickets/assigned-to-me";
  showFilters?: boolean;
}

export function TicketListPage({ title, endpoint, showFilters = true }: Props) {
  const [items, setItems] = useState<TicketSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [statuses, setStatuses] = useState<ConfigOption[]>([]);
  const [priorities, setPriorities] = useState<ConfigOption[]>([]);

  const pageSize = 25;

  useEffect(() => {
    if (!showFilters) return;
    api.get<ConfigOption[]>("/api/config/statuses").then(setStatuses).catch(() => undefined);
    api.get<ConfigOption[]>("/api/config/priorities").then(setPriorities).catch(() => undefined);
  }, [showFilters]);

  useEffect(() => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (search) qs.set("search", search);
    if (status) qs.set("status", status);
    if (priority) qs.set("priority", priority);
    qs.set("page", String(page));
    qs.set("pageSize", String(pageSize));

    api
      .get<{ items: TicketSummary[]; total: number }>(`${endpoint}?${qs.toString()}`)
      .then((res) => {
        setItems(res.items);
        setTotal(res.total);
        setError(null);
      })
      .catch(() => setError("Could not load tickets."))
      .finally(() => setLoading(false));
  }, [endpoint, search, status, priority, page]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <h2>{title}</h2>
      {showFilters && (
        <div className="filters-bar">
          <input placeholder="Search ticket #, subject, application/loan number…" value={search} onChange={(e) => { setPage(1); setSearch(e.target.value); }} style={{ minWidth: 280 }} />
          <select value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }}>
            <option value="">All statuses</option>
            {statuses.map((s) => (
              <option key={s.id} value={s.name}>{s.name}</option>
            ))}
          </select>
          <select value={priority} onChange={(e) => { setPage(1); setPriority(e.target.value); }}>
            <option value="">All priorities</option>
            {priorities.map((p) => (
              <option key={p.id} value={p.name}>{p.name}</option>
            ))}
          </select>
        </div>
      )}

      {error && <div className="error-banner">{error}</div>}
      {loading ? <div className="empty-state">Loading…</div> : <TicketTable items={items} />}

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
