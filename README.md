# Carbon Footprint Management & Traceability System

Sugarcane-industry full-stack application for carbon footprint data management, traceability, and analytics.

## Overview

- Frontend: Vite + React 18 + TypeScript + Tailwind CSS
- Backend: NestJS + TypeScript
- Database: PostgreSQL
- ORM: Prisma 5
- State/Data fetching: TanStack Query

This repository is organized as a small workspace monorepo:

```text
carbon-app/
|- frontend/   React application
|- backend/    NestJS API + Prisma schema
|- shared/     Shared TypeScript types
|- README.md
|- GUIDE.md
|- CONTRIBUTING.md
|- SECURITY.md
|- COMPONENT_PJ.md
`- BUG_LOG.md
```

## Documentation Map

Use the project docs like this:

- [README.md](README.md): project overview, quick start, and doc index
- [GUIDE.md](GUIDE.md): detailed setup, run, build, and troubleshooting guide
- [COMPONENT_PJ.md](COMPONENT_PJ.md): frontend/backend file map
- [BUG_LOG.md](BUG_LOG.md): active bugs, fixed bugs, and verification notes
- [CONTRIBUTING.md](CONTRIBUTING.md): how to keep docs and project changes consistent
- [SECURITY.md](SECURITY.md): vulnerability reporting and security handling guidance

## Quick Start

### 1. Install dependencies

```bash
npm install --workspaces
```

### 2. Configure the backend environment

PowerShell:

```powershell
Copy-Item backend/.env.example backend/.env
```

Then update `backend/.env` with a valid `DATABASE_URL`.

### 3. Create or import the database

If you use local PostgreSQL:

```bash
createdb managementDataSystem_forCalculate
psql -d managementDataSystem_forCalculate -f managementDataSystem_forCalculate_1.3_05192026_postgres.sql
```

If you use Aiven PostgreSQL, keep `sslmode=require` and append `schema=public` in `DATABASE_URL`.

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

```bash
npm run dev
npm run build
npm run build --workspace=frontend
npm run build --workspace=backend
npm run prisma:generate --workspace=backend
npm run prisma:introspect --workspace=backend
npm run prisma:studio --workspace=backend
```

## Main Functional Areas

- `geo`: geography reference data
- `infra`: factories, service areas, departments
- `users`: users and roles
- `farmers`: farmer records
- `lands`: lands, camps, landmaps
- `weather`: weather records and CSV import
- `emission-factors`: emission factors, GWP, units
- `activities`: activity logs, imports, CO2e workflow
- `analytics`: dashboard aggregations and summaries

## Data And Schema Notes

- The SQL dump `managementDataSystem_forCalculate_1.3_05192026_postgres.sql` is the database source of truth.
- Prisma schema lives at `backend/src/prisma/schema.prisma`.
- Swagger is configured in `backend/src/main.ts`.
- Some tables do not have database-generated primary keys; see [BUG_LOG.md](BUG_LOG.md) before changing create flows.

## Documentation Recommendation

For this project, keep each Markdown file focused:

- Put onboarding and setup in `README.md` and `GUIDE.md`
- Put architecture/file lookup in `COMPONENT_PJ.md`
- Put issue tracking in `BUG_LOG.md`
- Put contributor workflow in `CONTRIBUTING.md`

That separation will make the docs easier to maintain than putting everything into one large file.
