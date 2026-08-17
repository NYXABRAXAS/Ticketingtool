# UAT Test Plan

Mirrors the end-to-end acceptance scenario from the project spec. Check each box during UAT sign-off.

## Setup

- [ ] 1. Create `ESAF` client (Admin → Clients)
- [ ] 2. Map ESAF to its Redmine project (Admin → Projects)
- [ ] 3. Issue an integration secret for ESAF (Admin → LOS Integration)
- [ ] 4. Add `Mayank` as an authorized assignee for the ESAF project (Admin → Assignee Mapping)

## Launch flow

- [ ] 5. Call `POST /api/integration/launch-token` as if from the ESAF LOS backend for user `rajesh`; confirm a `launchUrl` is returned
- [ ] 6. Open `launchUrl` in a browser
- [ ] 7. Confirm **no Ticketing Tool login screen** appears
- [ ] 8. Confirm **no Redmine login screen** appears at any point
- [ ] 9. Confirm the dashboard opens directly, titled with the ESAF project name
- [ ] 10. Confirm Rajesh's user mapping now appears under Admin → User Mapping with role `LOS_USER`

## Ticket creation

- [ ] 11. Click **Create Ticket**
- [ ] 12. Select type `Bug`, module `Credit`, priority `High`
- [ ] 13. Enter a subject and description
- [ ] 14. Upload a screenshot (PNG/JPG)
- [ ] 15. Select `Mayank` as assignee
- [ ] 16. Submit — confirm a `TKT-<year>-NNNNNN` ticket number is generated
- [ ] 17. Confirm a corresponding Redmine issue is created (check the ticket detail page shows a `Redmine #` reference within a few seconds, or check `syncStatus` reaches `SYNCED`)

## Collaboration

- [ ] 18. As Mayank (a second launch, or directly in Redmine), change the issue status
- [ ] 19. Add a comment in Redmine
- [ ] 20. Confirm both changes appear in the Ticketing Tool (immediately via webhook, or within one poll cycle — default 60s)
- [ ] 21. As Rajesh, add a comment in the Ticketing Tool
- [ ] 22. Confirm the comment appears as a note on the Redmine issue
- [ ] 23. Resolve, then close the ticket (as an authorized user) — confirm status badges update and `closedAt`/`resolvedAt` are set

## Isolation checks

- [ ] 24. Confirm Rajesh's ticket list never contains a ticket from another client (create a second client + ticket to compare)
- [ ] 25. Attempt to open another tenant's ticket by editing the URL's ticket ID — confirm a 404 / "not found", not the other tenant's data
- [ ] 26. Confirm "Assign To" only lists assignees explicitly mapped to the ESAF project

## Audit & history

- [ ] 27. Open the ticket's **Activity** tab — confirm create/assign/status/comment events are all present with timestamps and actors
- [ ] 28. Open Admin → Audit Logs — confirm `LAUNCH_TOKEN_ISSUED`, `LAUNCH`, and the ticket actions are recorded

## Security spot-checks

- [ ] 29. Inspect browser Network tab / JS bundle — confirm `REDMINE_API_KEY` never appears anywhere
- [ ] 30. Re-open the same `launchUrl` a second time — confirm it is rejected (`TOKEN_REPLAYED`)
- [ ] 31. Wait past the launch token's expiry (default 5 minutes) and try it — confirm rejection (`TOKEN_INVALID`)
- [ ] 32. Call `/api/admin/clients` without an admin session — confirm 401
