# Project Context Memory

Last updated: 2026-06-12

This file is a working memory for the project. It summarizes the current repo state, important decisions, active risks, and where future work should start. Update it when major behavior, routes, architecture, or project status changes.

## AI Memory Rule

When the user gives a prompt that changes the project, this file should be reviewed and updated in the same task when relevant.

Typical triggers:

- new feature, page, route, or workflow
- UI flow changes in an existing feature
- backend API/module changes
- database/schema or data-source changes
- switching between mock data and real API data
- important bug found, fixed, or re-scoped
- new project decision, constraint, or priority

What to record after those prompts:

- what changed
- which files/features are now the source of truth
- any new limitation, risk, or follow-up task
- whether related docs such as `README.md`, `GUIDE.md`, `COMPONENT_PJ.md`, or `BUG_LOG.md` should also be updated

If a prompt only makes a tiny local edit with no lasting project impact, `CONTEXT.md` does not need to change.

## Project Identity

- Project name: Carbon Footprint Management & Traceability System
- Domain: sugarcane-industry carbon footprint data management, traceability, analytics, and reporting
- Frontend: Vite + React 18 + TypeScript + Tailwind CSS
- Backend: NestJS + TypeScript
- Database: PostgreSQL
- ORM: Prisma 5
- Data fetching: TanStack Query

## Workspace Structure

- `frontend/`: React application
- `backend/`: NestJS API and Prisma schema
- `shared/`: shared DTO and type folders

Useful docs already in the repo:

- `README.md`: overview, commands, and deployment summary
- `GUIDE.md`: setup and runbook
- `COMPONENT_PJ.md`: file/component map
- `BUG_LOG.md`: known bugs and verification notes
- `SECURITY.md`: security handling guidance
- `summary_kongWork.md`: overall work summary
- `DASHBOARD_WORK_SUMMARY.md`: Carbon Analytics work history
- `CONCLUSION_CARBON_CAL_TABLE.md`: calculation-design notes and extracted formula requirements

## Current Repo Snapshot

Reviewed from local git state on 2026-06-11:

- Current branch: `kong_dev`
- Current HEAD: `8b212f4 Merge pull request #26 from JirayuKonG/idea`

Historical work-summary docs still reference branch `idea`. Treat those references as delivery history, not as the current local branch.

## Database And Prisma Snapshot

- `backend/src/prisma/schema.prisma` is the current schema reference.
- Repo notes say Prisma was re-introspected from the live Aiven PostgreSQL database on 2026-06-08.
- The SQL snapshot currently stored in the repo is `managementDataSystem_forCalculate_2.0_06082026_postgres.sql`.
- The live database may still be ahead of that SQL snapshot, so when schema behavior is unclear, prefer `schema.prisma` over assumptions from older SQL exports.
- Repo notes from the 2026-06-08 sync identify these important live-database tables in the current Prisma model set:
  - `activities_fileNameUse`
  - `activities_resourceOther`
  - `carbon_process_queue`
  - `carbon_roundCal`
  - `carbon_typeCal`
- Some tables do not have database-generated primary keys, so create flows still need extra care before assuming `autoincrement()`.

## Current App Routing Snapshot

Verified from `frontend/src/App.tsx` on 2026-06-11:

- `/overview`: Carbon overview summary
- `/process`: cultivation process analytics
- `/spatial`: area map and drill-down
- `/report`: Premium T-VER report
- `/footprint-report`: carbon footprint reporting page
- `/pipeline`: Carbon Analytics pipeline page
- `/calculate`: redirect to Carbon preparation page
- `/calculate/prepare`: carbon data preparation page for moving imported activity details into `carbon_process_queue`
- `/calculate/footprint`: carbon process queue page for unit/volume/soil/SOC preparation and calculation actions
- `/calculate/credit`: carbon credit analysis page
- `/dashboard`: older GHG dashboard
- `/geo`, `/infra`, `/users`, `/farmers`, `/lands`, `/lands/weather`
- `/emission-factors`
- `/activities/logs`, `/activities/resources`, `/activities/manage`

Important route notes:

- The older transport-focused Carbon Analytics page still has source files, but there is no active `/transport` route.
- `/pipeline` is still routable, but it is not exposed in the current main sidebar navigation.
- `/dashboard` remains routable, but it is also outside the current main sidebar navigation.

