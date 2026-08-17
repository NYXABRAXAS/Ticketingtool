# Security Model

## Trust boundaries

- **LOS ↔ Ticketing Tool backend**: server-to-server only, authenticated with a per-client bearer secret (bcrypt-hashed at rest, shown once at creation). Never called from a browser.
- **Browser ↔ Ticketing Tool backend**: authenticated with an `httpOnly`, `Secure` session cookie established by redeeming a launch token. The cookie is never readable by page JavaScript.
- **Ticketing Tool backend ↔ Redmine**: server-to-server only, using `X-Redmine-API-Key`. The key is read once from `process.env.REDMINE_API_KEY` in `src/services/redmineClient.ts` and is never returned in any API response or bundled into frontend code (frontend code never imports this file, and it lives in a package the frontend build never touches).

## Launch token design

- Signed JWT (`LAUNCH_TOKEN_SECRET`, HS256), 5-minute default expiry (`LAUNCH_TOKEN_TTL_SECONDS`).
- Contains only `losUserId`, `losUsername`, `displayName`, `email`, `clientCode`, `projectCode`, a `role` hint, optional non-sensitive `losContext`, and a random `nonce`.
- **Single use**: the `nonce` is recorded in `used_launch_nonces` the moment the token is redeemed; a second redemption attempt (replay) is rejected with `TOKEN_REPLAYED`, even if the token hasn't expired yet.
- **Permissions are never trusted from the token.** On first launch, a `los_user_mapping` row is created with permissions resolved from `ROLE_DEFAULT_PERMISSIONS` (server-side constant); an admin can subsequently override them per user. Every request re-reads permissions from the database, not from the JWT.

## Client / project isolation

Every ticket query in `ticketService.ts` filters by `clientId` **and** `projectId` taken from the verified session — never from a request parameter. `assertVisible()` returns a plain 404 (not 403) for a ticket belonging to another tenant, so probing ticket IDs across tenants cannot be used to distinguish "exists but forbidden" from "doesn't exist". Editing/assigning/commenting all route through the same scoped lookup, so tampering with a ticket ID in the URL cannot cross a tenant boundary.

## Assignment isolation

"Assign To" only ever lists Redmine users explicitly added to `assignee_mapping` for the caller's current project (`GET /api/config/assignees`). The full Redmine user directory is never exposed to the browser.

## CORS

`ALLOWED_ORIGINS` (env) plus the admin-managed `allowed_origins` table are the only origins granted `Access-Control-Allow-Origin` with credentials. Requests with no `Origin` header (server-to-server) bypass CORS entirely, as intended — CORS is a browser mechanism and irrelevant to backend-to-backend calls. `*` is never used for authenticated routes.

## File uploads

`src/utils/fileValidation.ts` enforces an allow-list of extensions/MIME types (png, jpg, jpeg, pdf, doc, docx, xls, xlsx, txt), rejects a denylist of executable/script extensions even if renamed, and enforces `MAX_UPLOAD_MB`. Uploaded bytes are streamed straight to Redmine's attachment API rather than persisted long-term on the backend's own disk.

## Secrets

Never committed: `REDMINE_API_KEY`, `TICKETING_JWT_SECRET`, `LAUNCH_TOKEN_SECRET`, integration secrets, `DATABASE_URL`, admin passwords. `.env.example` in both `backend/` and `frontend/` contain empty placeholders only. `render.yaml` uses `sync: false` / `generateValue: true` for every secret so Render prompts for them once in its dashboard rather than reading them from the blueprint file.

## Acceptance checks

| Scenario | Expected |
|---|---|
| ESAF user opens ESAF project | Allowed |
| ESAF user's session used to request a Muthoot ticket ID | 404 (isolation enforced server-side in `assertVisible`) |
| Expired launch token | 401 `TOKEN_INVALID` |
| Tampered launch token (signature mismatch) | 401 `TOKEN_INVALID` |
| Replayed launch token (same nonce twice) | 401 `TOKEN_REPLAYED` |
| User without `TICKET_ASSIGN` calls assign endpoint | 403 `FORBIDDEN` |
| User without `TICKET_CLOSE` sets status to Closed | 403 `FORBIDDEN` |
| Non-super-admin calls `/api/admin/clients` | 403 `FORBIDDEN` |
| Browser dev tools inspected for `REDMINE_API_KEY` | Never present in any response body, header, or JS bundle |
| Ticket ID edited in the URL to another tenant's UUID | 404, not the other tenant's data |
