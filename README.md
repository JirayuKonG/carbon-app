# Carbon Footprint Management & Traceability System

Last updated: 2026-06-23

Sugarcane-industry full-stack application for carbon footprint data management, traceability, and analytics.

## Overview

- Frontend: Vite + React 18 + TypeScript + Tailwind CSS
- Backend: NestJS + TypeScript
- Database: PostgreSQL
- ORM: Prisma 5
- State/Data fetching: TanStack Query

## Repository Layout

```text
carbon-app/
|- frontend/   React application
|- backend/    NestJS API + Prisma schema
|- shared/     Shared DTO and type folders
|- README.md
|- GUIDE.md
|- COMPONENT_PJ.md
|- BUG_LOG.md
|- CONTEXT.md
|- CONTRIBUTING.md
|- SECURITY.md
|- summary_kongWork.md
|- DASHBOARD_WORK_SUMMARY.md
`- CONCLUSION_CARBON_CAL_TABLE.md
```

## Documentation Map

Core project docs:

- [README.md](README.md): overview, quick start, deployment summary, and doc index
- [GUIDE.md](GUIDE.md): detailed setup, environment, build, and troubleshooting guide
- [COMPONENT_PJ.md](COMPONENT_PJ.md): frontend/backend route and file map
- [BUG_LOG.md](BUG_LOG.md): active bugs, fixed bugs, and verification notes
- [CONTEXT.md](CONTEXT.md): current project memory, constraints, and source-of-truth notes
- [CONTRIBUTING.md](CONTRIBUTING.md): documentation and change-maintenance workflow
- [SECURITY.md](SECURITY.md): vulnerability reporting and sensitive-data handling guidance

Working notes and implementation summaries:

- [summary_kongWork.md](summary_kongWork.md): overall work summary and responsibility scope
- [DASHBOARD_WORK_SUMMARY.md](DASHBOARD_WORK_SUMMARY.md): Carbon Analytics and reporting work history
- [CONCLUSION_CARBON_CAL_TABLE.md](CONCLUSION_CARBON_CAL_TABLE.md): calculation-design notes extracted from source spreadsheets/slides

## Requirements

Use the project from the repository root with npm workspaces.

| Tool | Minimum | Notes |
| --- | --- | --- |
| Node.js | 18 | Node 20 LTS is also suitable. |
| npm | 9 | Use npm because `package-lock.json` is committed. |
| PostgreSQL | 14 if local | Not required when using Aiven or another managed PostgreSQL database. |
| `psql` CLI | PostgreSQL client version compatible with your DB | Needed only when importing SQL snapshots manually. |

## Quick Start

### 1. Install dependencies

```bash
npm install --workspaces
```

This installs the frontend and backend libraries used by the app, including React, Vite, Tailwind CSS, TanStack Query, Axios, Chart.js/Recharts, Leaflet, Excel/PDF export libraries, NestJS, Prisma, Swagger, Passport/JWT, Multer, and CSV parsing tools.

### 2. Configure environment files

PowerShell:

```powershell
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env
```

Then update `backend/.env` with a valid `DATABASE_URL`. For local frontend work, keep `VITE_API_BASE_URL=/api`; Vite proxies `/api` requests to the local backend on port `3000`.

### 3. Create or import the database

Prefer the newest repo SQL snapshot for a fresh local or managed database:

```text
managementDataSystem_forCalculate_3.1_06162026_postgres.sql
```

If you use local PostgreSQL:

```bash
createdb managementDataSystem_forCalculate
psql -d managementDataSystem_forCalculate -f managementDataSystem_forCalculate_3.1_06162026_postgres.sql
```

If you use Aiven PostgreSQL, keep `sslmode=require` and append `schema=public` in `DATABASE_URL`. Also keep `connection_limit=5&pool_timeout=20` on small managed database plans, or let the backend apply those Prisma pool defaults at startup.

### 4. Generate Prisma client

```bash
npm run prisma:generate --workspace=backend
```

### 5. Start the app

```bash
npm run dev
```

Default local URLs:

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:3000/api`
- Swagger: `http://localhost:3000/api/docs`

