# Carbon Footprint System Setup Guide

Last updated: 2026-05-30

This guide is the step-by-step setup and runbook for the project. For the high-level overview, start with [README.md](README.md).

## What You Need

| Tool | Minimum version | Check command |
| --- | --- | --- |
| Node.js | 18 | `node -v` |
| npm | 9 | `npm -v` |
| PostgreSQL | 14 if local | `psql --version` |

If you use Aiven PostgreSQL, you do not need a local PostgreSQL server.

## Install Dependencies

From the repository root:

```bash
npm install --workspaces
```

## Configure The Database

You can use either Aiven or a local PostgreSQL instance.

### Option A: Aiven PostgreSQL

1. Open your PostgreSQL service in Aiven.
2. Copy the service URI.
3. Import the schema:

```bash
psql "postgresql://avnadmin:PASSWORD@HOST:PORT/defaultdb?sslmode=require" -f managementDataSystem_forCalculate_1.3_05192026_postgres.sql
```

4. Set `backend/.env` so `DATABASE_URL` ends with `&schema=public`.

Example:

```dotenv
DATABASE_URL="postgresql://avnadmin:PASSWORD@HOST:PORT/defaultdb?sslmode=require&schema=public"
```

### Option B: Local PostgreSQL

```bash
createdb managementDataSystem_forCalculate
psql -d managementDataSystem_forCalculate -f managementDataSystem_forCalculate_1.3_05192026_postgres.sql
```

Example local `DATABASE_URL`:

```dotenv
DATABASE_URL="postgresql://postgres:PASSWORD@localhost:5432/managementDataSystem_forCalculate?schema=public"
```

## Configure Environment Variables

PowerShell:

```powershell
Copy-Item backend/.env.example backend/.env
```

Required backend values:

```dotenv
DATABASE_URL="your-postgresql-connection-string"
PORT=3000
NODE_ENV=development
JWT_SECRET=change-this-secret
JWT_EXPIRES_IN=7d
```

## Generate Prisma Client

From the repository root:

```bash
npm run prisma:generate --workspace=backend
```

Optional database introspection:

```bash
npm run prisma:introspect --workspace=backend
```

## Run The Project

### Run frontend and backend together

```bash
npm run dev
```

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

This repository can be deployed from the `main` branch without using the dev branch.

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
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/defaultdb?sslmode=require&schema=public"
JWT_SECRET="change-this-to-a-long-random-secret"
JWT_EXPIRES_IN=7d
ALLOWED_ORIGINS=https://your-frontend-domain.onrender.com
NODE_ENV=production
```

Frontend production variables:

```dotenv
VITE_API_BASE_URL=https://your-backend-domain.onrender.com/api
VITE_CF_API_URL=
```

Notes:

- `ALLOWED_ORIGINS` can contain multiple comma-separated domains if needed.
- `VITE_CF_API_URL` is optional and is only needed for the benchmark page in Carbon Analytics.
- The benchmark API is not part of this repository, so leaving `VITE_CF_API_URL` empty will keep the main app deployable while that page shows a configuration message.

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

- Confirm the database schema was imported from `managementDataSystem_forCalculate_1.3_05192026_postgres.sql`.
- Review known backend data issues in [BUG_LOG.md](BUG_LOG.md).

### Frontend or backend command is missing

- Run `npm install --workspaces` again from the root.
- Use workspace commands from the root rather than trying to call binaries manually.

## Recommended Documentation Usage

- Update `README.md` when the overview, commands, or project links change.
- Update `GUIDE.md` when setup steps or environment requirements change.
- Update `COMPONENT_PJ.md` when routes, modules, or shared components move.
- Update `BUG_LOG.md` when a bug is found, fixed, or re-tested.
