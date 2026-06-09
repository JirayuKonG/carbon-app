# Project Context Memory

Last updated: 2026-06-09

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
- whether related docs such as `README.md`, `COMPONENT_PJ.md`, or `BUG_LOG.md` should also be updated

If a prompt only makes a tiny local edit with no lasting project impact, `context.md` does not need to change.

## Project Identity

- Project name: Carbon Footprint Management & Traceability System
- Domain: sugarcane-industry carbon footprint data management, traceability, analytics, and reporting
- Repo style: small monorepo
- Frontend: Vite + React 18 + TypeScript + Tailwind CSS
- Backend: NestJS + TypeScript
- Database: PostgreSQL
- ORM: Prisma 5
- Data fetching: TanStack Query

## Workspace Structure

- `frontend/`: React application
- `backend/`: NestJS API and Prisma schema
- `shared/`: shared TypeScript types

Useful docs already in the repo:

- `README.md`: overview and commands
- `GUIDE.md`: setup and runbook
- `COMPONENT_PJ.md`: file/component map
- `BUG_LOG.md`: known bugs and verification notes
- `SECURITY.md`: security handling guidance
- `DASHBOARD_WORK_SUMMARY.md`: Carbon Analytics work history and dashboard-specific decisions

## Recent Database / Prisma Sync

- On 2026-06-08, `backend/src/prisma/schema.prisma` was re-introspected from the live Aiven PostgreSQL database configured by `backend/.env`.
- The live database currently contains 39 Prisma models and is ahead of the older SQL dump in the repo.
- Newly surfaced live-database models now represented in Prisma are:
  - `activities_fileNameUse`
  - `activities_resourceOther`
  - `carbon_process_queue`
  - `carbon_roundCal`
  - `carbon_typeCal`
- The live database introspection also removed old Prisma `autoincrement()` assumptions from many primary keys, which means backend create flows must keep supplying explicit IDs where the database has no default/identity.
- After the sync, backend compatibility fixes were applied in:
  - `backend/src/modules/activities/activities.service.ts`
  - `backend/src/modules/lands/lands.service.ts`
- Verification after the sync:
  - `npx prisma generate --schema src/prisma/schema.prisma`
  - `npm run build --workspace=backend`
- On 2026-06-09, Carbon preparation was adjusted to avoid database-structure changes. No new `carbon_process_queue` columns are required; preparation metadata is stored in existing `carbon_process_queue_info`, result unit ids use existing `unit_id_resultValue` / `unit_prefix_id_resultValue`, and canonical unit/volume values stay on `log_activities_detail`.

## Current App Routing Snapshot

Verified from `frontend/src/App.tsx` on 2026-06-09:

- `/overview`: Carbon overview summary
- `/process`: cultivation process analytics
- `/spatial`: area map and drill-down
- `/report`: Premium T-VER report
- `/calculate`: redirect to Carbon preparation page
- `/calculate/prepare`: carbon data preparation page for moving imported activity details into `carbon_process_queue`
- `/calculate/footprint`: carbon process queue page for unit/volume/soil/SOC preparation and calculation actions
- `/calculate/credit`: carbon credit analysis page
- `/dashboard`: older GHG dashboard
- `/geo`, `/infra`, `/users`, `/farmers`, `/lands`, `/lands/weather`
- `/emission-factors`
- `/activities/logs`, `/activities/resources`, `/activities/manage`

Important route note:

- The old transport-focused Carbon Analytics page is described in older dashboard notes, but there is no active `/transport` route in the current app router.
- The old pipeline page was intentionally removed from the accessible menu/route flow.

## Carbon Analytics Status

This area has the most active product change history.

Latest documented dashboard work:

- Main working branch noted in docs: `idea`
- Latest dashboard commit mentioned in docs: `Polish carbon dashboard spatial inputs`
- `block_dev` was merged into `idea`
- Docs say `npm run build` passed after the merge

Current product direction from the docs:

- Carbon Analytics focuses on cultivation, spatial drill-down, and Premium T-VER reporting
- The main Carbon menu was reorganized into:
  - Summary
  - Process
  - Premium T-VER report
- Spatial detail was moved out of the summary page into its own page
- Pipeline proof was removed from the user-facing flow
- Transport was removed from the main Carbon Analytics scope

Recent Carbon calculation workflow note:

- On 2026-06-09, `คำนวณ Carbon` was split into three child pages:
  - `เตรียมข้อมูล Carbon` at `/calculate/prepare`
  - `Carbon Footprint` at `/calculate/footprint`
  - `Carbon Credit` at `/calculate/credit`
