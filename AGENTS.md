# AGENTS.md

Last updated: 2026-06-12

This file is the operating guide for coding agents working in this repository. Read it before making changes, then use the project docs as the source of truth.

## Project Identity

This project is the Carbon Footprint Management & Traceability System. It supports sugarcane-industry carbon footprint data management, traceability, analytics, carbon calculation workflows, and thesis development.

The project is built by a data engineering master's student who is still learning and using this system to improve technical skill while completing a thesis. Agents should help the project move forward while also helping the owner understand the work.

## Repository Shape

- `frontend/`: Vite + React 18 + TypeScript + Tailwind CSS application
- `backend/`: NestJS + TypeScript API with Prisma
- `shared/`: shared DTO and type folders
- Database: PostgreSQL
- ORM: Prisma 5
- Data fetching: TanStack Query

## Source Of Truth

- Read `CONTEXT.md` first for non-trivial work. It is the project memory and current-state guide.
- Use `COMPONENT_PJ.md` to find frontend pages, backend modules, routes, and important files.
- Check `BUG_LOG.md` before touching risky areas or previously unstable workflows.
- Use `README.md` and `GUIDE.md` for setup, commands, deployment notes, and environment expectations.
- Treat `backend/src/prisma/schema.prisma` as the current schema reference, but do not change it unless the user explicitly requests schema work.

## Strict Database Rule

Do not change the database schema, Prisma schema, SQL snapshots, migrations, introspection output, generated schema state, or database structure unless the user explicitly asks for that exact change.

This means agents must not run or commit changes from schema-changing commands such as Prisma introspection, migration generation, `db push`, or SQL structure edits unless the user clearly requested database/schema changes. Reading schema files for context is allowed.

## Documentation Memory Rule

When a prompt changes website/app behavior, update `CONTEXT.md` in the same task when relevant.

Record the important history clearly:

- the user prompt or a short summary of what was requested
- what changed
- the result after implementation
- the files or features that are now the source of truth
- any limitation, risk, or follow-up task
- whether related docs such as `README.md`, `GUIDE.md`, `COMPONENT_PJ.md`, or `BUG_LOG.md` were updated or should be updated

Tiny local edits with no lasting behavior or project-memory impact do not need a `CONTEXT.md` update.

## Learning And Thesis Rule

Treat this as both a production-style application and a learning/thesis project.

- Explain meaningful changes in clear language.
- Prefer understandable code over clever code.
- Keep architecture and naming consistent so the owner can study the system later.
- When tradeoffs matter, name them briefly instead of hiding them inside the implementation.
- Help the owner build data engineering, backend, frontend, and carbon-accounting system skills over time.

## Main Workflows To Understand

- Activity import and activity management
- Carbon data preparation into `carbon_process_queue`
- Carbon Footprint queue preparation and calculation
- Carbon Credit analysis
- Carbon Analytics dashboard and reports
- API-first dashboard loading with mock fallback when real analytics data is incomplete or unavailable

## Agent Workflow

1. Inspect before editing. Read the relevant docs and source files before making assumptions.
2. Keep changes scoped to the user's request.
3. Do not refactor unrelated code unless required to complete the task safely.
4. Preserve existing user changes. Do not revert work you did not make.
5. Follow existing project patterns for React, NestJS, Prisma, Tailwind, and API helpers.
6. Verify with the smallest useful command, such as a focused build or test, when possible.
7. Report what changed, what was verified, and any remaining risk.

## Useful Commands

```bash
npm run dev
npm run build
npm run build --workspace=frontend
npm run build --workspace=backend
npm run prisma:generate --workspace=backend
```

Only run Prisma or database-related commands when they are needed and safe for the requested task. Follow the strict database rule above.

## Definition Of Done

- The requested change is implemented or the blocker is clearly explained.
- Relevant behavior is verified when possible.
- Documentation is updated when the change affects behavior, setup, routes, architecture, source-of-truth guidance, or known bugs.
- `CONTEXT.md` is updated when the change creates meaningful project history.
- Any unresolved risk is called out clearly and honestly.
