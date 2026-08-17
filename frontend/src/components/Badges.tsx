const STATUS_CLASS: Record<string, string> = {
  Open: "badge-open",
  Assigned: "badge-open",
  "In Progress": "badge-progress",
  "Pending Client": "badge-pending",
  "Pending Development": "badge-pending",
  Resolved: "badge-resolved",
  Reopened: "badge-progress",
  Closed: "badge-closed",
};

export function StatusBadge({ status }: { status: string }) {
  return <span className={`badge ${STATUS_CLASS[status] ?? "badge-open"}`}>{status}</span>;
}

const PRIORITY_CLASS: Record<string, string> = {
  Critical: "badge-critical",
  High: "badge-high",
  Medium: "badge-medium",
  Low: "badge-low",
};

export function PriorityBadge({ priority }: { priority: string }) {
  return <span className={`badge ${PRIORITY_CLASS[priority] ?? "badge-medium"}`}>{priority}</span>;
}

const SLA_LABEL: Record<string, string> = {
  NONE: "No SLA",
  WITHIN_SLA: "Within SLA",
  AT_RISK: "At Risk",
  BREACHED: "Breached",
};

const SLA_CLASS: Record<string, string> = {
  WITHIN_SLA: "badge-resolved",
  AT_RISK: "badge-high",
  BREACHED: "badge-breached",
  NONE: "badge-closed",
};

export function SlaBadge({ state }: { state: string }) {
  return <span className={`badge ${SLA_CLASS[state] ?? "badge-closed"}`}>{SLA_LABEL[state] ?? state}</span>;
}