## Current Navigation Snapshot

Verified from `frontend/src/components/layout/Sidebar.tsx` on 2026-06-11:

- `CARBON ANALYTICS`
  - `ข้อมูลสรุปคาร์บอนเครดิต`
    - `/overview`
    - `/report`
  - `ข้อมูลสรุปคาร์บอนฟุตพริ้นท์`
    - `/process`
    - `/footprint-report`
  - `แผนที่พื้นที่`
    - `/spatial`
- `CARBON`
  - `บันทึกกิจกรรม`
    - `/activities/manage`
    - `/activities/logs`
  - `คำนวณ Carbon`
    - `/calculate/prepare`
    - `/calculate/footprint`
    - `/calculate/credit`
- `ข้อมูลเกษตรกร`
  - `/farmers`
  - `/lands`
  - `/lands/weather`
- `ตั้งค่าระบบ`
  - `/geo`
  - `/infra`
  - `/users`
  - `/emission-factors`
  - `/activities/resources`

## Carbon Analytics Data Source Reality

Verified from `frontend/src/features/cf-dashboard/services/dashboardApi.ts` on 2026-06-11:

- The dashboard service no longer uses a single `ENABLE_API_DASHBOARD` switch.
- The current pattern is API-first with mock fallback.
- Each data loader tries the backend analytics route first and returns `source: "api"` when usable data exists.
- If the API call fails or returns incomplete data, the service falls back to `mockDashboard` so the page stays usable.
- `getReportSummary()` also follows that pattern: it tries `/analytics/cf-report-summary` first, then builds a mock-based report summary when real calculated data is not ready.

What that means:

- Carbon Analytics is partially integrated with the backend now.
- Mock data is still an intentional part of the current user experience for incomplete or unavailable analytics data.
- Future dashboard work should keep distinguishing between:
  - real backend-calculated analytics
  - mock fallback coverage used to avoid empty pages

## Activity And Calculation Workflow Snapshot

Important current behavior from code and repo notes:

- `frontend/src/features/cf-dashboard/pages/CalculatePage.tsx` handles the preparation step for moving eligible activity-detail rows into `carbon_process_queue`.
- `frontend/src/features/cf-dashboard/pages/CarbonFootprintQueuePage.tsx` is the queue-driven Carbon Footprint preparation/calculation page.
- `frontend/src/features/cf-dashboard/pages/CarbonCreditPage.tsx` is a comparison page for 4 baseline years plus 1 project year.
- Repo notes say preparation metadata is intentionally stored without adding new database columns, reusing existing queue and result-unit fields.
- Activity imports now maintain imported-file history through `activities_fileNameUse`.
- Backend bootstrap in `backend/src/main.ts` installs `50mb` JSON and URL-encoded body parsers to support large import payloads.

Recent workflow update from user prompt on 2026-06-12:

- Prompt summary: update the bulk action card on the Carbon preparation queue page so the fuel preset button labeled `ใช้ preset m3` becomes `ใช้ preset ml`, and add an easy-to-see checkbox that optionally moves processed rows from `กำลังเตรียมข้อมูล` to `พร้อมคำนวณมาตรฐาน` immediately after bulk preparation completes.
- Result: `frontend/src/features/cf-dashboard/pages/CarbonFootprintQueuePage.tsx` now shows `ใช้ preset ml` for bulk fuel preparation and applies the `ml` target with conversion factor `0.001` as explicitly requested by the user. The same bulk modal now includes a checkbox labeled `เสร็จแล้ว ย้ายสถานะเป็น พร้อมคำนวณมาตรฐาน`.
- Source of truth: the new UI and behavior live in `frontend/src/features/cf-dashboard/pages/CarbonFootprintQueuePage.tsx`.
- Status behavior: when the checkbox is enabled, the bulk preparation flow saves preparation data first and then bulk-updates eligible selected rows from `กำลังเตรียมข้อมูล` to `พร้อมคำนวณมาตรฐาน`. When the checkbox is not enabled, status remains unchanged.
- Assumption kept intentionally: the new `ml` preset preserves the requested factor `0.001` even though that value is user-defined behavior rather than a generalized unit-conversion rule.
- Related docs updated: `CONTEXT.md` updated for project memory. No schema or route docs required changes.

