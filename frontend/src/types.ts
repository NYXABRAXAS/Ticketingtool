export interface MeResponse {
  user: { displayName: string; losUsername: string; email?: string; role: string; permissions: string[] };
  client: { code: string; name: string };
  project: { id: string; code: string; name: string };
}

export interface ProjectOption {
  id: string;
  code: string;
  name: string;
}

export interface TicketSummary {
  id: string;
  ticketNumber: string;
  redmineIssueId: number | null;
  subject: string;
  ticketType: string;
  module: string;
  priority: string;
  status: string;
  environment: string;
  applicationNumber?: string;
  loanNumber?: string;
  createdBy: { id: string; name: string } | null;
  assignedTo: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
  slaDueAt: string | null;
  slaState: "NONE" | "WITHIN_SLA" | "AT_RISK" | "BREACHED";
  syncStatus: "SYNCED" | "PENDING_SYNC" | "SYNC_FAILED";
}

export interface TicketDetail extends TicketSummary {
  description: string;
  comments: { id: string; body: string; author: string; source: string; createdAt: string }[];
  attachments: { id: string; fileName: string; fileSize: number; uploadedBy: string; createdAt: string; downloadUrl?: string }[];
  history: { id: string; action: string; fromValue?: string; toValue?: string; reason?: string; actor: string; createdAt: string }[];
}

export interface DashboardResponse {
  total: number;
  byStatus: { status: string; count: number }[];
  myOpenTickets: number;
  assignedToMe: number;
  recentlyCreated: { id: string; ticketNumber: string; subject: string; status: string; priority: string }[];
  recentlyUpdated: { id: string; ticketNumber: string; subject: string; status: string; priority: string }[];
  highPriorityOpen: number;
  slaBreached: number;
}
