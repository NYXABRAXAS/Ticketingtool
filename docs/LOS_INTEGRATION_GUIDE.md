# LOS Integration Guide

This is the exact procedure another LOS follows to integrate the Ticketing Tool, with no separate login for its users.

## 1. Register the LOS as a client

An internal ticketing administrator logs into `/admin` and, under **Clients**, creates a client (e.g. `ESAF`).

## 2. Configure the project

Under **Projects**, map the client to the Redmine project that will hold its issues (choose from the live Redmine project list). Give it a `code` (e.g. `ESAF-LOS`) — this is the value your LOS will send as `projectCode`.

## 3. Configure allowed assignees

Under **Assignee Mapping**, list the Redmine users who are allowed to be selected as "Assign To" for this project. Only these users will ever appear in the LOS user's assignment dropdown.

## 4. Issue an integration secret

Under **LOS Integration**, generate a secret for the client. It is shown **exactly once** — store it in your LOS backend's own configuration (a secret manager or environment variable), never in a repo or in client-side code.

## 5. Your LOS backend requests a launch token (server-to-server)

When a logged-in LOS user clicks "Ticketing Tool", your **backend** — using its own existing authenticated session for that user — calls:

```
POST https://<ticketing-tool-host>/api/integration/launch-token
X-Client-Code: ESAF
Authorization: Bearer <the integration secret from step 4>
Content-Type: application/json

{
  "losUserId": "501",
  "losUsername": "rajesh",
  "displayName": "Rajesh Kumar",
  "email": "rajesh@esaf.example.com",
  "projectCode": "ESAF-LOS",
  "role": "LOS_USER",
  "losContext": { "environment": "UAT", "module": "Credit", "applicationNumber": "APP-10293" }
}
```

Response:

```json
{ "launchUrl": "https://ticketing.example.com/launch?token=eyJhbGciOi..." }
```

The token is short-lived (5 minutes by default), signed, single-use, and scoped to exactly this user/client/project. `role` is only a *hint* — actual permissions are always resolved from the Ticketing Tool's own `user_permissions` table, never trusted from the request body.

## 6. Open the launch URL

Your frontend opens `launchUrl` — in a new tab, or in an `<iframe>` if you've added your origin to **Allowed Origins** in the admin panel:

```html
<button onclick="openTicketingTool()">Ticketing Tool</button>
<script>
async function openTicketingTool() {
  const res = await fetch("/your-los-backend/ticketing-launch-token", { credentials: "include" });
  const { launchUrl } = await res.json();
  window.open(launchUrl, "_blank"); // or set an <iframe src>
}
</script>
```

(`/your-los-backend/ticketing-launch-token` is a thin endpoint on **your own** backend that calls step 5 with your integration secret — the secret must never reach the browser.)

## 7. What the user sees

No login page, no client/project picker (unless they're authorized for more than one project, in which case a small dropdown appears). The Ticketing Tool validates the token once, establishes its own session cookie, and opens directly on the ticket dashboard for that client/project.

## 8. Test it

1. Confirm the launch opens the dashboard with zero prompts.
2. Confirm the user only ever sees tickets for their own client/project.
3. Create a ticket, attach a screenshot, assign it to one of the configured assignees, and confirm a corresponding Redmine issue is created.
4. Update the issue in Redmine directly (status, comment) and confirm it appears in the Ticketing Tool within one sync cycle (or immediately if you've configured a Redmine webhook — see below).

## Optional: real-time sync via Redmine webhook

If your Redmine instance supports outgoing webhooks (via a plugin), point it at:

```
POST https://<ticketing-tool-host>/api/webhooks/redmine
```

Set `REDMINE_WEBHOOK_SECRET` on the backend and configure the same value on the webhook sender so payloads are HMAC-verified (`X-Redmine-Signature` / `X-Hub-Signature-256` header). Without a webhook, the backend still polls Redmine for changes every `SYNC_POLL_INTERVAL_MS` (default 60s).

## React / Angular integration notes

The pattern is identical regardless of frontend framework — only your own backend calls step 5 (it holds the secret); your frontend only ever receives and opens `launchUrl`:

```javascript
// React
async function openTicketingTool() {
  const { launchUrl } = await fetch("/api/ticketing-launch-token", { credentials: "include" }).then(r => r.json());
  window.location.assign(launchUrl);
}
```

```typescript
// Angular
async openTicketingTool(): Promise<void> {
  const { launchUrl } = await this.http.get<{ launchUrl: string }>('/api/ticketing-launch-token').toPromise();
  window.location.assign(launchUrl);
}
```