Recent result-unit update from user prompt on 2026-06-12:

- Prompt summary: restrict Carbon Footprint result-unit selection so users can choose only `kgCO2e` and `tCO2e`, removing unsupported-unit selection that caused errors such as `kgCO2-eq/unit`.
- Result: the result-unit dropdown in `frontend/src/features/cf-dashboard/pages/CarbonFootprintQueuePage.tsx` now lists only supported unit-master entries that resolve to `kgCO2e` or `tCO2e`. Existing unsupported saved selections are ignored during modal initialization, and manual selection is guarded so unsupported unit IDs cannot be kept in this flow.
- Additional behavior: the inline `เพิ่มหน่วยใหม่` form in the same modal now validates unit name/initial input and allows creation only when the unit resolves to the supported `kgCO2e` or `tCO2e` groups.
- Source of truth: `frontend/src/features/cf-dashboard/pages/CarbonFootprintQueuePage.tsx` controls the selectable result-unit list and the create-unit validation for the Carbon Footprint modal.
- Related docs updated: `CONTEXT.md` updated for project memory. No database/schema changes were made.

## Important Feature Areas

- `geo`: Thailand geography reference data
- `infra`: factories, service areas, departments
- `users`: users and roles
- `farmers`: farmer records
- `lands`: lands, camps, and landmaps
- `weather`: weather records and CSV import
- `emission-factors`: EF, GWP, units, CF types, and groups
- `activities`: activity logging, imports, and calculation workflow
- `analytics`: aggregated dashboard/report APIs

## Key Files To Start With

Frontend:

- `frontend/src/App.tsx`: main routes
- `frontend/src/components/layout/Sidebar.tsx`: current navigation structure
- `frontend/src/features/cf-dashboard/`: active Carbon Analytics feature area
- `frontend/src/features/dashboard/`: older GHG dashboard area
- `frontend/src/lib/api.ts`: shared API client

Backend:

- `backend/src/modules/analytics/`: analytics endpoints and aggregation logic
- `backend/src/modules/activities/`: activity and calculation workflow
- `backend/src/modules/lands/`: lands, camps, landmaps
- `backend/src/prisma/schema.prisma`: Prisma schema
- `backend/src/main.ts`: app bootstrap and Swagger

## Known Technical Risks

High-value open issues summarized from `BUG_LOG.md`:

- Geo inserts may fail because some geo primary keys have no DB default.
- Several services still manually compute `MAX(id) + 1`, which creates race-condition risk on concurrent inserts.
- Weather manual-entry UI still has incomplete save wiring.
- CO2e calculation status is updated, but persistence of calculated results still needs careful verification.
- Emission factors page still exposes placeholder CRUD controls in some tabs.

Recently stabilized areas worth remembering:

- Lands/camps/landmaps CRUD is wired and explicitly supplies IDs where the DB does not.
- Sidebar active-state logic was fixed so `/lands/weather` does not highlight two items.
- Geo page now shows the full reference chain and visible load errors.
- Activity CSV import preserves repeated valid rows as separate records and reports skipped rows by reason.

## Build And Verification Snapshot

Recent successful commands recorded in repo docs:

- `npm run prisma:generate --workspace=backend`
- `npm run build --workspace=backend`
- `npm run build --workspace=frontend`
- `npm run build`

Known non-blocking warning:

- Vite bundle-size warning due to PDF/Excel-related libraries.

## Documentation Maintenance Rules

When behavior changes, keep docs aligned:

- update `README.md` for overview-level changes
- update `GUIDE.md` for setup/build/env changes
- update `COMPONENT_PJ.md` for route or file-location changes
- update `BUG_LOG.md` when a bug is found, fixed, or re-tested
- update `SECURITY.md` when security process or sensitive-data handling changes

## Suggested Use Of This File

Before starting new work:

1. Read this file first.
2. Check `BUG_LOG.md` for open issues in the area you will touch.
3. If working on Carbon Analytics, verify whether you are changing real API behavior, mock fallback behavior, or both.
4. After major changes, update this file so future work can continue faster.

After finishing work from a user prompt:

1. Decide whether the prompt changed project memory in a meaningful way.
2. If yes, add a short update to this file in the same task.
3. Keep the note factual and compact so this file stays easy to scan.