- `frontend/src/features/cf-dashboard/pages/CalculatePage.tsx` now focuses on moving only `นำเข้าข้อมูลแล้ว` activity-detail rows into `กำลังเตรียมข้อมูล`.
- Moving a detail from `นำเข้าข้อมูลแล้ว` to `กำลังเตรียมข้อมูล` now creates or syncs one `carbon_process_queue` row by `log_act_detail_id`.
- `frontend/src/features/cf-dashboard/pages/CarbonFootprintQueuePage.tsx` is the new queue table for preparing units, total volume, fertilizer bag weights, fuel L/m3 conversion, soil test fields, and SOC fields before calculation.
- New backend endpoints are `GET /activities/carbon-process-queue` and `PUT /activities/carbon-process-queue/:id/preparation`.
- This workflow intentionally uses the existing database schema only; it does not add a new migration or new preparation columns.

Recent navigation note:

- On 2026-06-04, the sidebar group order was updated to:
  - `CARBON ANALYTICS`: `ภาพรวม Carbon`, `แผนที่พื้นที่`
  - `CARBON`: `บันทึกกิจกรรม` (`จัดการกิจกรรม`, `รายการบันทึกกิจกรรม`), `คำนวณ Carbon` (`เตรียมข้อมูล Carbon`, `Carbon Footprint`, `Carbon Credit`)
  - `ข้อมูลเกษตรกร`: `จัดการเกษตรกร`, `พื้นที่เพาะปลูก`, `ข้อมูลสภาพอากาศ`
  - `ตั้งค่าระบบ`: `พื้นที่ในประเทศไทย`, `โรงงาน / บริการ`, `จัดการผู้ใช้`, `EF / GWP / หน่วย`, `ปุ๋ย / น้ำมัน`
- The older `/dashboard` page remains routable, but it is no longer listed in the main sidebar navigation.

Recent Carbon Credit note:

- On 2026-06-04, `คำนวณ Carbon` was split into Carbon Footprint and Carbon Credit, then on 2026-06-09 it was split further into `เตรียมข้อมูล Carbon`, `Carbon Footprint`, and `Carbon Credit`.
- `Carbon Credit` reuses `GET /activities/details`, lets users choose 4 baseline years plus 1 project year, groups results by plot, uses `log_act_detail_areawork` as the operated-area source, and compares fertilizer vs fuel between baseline average and project year.
- The new `Carbon Credit` page does not persist results or add a new workflow/status system.
- On 2026-06-04, `Carbon Footprint` got its dashboard-card visibility control back via `DashboardVisibilityMenu`, and both `Carbon Footprint` and `Carbon Credit` were adjusted to use a more compact header style closer to the rest of the app.

Recent activity-page UI note:

- On 2026-06-04, both `จัดการกิจกรรม` and `รายการบันทึกกิจกรรม` got a small header control for dashboard-card visibility.
- The control is implemented by `frontend/src/components/ui/DashboardVisibilityMenu.tsx`.
- Users can choose which summary stat cards are shown on each page, and the selection is stored locally in the browser.
- On 2026-06-08, `frontend/src/features/activities/ActivitiesPage.tsx` added an import-history table backed by the new `activities_fileNameUse` table.
- Successful CSV imports from the activities wizard now create one `activities_fileNameUse` record with filename, row count, column count, and timestamps through new backend endpoints in `backend/src/modules/activities/activities.controller.ts` and `activities.service.ts`.
- The `จัดการกิจกรรม` dashboard now also shows a `ไฟล์ที่นำเข้าแล้ว` summary card sourced from that import-history list.

Recent CSV import note:

- On 2026-06-04, the backend bootstrap in `backend/src/main.ts` was updated to accept larger JSON/urlencoded request bodies for activity CSV import.
- This is required because the Step 4 `Validate` import flow sends the full mapped CSV row set to `POST /activities/import`, which previously could fail with `request entity too large` on big files.
- The Nest default body parser is disabled so the custom `50mb` JSON/urlencoded parser is installed first; otherwise the default parser can still reject large CSV payloads before the route is reached.
- The activity CSV wizard now imports through `frontend/src/features/activities/ActivitiesPage.tsx` in approximately `20 KB` chunks and merges the chunk results back into one wizard result. This avoids gateway/database-host sensitivity to one large request while continuing to reuse `POST /activities/import`.
- On 2026-06-05, the activity CSV import rules were changed so repeated activity rows are valid data, not duplicates to merge or discard.
- `log_act_detail_create_at` is now treated as the required activity date for import. Rows with a missing or invalid date are skipped with a clear `วันที่ผิด/หาย` error instead of silently using the current date.
- Rows with neither `land_code` nor `land_camp_name` are skipped with a clear `ไม่พบไร่/แปลง` error. Rows with only `land_camp_name` still import through an internal `AUTO-CAMP-*` placeholder land, but the activity UI displays them as `เบิกเข้าไร่`.
- Activity import now reuses the latest existing `activities_header` per `land_id`. It no longer groups/reuses headers by `land + date + activity type`; if a land has no header yet, the import creates one header using the first valid imported activity date for that land.
- The import wizard summary now groups skipped rows by reason, including missing land/camp, bad date, unit issues, resource issues, and other errors.
- The activity management and activity log pages now display `log_act_detail_create_at` as date-only, without time.
- The activity CSV wizard Validate step now shows an import progress bar after confirmation. Progress is reported from the chunk importer by bytes uploaded versus total chunk bytes, using the current approximately `20 KB` chunk size.
- On 2026-06-05, `log_act_detail_quatity` was changed from integer to float across Prisma schema, activity import parsing, and activity UI forms/displays. A manual SQL migration was added at `backend/src/prisma/manual-migrations/2026-06-05-log-act-detail-quatity-to-float.sql`, and the live PostgreSQL column was widened to `double precision`.

