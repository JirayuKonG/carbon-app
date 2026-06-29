# Carbon Footprint System Setup Guide

Last updated: 2026-06-23

This guide is the step-by-step setup and runbook for the project. For the high-level overview, start with [README.md](README.md).

## What You Need

| Tool | Minimum version | Check command |
| --- | --- | --- |
| Node.js | 18 | `node -v` |
| npm | 9 | `npm -v` |
| PostgreSQL | 14 if local | `psql --version` |
| Git | Any current stable version | `git --version` |

Use npm for this project because the repository has `package-lock.json` and npm workspaces. If you use Aiven PostgreSQL, you do not need a local PostgreSQL server, but the `psql` client is still useful for importing SQL snapshots.

## Install Dependencies

From the repository root:

```bash
npm install --workspaces
```

This downloads the main libraries used by the project:

| Workspace | Important libraries |
| --- | --- |
| `frontend` | React 18, Vite, TypeScript, Tailwind CSS, TanStack Query, Axios, React Router, Radix UI, lucide-react, Chart.js, Recharts, Leaflet, ExcelJS, xlsx, jsPDF, html2canvas |
| `backend` | NestJS, Prisma 5, `@prisma/client`, Swagger, Passport/JWT, bcryptjs, class-validator, Multer, csv-parse |

You normally do not install those packages one by one. Let `npm install --workspaces` read the package files and install the correct dependency set.

## Configure The Database

You can use either Aiven or a local PostgreSQL instance.

Use the newest repo snapshot for a fresh database:

```text
managementDataSystem_forCalculate_3.1_06162026_postgres.sql
```

Older SQL snapshots are kept for history and comparison only.

### Option A: Aiven PostgreSQL

1. Open your PostgreSQL service in Aiven.
2. Copy the service URI.
3. Import the repo SQL snapshot:

```bash
psql "postgresql://avnadmin:PASSWORD@HOST:PORT/defaultdb?sslmode=require" -f managementDataSystem_forCalculate_3.1_06162026_postgres.sql
```

4. Set `backend/.env` so `DATABASE_URL` includes `schema=public`. On small managed PostgreSQL plans, also keep Prisma pool limits in the URL.

Example:

```dotenv
DATABASE_URL="postgresql://avnadmin:PASSWORD@HOST:PORT/defaultdb?sslmode=require&schema=public&connection_limit=5&pool_timeout=20"
```

### Option B: Local PostgreSQL

```bash
createdb managementDataSystem_forCalculate
psql -d managementDataSystem_forCalculate -f managementDataSystem_forCalculate_3.1_06162026_postgres.sql
```

Example local `DATABASE_URL`:

```dotenv
DATABASE_URL="postgresql://postgres:PASSWORD@localhost:5432/managementDataSystem_forCalculate?schema=public"
```

## Configure Environment Variables

PowerShell:

```powershell
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env
```

Required backend values:

```dotenv
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DB_NAME?schema=public"
PORT=3000
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:4173
JWT_SECRET=change-this-secret
JWT_EXPIRES_IN=7d
PRISMA_CONNECTION_LIMIT=5
PRISMA_POOL_TIMEOUT=20
```

Common frontend values:

```dotenv
VITE_API_BASE_URL=/api
VITE_API_URL=/api
VITE_CF_ANALYTICS_SOURCE=api
VITE_CF_API_URL=
```

Notes:

- `frontend/src/lib/api.ts` currently reads `VITE_API_BASE_URL`.
- `VITE_API_URL` is kept in env examples for older compatibility, but current shared API calls use `VITE_API_BASE_URL`.
- `VITE_CF_ANALYTICS_SOURCE` defaults to `api`. Use `demo` or `mock` only when you intentionally want demo/mock analytics data.
- `VITE_CF_API_URL` is optional and is only used by the benchmark page under Carbon Analytics.
- Local frontend development normally uses `VITE_API_BASE_URL=/api` because `frontend/vite.config.ts` proxies `/api` to `http://localhost:3000`.
- For Aiven, keep `sslmode=require` in `DATABASE_URL`.
- Keep `connection_limit=5&pool_timeout=20` in the URL for small managed database plans, or keep `PRISMA_CONNECTION_LIMIT=5` and `PRISMA_POOL_TIMEOUT=20` so `PrismaService` can apply safe defaults.

## Generate Prisma Client

From the repository root:

```bash
npm run prisma:generate --workspace=backend
```

`prisma:generate` is safe for normal setup because it regenerates Prisma Client from the existing `backend/src/prisma/schema.prisma`.

Database introspection rewrites `schema.prisma`, so use it only when the task is explicitly to sync Prisma with the database schema:

```bash
npm run prisma:introspect --workspace=backend
```

Do not run Prisma migrations, `db push`, SQL structure edits, or introspection during ordinary setup or UI/backend feature work.

## Run The Project

### Run frontend and backend together

```bash
npm run dev
```

This starts:

- Vite frontend on `http://localhost:5173`
- NestJS backend on `http://localhost:3000/api`
- Swagger on `http://localhost:3000/api/docs`

### Run each app separately

Frontend:

```bash
npm run dev --workspace=frontend
```

Backend:

```bash
npm run start:dev --workspace=backend
```

## Build Commands

Build everything:

```bash
npm run build
```

Build frontend only:

```bash
npm run build --workspace=frontend
```

Build backend only:

```bash
npm run build --workspace=backend
```

## Deploy To Production From `main`

This repository can be deployed from the `main` branch without using a separate dev branch.

Recommended setup:

1. Keep PostgreSQL on Aiven or another managed PostgreSQL service.
2. Deploy the backend as a Node web service.
3. Deploy the frontend as a static site.
4. Point the frontend to the backend with `VITE_API_BASE_URL`.
5. Allow the frontend domain in backend `ALLOWED_ORIGINS`.

### Render deployment

The repository includes [render.yaml](render.yaml) for Render.

Backend production variables:

```dotenv
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/defaultdb?sslmode=require&schema=public&connection_limit=5&pool_timeout=20"
PRISMA_CONNECTION_LIMIT=5
PRISMA_POOL_TIMEOUT=20
JWT_SECRET="change-this-to-a-long-random-secret"
JWT_EXPIRES_IN=7d
ALLOWED_ORIGINS=https://your-frontend-domain.onrender.com
NODE_ENV=production
```

Frontend production variables:

```dotenv
VITE_API_BASE_URL=https://your-backend-domain.onrender.com/api
VITE_CF_ANALYTICS_SOURCE=api
VITE_CF_API_URL=
```

Notes:

- `ALLOWED_ORIGINS` can contain multiple comma-separated domains if needed.
- `VITE_CF_ANALYTICS_SOURCE=api` keeps analytics backend-first. Use `demo` or `mock` only for an intentional demo mode.
- The benchmark API is not part of this repository. The main app still runs without that service, while benchmark actions may fail unless `VITE_CF_API_URL` or the local fallback benchmark service is available.

## Local URLs

| URL | Purpose |
| --- | --- |
| `http://localhost:5173` | Frontend dev server |
| `http://localhost:3000/api` | Backend API |
| `http://localhost:3000/api/docs` | Swagger UI |

## Troubleshooting

### Prisma cannot connect to PostgreSQL

- Check that `backend/.env` has the right host, port, user, and password.
- For Aiven, keep `sslmode=require`.
- Make sure the connection string includes `schema=public`.

### Backend starts but API calls fail

- Confirm the database schema was imported from `managementDataSystem_forCalculate_3.1_06162026_postgres.sql`, or that your live database is aligned with `backend/src/prisma/schema.prisma`.
- Run `npm run prisma:generate --workspace=backend` after schema files change.
- Review known backend data issues in [BUG_LOG.md](BUG_LOG.md).

### Frontend cannot reach the backend

- For local development, keep `VITE_API_BASE_URL=/api`.
- Make sure the backend is running on `http://localhost:3000/api`.
- Restart the Vite dev server after changing `frontend/.env`.
- If the frontend is deployed, set `VITE_API_BASE_URL` to the deployed backend API URL, not `/api`.

### Carbon Analytics shows missing or demo data

- Keep `VITE_CF_ANALYTICS_SOURCE=api` for real backend-first analytics.
- Check that the backend can read calculated rows from `carbon_process_queue`.
- Use `demo` or `mock` only when you intentionally want demo data for presentation or UI work.

### PostgreSQL reports too many connections

- Keep `connection_limit=5&pool_timeout=20` in the Aiven `DATABASE_URL`, or set `PRISMA_CONNECTION_LIMIT=5` and `PRISMA_POOL_TIMEOUT=20`.
- Restart the backend dev server after changing those values so old connections are released.

### Frontend or backend command is missing

- Run `npm install --workspaces` again from the root.
- Use workspace commands from the root rather than trying to call binaries manually.

## Recommended Documentation Usage

- Update `README.md` when the overview, commands, or project links change.
- Update `GUIDE.md` when setup steps or environment requirements change.
- Update `COMPONENT_PJ.md` when routes, modules, or shared components move.
- Update `BUG_LOG.md` when a bug is found, fixed, or re-tested.
- Update `CONTEXT.md` when a change affects project memory or source-of-truth guidance.