## Workspace Commands

Common commands:

```bash
npm run dev
npm run build
npm run build --workspace=frontend
npm run build --workspace=backend
npm run prisma:generate --workspace=backend
npm run prisma:studio --workspace=backend
```

Schema-changing commands such as Prisma introspection, migrations, `db push`, or direct SQL structure edits should only be run when the task is explicitly about database/schema work. For ordinary frontend/backend development, use `prisma:generate` after the schema has already been updated.

## Deploying `main`

This project is set up to deploy from the `main` branch with:

- frontend: static site
- backend: NestJS web service
- database: PostgreSQL, such as Aiven

The repository includes [render.yaml](render.yaml) for a Render deployment flow.

Minimum production environment variables:

- backend:
  - `DATABASE_URL`
  - `PRISMA_CONNECTION_LIMIT` (optional; defaults to `5` when `DATABASE_URL` has no `connection_limit`)
  - `PRISMA_POOL_TIMEOUT` (optional; defaults to `20` seconds when `DATABASE_URL` has no `pool_timeout`)
  - `JWT_SECRET`
  - `JWT_EXPIRES_IN`
  - `ALLOWED_ORIGINS`
  - `NODE_ENV=production`
- frontend:
  - `VITE_API_BASE_URL`
  - `VITE_CF_ANALYTICS_SOURCE` (optional; defaults to `api`)
- optional frontend benchmark page:
  - `VITE_CF_API_URL`

Important notes:

- `ALLOWED_ORIGINS` accepts a comma-separated list, for example `https://carbon-footprint-web.onrender.com`
- `VITE_API_BASE_URL` should point to your deployed backend API, for example `https://carbon-footprint-api.onrender.com/api`
- `VITE_CF_ANALYTICS_SOURCE=api` keeps Carbon Analytics backend-first. Use `demo` or `mock` only when you intentionally want demo data.
- the benchmark page can use `VITE_CF_API_URL`, but that benchmark API is not part of this repository. The main app still runs without that service, while benchmark actions may fail unless a compatible service is available.

## Main Functional Areas

- `geo`: geography reference data
- `infra`: factories, service areas, departments
- `users`: users and roles
- `farmers`: farmer records
- `lands`: lands, camps, landmaps
- `weather`: weather records and CSV import
- `emission-factors`: emission factors, GWP, units
- `activities`: activity logs, imports, and CO2e workflow
- `analytics`: dashboard aggregations, Carbon Analytics data, and reports

## Data And Schema Notes

- `backend/src/prisma/schema.prisma` was re-introspected from the live Aiven PostgreSQL database on 2026-06-08 and should be treated as the current schema reference.
- The newest SQL snapshot currently stored in the repo is `managementDataSystem_forCalculate_3.1_06162026_postgres.sql`. It is useful for bootstrap and offline setup, but the live database can still move ahead of that snapshot.
- Older snapshots such as `managementDataSystem_forCalculate_2.0_06082026_postgres.sql` and `managementDataSystem_forCalculate_3.0_06152026_postgres.sql` are retained as history and comparison points.
- Important current tables include `activities_fileNameUse`, `activities_resourceOther`, `activities_productYear`, `carbon_process_queue`, `carbon_roundCal`, `carbon_typeCal`, `carbon_soc`, and `carbon_soilImprovementPlants`.
- Swagger is configured in `backend/src/main.ts`.
- Some tables do not have database-generated primary keys; see [BUG_LOG.md](BUG_LOG.md) before changing create flows.

## Optional Local Tunnel

If you want to expose the local frontend through `ngrok` on Windows PowerShell:

```powershell
& "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\Ngrok.Ngrok_Microsoft.Winget.Source_8wekyb3d8bbwe\ngrok.exe" http 5173
```

Run the app locally first with:

```bash
npm run dev
```
