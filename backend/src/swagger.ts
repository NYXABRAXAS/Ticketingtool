// Minimal hand-written OpenAPI description. Full request/response schemas for every
// endpoint are documented in docs/API.md; this powers the interactive /api/docs explorer.
export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "LOS Ticketing Tool API",
    version: "1.0.0",
    description: "Standalone, multi-tenant ticketing platform backed by Redmine. See docs/LOS_INTEGRATION_GUIDE.md for the launch-token flow.",
  },
  servers: [{ url: "/api" }],
  paths: {
    "/health": { get: { summary: "Health check", responses: { "200": { description: "OK" }, "503": { description: "Degraded" } } } },
    "/integration/launch-token": {
      post: {
        summary: "Server-to-server: mint a short-lived signed launch token for a LOS user",
        description: "Auth: X-Client-Code header + Authorization: Bearer <integration secret>. Called only from LOS backends, never from a browser.",
        responses: { "200": { description: "{ launchUrl }" }, "401": { description: "Unauthorized" } },
      },
    },
    "/launch/validate": { post: { summary: "Redeem a launch token and establish a browser session (single use)", responses: { "200": { description: "OK" }, "401": { description: "Invalid/expired/replayed token" } } } },
    "/me": { get: { summary: "Current LOS user, client, and project context", responses: { "200": { description: "OK" } } } },
    "/projects": { get: { summary: "Projects the current LOS user may switch between", responses: { "200": { description: "OK" } } } },
    "/tickets": { get: { summary: "List tickets (filters, search, pagination)" }, post: { summary: "Create ticket" } },
    "/tickets/{id}": { get: { summary: "Ticket detail" }, put: { summary: "Edit ticket" } },
    "/tickets/{id}/comments": { post: { summary: "Add comment" } },
    "/tickets/{id}/attachments": { post: { summary: "Upload attachment (multipart/form-data, field: file)" } },
    "/tickets/{id}/assign": { put: { summary: "Assign ticket" } },
    "/tickets/{id}/reassign": { put: { summary: "Reassign ticket" } },
    "/tickets/{id}/status": { put: { summary: "Change status" } },
    "/tickets/{id}/priority": { put: { summary: "Change priority" } },
    "/tickets/{id}/history": { get: { summary: "Ticket activity history" } },
    "/dashboard": { get: { summary: "Dashboard summary for current project" } },
    "/dashboard/user-wise": { get: { summary: "User-wise ticket report" } },
    "/dashboard/assignee-wise": { get: { summary: "Assignee-wise ticket report" } },
    "/dashboard/project-wise": { get: { summary: "Module-wise breakdown within current project" } },
    "/config/ticket-types": { get: { summary: "Active ticket types" } },
    "/config/modules": { get: { summary: "Active modules" } },
    "/config/priorities": { get: { summary: "Active priorities" } },
    "/config/statuses": { get: { summary: "Active statuses" } },
    "/config/assignees": { get: { summary: "Assignees authorized for the current project" } },
    "/webhooks/redmine": { post: { summary: "Redmine outgoing webhook receiver (HMAC signed)" } },
    "/admin/auth/login": { post: { summary: "Internal admin login (username/password)" } },
  },
};
