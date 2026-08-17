export const PERMISSIONS = {
  TICKET_VIEW: "TICKET_VIEW",
  TICKET_CREATE: "TICKET_CREATE",
  TICKET_EDIT: "TICKET_EDIT",
  TICKET_COMMENT: "TICKET_COMMENT",
  TICKET_ATTACHMENT: "TICKET_ATTACHMENT",
  TICKET_ASSIGN: "TICKET_ASSIGN",
  TICKET_REASSIGN: "TICKET_REASSIGN",
  TICKET_STATUS_CHANGE: "TICKET_STATUS_CHANGE",
  TICKET_PRIORITY_CHANGE: "TICKET_PRIORITY_CHANGE",
  TICKET_CLOSE: "TICKET_CLOSE",
  VIEW_ALL_PROJECT_TICKETS: "VIEW_ALL_PROJECT_TICKETS",
  REPORTS_VIEW: "REPORTS_VIEW",
} as const;

export type Permission = keyof typeof PERMISSIONS;

// Server-side role -> default permission resolution. The LOS may *hint* a role in the
// launch token, but the actual permission set granted is always this trusted mapping
// (or an admin override stored per-user in user_permissions), never what the LOS sends.
export const ROLE_DEFAULT_PERMISSIONS: Record<string, Permission[]> = {
  LOS_USER: ["TICKET_VIEW", "TICKET_CREATE", "TICKET_COMMENT", "TICKET_ATTACHMENT"],
  LOS_SUPPORT: [
    "TICKET_VIEW",
    "TICKET_CREATE",
    "TICKET_EDIT",
    "TICKET_COMMENT",
    "TICKET_ATTACHMENT",
    "TICKET_ASSIGN",
    "TICKET_REASSIGN",
    "TICKET_STATUS_CHANGE",
    "TICKET_PRIORITY_CHANGE",
    "VIEW_ALL_PROJECT_TICKETS",
    "REPORTS_VIEW",
  ],
  INTERNAL_SUPPORT: [
    "TICKET_VIEW",
    "TICKET_CREATE",
    "TICKET_EDIT",
    "TICKET_COMMENT",
    "TICKET_ATTACHMENT",
    "TICKET_ASSIGN",
    "TICKET_REASSIGN",
    "TICKET_STATUS_CHANGE",
    "TICKET_PRIORITY_CHANGE",
    "TICKET_CLOSE",
    "VIEW_ALL_PROJECT_TICKETS",
    "REPORTS_VIEW",
  ],
};

export function defaultPermissionsForRole(role: string): Permission[] {
  return ROLE_DEFAULT_PERMISSIONS[role] ?? ROLE_DEFAULT_PERMISSIONS.LOS_USER;
}
