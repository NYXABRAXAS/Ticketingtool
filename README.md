# LOS Ticketing Tool

A standalone, multi-tenant ticketing platform for Loan Origination Systems (LOS), backed by Redmine as the workflow engine. LOS users never see a login screen and never touch Redmine directly — they click "Ticketing Tool" inside their LOS and land straight on their project's ticket dashboard.

```
LOS (already logged in) → secure signed launch token → Ticketing Tool (this app) → Redmine (server-to-server only)
```

## Repository layout

```
backend/    Node.js + TypeScript + Express + Prisma (Postgres) API
frontend/   React + TypeScript + Vite single-page app (LOS view + /admin view)
docs/       Integration guide, security notes, deployment guide, UAT plan
render.yaml Render Blueprint for both services + managed Postgres
```

## Core concepts

- **No second login.** Normal LOS users authenticate once, in the LOS. The LOS backend calls this tool's `POST /api/integration/launch-token` server-to-server, gets back a `launchUrl` containing a short-lived signed token, and opens it. See [docs/LOS_INTEGRATION_GUIDE.md](docs/LOS_INTEGRATION_GUIDE.md).
- **Client + project isolation is enforced server-side**, on every query, by the session's `clientId`/`projectId` — never by frontend filtering alone.
- **Redmine is invisible to LOS users.** The `REDMINE_API_KEY` only ever lives in backend environment variables and is never sent to the browser.
- **Internal ticketing administrators** are a completely separate, password-based login at `/admin/login` — unrelated to LOS user accounts.

## Local development

Requires Node 18+, a Postgres database, and a reachable Redmine instance.

```bash
cd backend
cp .env.example .env   # fill in DATABASE_URL, REDMINE_BASE_URL, REDMINE_API_KEY, etc.
npm install
npm run prisma:migrate:dev
npm run prisma:seed     # seeds ticket types/modules/priorities/statuses + prints an initial admin password
npm run dev              # http://localhost:10000
```

```bash
cd frontend
cp .env.example .env    # VITE_API_BASE_URL=http://localhost:10000
npm install
npm run dev               # http://localhost:5173
```

Then, to exercise a launch end-to-end without a real LOS, use the admin UI (`/admin`) to create a client, project, and integration secret, and call `POST /api/integration/launch-token` from a script or `curl` to obtain a `launchUrl`.

## Deployment

See [docs/RENDER_DEPLOY.md](docs/RENDER_DEPLOY.md). Short version: push to GitHub, create a Render Blueprint from `render.yaml`, fill in the `sync: false` secrets in the Render dashboard (never in git), and deploy.

## Documentation

- [docs/LOS_INTEGRATION_GUIDE.md](docs/LOS_INTEGRATION_GUIDE.md) — how another LOS integrates this tool
- [docs/SECURITY.md](docs/SECURITY.md) — isolation model, token design, acceptance tests
- [docs/RENDER_DEPLOY.md](docs/RENDER_DEPLOY.md) — deployment walkthrough
- [docs/UAT_TEST_PLAN.md](docs/UAT_TEST_PLAN.md) — end-to-end UAT script
- `GET /api/docs` — interactive OpenAPI explorer once the backend is running