## Carbon Analytics Data Source Reality

There is an important documentation/code mismatch here, so this is the most important current-state note.

Verified from `frontend/src/features/cf-dashboard/services/dashboardApi.ts` on 2026-06-03:

- `ENABLE_API_DASHBOARD = false`
- The cf-dashboard frontend currently returns mock data for overview, trend, process, spatial, inputs, and report summary
- API wiring is still present and can be re-enabled later
- Mock data lives in `frontend/src/features/cf-dashboard/data/mockDashboard.ts`

What that means:

- Backend analytics endpoints exist, but the current Carbon Analytics UI is still in mock preview mode
- Future dashboard work should verify whether the next step is:
  - keep polishing UI with mock data, or
  - switch `ENABLE_API_DASHBOARD` to `true` and finish real API integration

## Important Feature Areas

- `geo`: Thailand geography reference data
- `infra`: factories, service areas, departments
- `users`: users and roles
- `farmers`: farmer records
- `lands`: lands, camps, and landmaps
- `weather`: weather records and CSV import
- `emission-factors`: EF, GWP, units, CF types, groups
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

## Database And Data Rules

- `backend/src/prisma/schema.prisma` is the current schema reference because it was synced from the live Aiven PostgreSQL database on 2026-06-08
- The SQL dump `managementDataSystem_forCalculate_1.3_05192026_postgres.sql` is now best treated as a historical/bootstrap artifact unless it is re-exported from the live database
- Some tables do not have database-generated primary keys, so create flows must be checked carefully before assuming `autoincrement()`
- For analytics, the docs say important source tables include:
  - `log_activities_detail`
  - `activities_header`
  - `activities_header_type`
  - `activities_header_detail_type`
  - `lands`
  - `farmers`
  - `geographies`
  - `provinces`
  - `districts`
  - `subdistricts`
- Analytics rules documented in the dashboard notes:
  - use only rows with `log_act_detail_calStatus_id = 2`
  - use carbon value from `log_act_detail_volumeAll`
  - use year from `activities_header_startDate`

## Known Technical Risks

High-value open issues from `BUG_LOG.md`:

- Geo inserts may fail because some geo primary keys have no DB default
- Several controllers/services still pass raw request bodies or weakly normalized values into Prisma
- Weather manual-entry modal still has UI without full save wiring
- CO2e calculation status is updated, but calculated results are not clearly persisted for analytics
- Emission factors page still exposes placeholder CRUD controls in some tabs
- Several services manually compute `MAX(id) + 1`, which creates race-condition risk on concurrent inserts

Recent fixed areas worth remembering:

- Lands/camps/landmaps CRUD is now wired and backend supplies explicit IDs where the DB does not
- Sidebar active-state logic was fixed so `/lands/weather` does not highlight two items
- Geo page now shows the full reference chain and visible load errors
- Infra delete URL/ID mapping was corrected
- Activity CSV import now preserves repeated valid records as separate `log_activities_detail` rows and reports skipped rows by reason

## Build And Verification Snapshot

Docs say these commands have passed recently:

- `npm run prisma:generate --workspace=backend`
- `npm run build --workspace=backend`
- `npm run build --workspace=frontend`
- `npm run build`
- On 2026-06-09, `npm run prisma:generate --workspace=backend`, `npm run build --workspace=backend`, and `npm run build --workspace=frontend` passed after the Carbon preparation / Carbon Footprint queue split.

Known non-blocking warning:

- Vite bundle-size warning due to PDF/Excel-related libraries

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
3. If working on Carbon Analytics, verify whether you are expected to stay in mock mode or re-enable live API mode.
4. After major changes, update this file so future work can continue faster.

After finishing work from a user prompt:

1. Decide whether the prompt changed project memory in a meaningful way.
2. If yes, add a short update to this file in the same task.
3. Keep the note factual and compact so this file stays easy to scan.
