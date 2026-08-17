# Deploying to Render

## 1. Push this repository to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/NYXABRAXAS/Ticketingtool.git
git push -u origin main
```

## 2. Create a Blueprint on Render

In the Render dashboard: **New → Blueprint**, point it at this repository. Render reads `render.yaml` and proposes three resources: `los-ticketing-backend` (web service), `los-ticketing-frontend` (static site), `los-ticketing-db` (Postgres).

## 3. Fill in the secrets Render prompts for

`render.yaml` deliberately leaves these blank (`sync: false`) — enter them once in the Render dashboard, never in git:

| Variable | Where to get it |
|---|---|
| `REDMINE_BASE_URL` | Your Redmine server URL, e.g. `https://redmine.example.com` |
| `REDMINE_API_KEY` | Redmine → My account → API access key |
| `ALLOWED_ORIGINS` | Comma-separated LOS origins, e.g. `https://esaf-los.example.com` |
| `PUBLIC_APP_URL` | The backend's own Render URL once known, e.g. `https://los-ticketing-backend.onrender.com` (launch URLs are built from this) |
| `SEED_ADMIN_USERNAME` / `SEED_ADMIN_PASSWORD` | Optional — set these to control the first admin login instead of using the auto-generated one printed in the deploy logs |
| `VITE_API_BASE_URL` (frontend service) | The backend service's public URL |

`TICKETING_JWT_SECRET` and `LAUNCH_TOKEN_SECRET` are generated automatically by Render (`generateValue: true`) — you never need to set these.

## 4. Deploy

Render runs, per service:

- Backend: `npm install && npm run build`, then on start `npm run prisma:migrate:deploy && npm run prisma:seed && npm start`. The seed step is idempotent — it only creates the initial admin user once and upserts default ticket types/modules/priorities/statuses on every deploy.
- Frontend: `npm install && npm run build`, publishing `frontend/dist` as a static site with an SPA rewrite rule.

## 5. First login

Check the backend service's deploy logs for the line printed by the seed script:

```
[seed] Created initial admin user.
  username: admin
  password: <random>
```

The admin UI is served by the **frontend** service, not the backend. Log into `https://<frontend-host>/admin/login` with that username/password, then rotate the password immediately (there is currently no self-service password change UI; update `admin_users.passwordHash` via a follow-up admin API call or database migration if you need to change it before one is added).

## 6. Point your LOS at it

Follow [LOS_INTEGRATION_GUIDE.md](LOS_INTEGRATION_GUIDE.md): create a client, project, assignee mapping, and integration secret from the admin UI, then configure your LOS backend to call `POST /api/integration/launch-token` on the backend's public URL.

## 7. Verify

- `GET https://<backend-host>/api/health` → `{ "status": "ok", "database": "connected", "redmine": "connected" }`
- Admin → Redmine Connection → **Test Redmine Connection** → green check
- Run through [UAT_TEST_PLAN.md](UAT_TEST_PLAN.md)

## Notes

- Both services must bind to `0.0.0.0` and `process.env.PORT` — already handled in `backend/src/index.ts`; Render's static site service manages its own port for the frontend.
- If you deploy backend and frontend as genuinely separate hosts (recommended), remember to add the frontend's origin to `ALLOWED_ORIGINS` on the backend so CORS allows it.
- Postgres connection pooling: Render's `starter` Postgres plan has a modest connection limit; if you scale the backend to multiple instances, consider Prisma's connection pool size (`connection_limit` query param on `DATABASE_URL`) or a pooler like PgBouncer.
