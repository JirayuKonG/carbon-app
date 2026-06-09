# Bug Tracking Log

Last updated: 2026-06-05

Use the checkboxes to track what is fixed. Keep new findings here so future work can restart quickly.

## Done

- [x] BUG-001: Static lands routes were shadowed by `GET /api/lands/:id`.
  - Impact: requests such as `GET /api/lands/camps`, `GET /api/lands/landmaps`, and `GET /api/lands/mapping` could be parsed as `id = "camps"` / `"landmaps"` / `"mapping"` and fail with `ParseIntPipe` before reaching the intended handler.
  - Evidence: `backend/src/modules/lands/lands.controller.ts` had `@Get(':id')` before static sub-routes.
  - Fix: moved `@Get(':id')`, `@Put(':id')`, and `@Delete(':id')` after all static `/lands/...` routes.
  - Verify: `npm run build --workspace=backend`.

- [x] BUG-008: Weather navigation highlighted two sidebar items.
  - Impact: when visiting `/lands/weather`, both `พื้นที่เพาะปลูก` and `ข้อมูลสภาพอากาศ` appeared active because `/lands/weather` starts with `/lands`.
  - Evidence: `frontend/src/components/layout/Sidebar.tsx` used broad `startsWith(item.path)` matching.
  - Fix: sidebar now chooses the longest matching route, so `/lands/weather` wins over `/lands`. Mobile nav links also use exact matching with `end`.
  - Verify: frontend build now passes.

- [x] BUG-010: Geo page did not show the full database reference chain.
  - Impact: the page queried subdistricts but did not render the subdistrict table, and provinces showed raw `geography_id` instead of a geography/region name.
  - Evidence: `frontend/src/features/geo/GeoPage.tsx` had `sLoading` and `subdistrictColumns` unused.
  - Fix: added geography filter from `/api/geo/geographies`, rendered region names in the province table, and added the subdistrict table.
  - Verify: frontend build now passes.

- [x] BUG-011: Geo page hid API/database loading failures.
  - Impact: when PostgreSQL/API calls failed, the Geo page could look like it simply had no province/district/subdistrict data.
  - Evidence: Geo React Query calls did not render their `error` state.
  - Fix: `frontend/src/features/geo/GeoPage.tsx` now shows a visible PostgreSQL/API error banner when any Geo query fails.
  - Verify: frontend build now passes.

- [x] BUG-004: Frontend build failed.
  - Impact: production frontend could not be built.
  - Evidence: earlier `npm run build --workspace=frontend` failed with TypeScript errors.
  - Fix: current frontend sources now compile successfully.
  - Verify: `npm run build --workspace=frontend` passed on 2026-05-25.

- [x] BUG-012: Lands, camps, and landmaps could not be inserted from the UI.
  - Impact: add/edit/delete buttons existed on the lands page, but actions were console-only or missing, and PostgreSQL rejected inserts because `land_id`, `land_camp_id`, and `landmap_id` have no database default.
  - Evidence: `frontend/src/features/lands/LandsPage.tsx` only logged edit/delete actions; PostgreSQL metadata reports no default/identity for the three primary key columns.
  - Fix: wired real create/update/delete modals and mutations for lands, camps, and landmaps; added landmap `PUT`/`DELETE` routes; backend now supplies explicit next IDs for the three tables.
  - Verify: backend build passed, frontend build passed, and a temporary PostgreSQL create-update-delete smoke test passed for all three tables with cleanup.

- [x] BUG-005: Infrastructure delete URLs/IDs were wrong for some resource types.
  - Impact: delete actions could call invalid paths such as `/api/infra/service_areas/:id`; department delete could send an undefined ID because the row key is `departments_id`, not `department_id`.
  - Evidence: current `frontend/src/features/infra/InfraPage.tsx` now uses `endpointByType` with `/infra/service-areas` and `idKeyByType.department = 'departments_id'`.
  - Fix: infrastructure actions were normalized to explicit endpoint and ID maps before calling `del()`.
  - Verify: static review on 2026-05-30 confirmed the current UI delete path and ID mapping are correct.

- [x] BUG-015: Activity CSV import failed for larger Step 4 payloads.
  - Impact: the CSV wizard Step 4 `Validate` import could fail with `request entity too large` or a generic internal server error before all rows were imported.
  - Evidence: `POST /api/activities/import` sends mapped CSV rows as one JSON payload, while the backend bootstrap still allowed Nest's default body parser to run with its smaller limit.
  - Fix: `backend/src/main.ts` disables the default body parser and installs `50mb` JSON/urlencoded parsers before routes are registered; `backend/src/modules/activities/activities.controller.ts` now returns a clear `400` if mappings/rows are missing; `frontend/src/features/activities/ActivitiesPage.tsx` now splits activity CSV import into approximately `20 KB` chunks and merges the chunk results.
  - Verify: `npm run build --workspace=backend`; `npm run build --workspace=frontend`.

- [x] BUG-016: Activity CSV import made imported row counts hard to understand.
  - Impact: users could prepare more rows than appeared after import, and repeated real-world activities could look like missing data because import grouping and skip reasons were not explicit enough.
  - Evidence: activity CSV import reused headers by `land_id + date + activity type + land type + sugarcane type`, accepted missing/invalid dates by falling back to current dates, and reported skipped rows as raw errors without a clear reason summary.
  - Fix: import now treats repeated activity rows as valid separate `log_activities_detail` records; requires a valid `log_act_detail_create_at`; skips only rows with missing land/camp identity or bad date before creating related data; reuses the latest `activities_header` per `land_id`; keeps camp-only rows through internal `AUTO-CAMP-*` placeholder land while the UI displays `เบิกเข้าไร่`; and groups skip reasons in the import result.
  - Verify: `npm run build --workspace=backend`; `npm run build --workspace=frontend`.

## Open

- [ ] BUG-002: PostgreSQL insert can fail for geo tables because primary keys have no Prisma default.
  - Impact: `POST /api/geo/provinces`, `POST /api/geo/districts`, and `POST /api/geo/subdistricts` create records without sending `provinces_id`, `districts_id`, or `subdistricts_id`, but Prisma schema marks those IDs as required without `@default(autoincrement())`.
  - Evidence: `backend/src/prisma/schema.prisma:20`, `:30`, `:39`; create calls in `backend/src/modules/geo/geo.service.ts:34`, `:46`, `:54`.
  - PostgreSQL check: `information_schema.columns` reports `column_default = null` and `is_identity = NO` for all three ID columns.
  - Next: if these are fixed government codes, require the ID in the DTO/UI before insert. If the app should create arbitrary geo rows, add database sequences/identity defaults first, then update Prisma.

- [ ] BUG-003: API bodies are passed as `any`, so numeric fields from forms may reach Prisma as strings.
  - Impact: PostgreSQL/Prisma inserts can fail with type errors for fields like `factory_id`, `service_area_id`, `land_camp_id`, latitude/longitude, decimals, and numeric foreign keys when HTML form values are submitted as strings.
  - Evidence: raw request bodies still flow into Prisma in `backend/src/modules/infra/infra.controller.ts:12`, `:20`, `:26`; `backend/src/modules/users/users.controller.ts:13`, `:17`; `backend/src/modules/farmers/farmers.controller.ts:21`; `backend/src/modules/lands/lands.controller.ts:20`, `:26`, `:34`, `:45`; `backend/src/modules/weather/weather.controller.ts:17`; `backend/src/modules/emission-factors/emission-factors.controller.ts:12`, `:18`, `:23`, `:28`, `:35`, `:59`; `backend/src/modules/geo/geo.controller.ts:37`, `:52`, `:57`.
  - Update 2026-05-30: `ActivitiesService` now normalizes many number/date fields, so this bug is no longer best evidenced by the activities module.
  - Next: add DTOs with `class-transformer` conversions or service-side normalizers before Prisma writes.

- [ ] BUG-006: Add/edit modal save buttons are visual only in some pages.
  - Impact: user clicks "บันทึก" but no insert request is sent, which can look like PostgreSQL cannot insert.
  - Evidence: the weather manual-entry modal still has unnamed inputs and a plain button with no submit handler in `frontend/src/features/weather/WeatherPage.tsx:132-161`.
  - Update 2026-05-30: infrastructure save is now wired through `saveMut` in `frontend/src/features/infra/InfraPage.tsx:45-79`, so this bug currently remains on the weather page only.
  - Next: wrap the weather modal in a real form, add field names/state, call `POST /api/lands/weather`, and invalidate `weather-records`.

- [ ] BUG-007: CO2e calculation result is logged but not persisted.
  - Impact: activity detail insert succeeds, calculation status changes to done/error, but calculated CO2e values are not stored for analytics.
  - Evidence: `backend/src/modules/activities/activities.service.ts` only updates `log_act_detail_calStatus_id`; schema also has no CO2e result columns on `log_activities_detail`.
  - Next: confirm intended schema table/columns for calculation outputs, then persist result or update analytics to calculate on read.

- [ ] BUG-009: Backend cannot authenticate to PostgreSQL with current `.env`.
  - Impact: Geo API endpoints cannot read `geographies`, `provinces`, `districts`, or `subdistricts` until the database credentials are corrected.
  - Evidence: Prisma connection check from `backend` failed with `Authentication failed against database server at localhost`. Re-tested on 2026-05-20 with the same result.
  - Update 2026-05-25: current `.env` points to Aiven PostgreSQL and lands-table access works when network access is allowed. Re-test Geo endpoints specifically before closing this bug.

- [ ] BUG-013: Emission factors page exposes placeholder CRUD controls for EF, GWP, CF Types, and Groups.
  - Impact: users see add/edit/delete controls on the emission-factors screen, but most of them do nothing or only work for units/unit prefixes, which makes the page look broken.
  - Evidence: action buttons for non-unit tabs use empty handlers in `frontend/src/features/emission-factors/EmissionFactorsPage.tsx:124`, `:131`, `:138`, `:144`; the top add button only opens a modal when `tab === 'units'` at `frontend/src/features/emission-factors/EmissionFactorsPage.tsx:190`.
  - Backend gap: `backend/src/modules/emission-factors/emission-factors.controller.ts` has no delete routes for `gwp`, `cf-types`, or `groups`, so complete CRUD is not available even if the frontend is wired.
  - Next: either hide unfinished controls or implement real forms/mutations and matching backend delete endpoints for each tab.

- [ ] BUG-014: Several services manually compute `MAX(id) + 1`, creating a race condition under concurrent inserts.
  - Impact: two requests that create the same resource type at the same time can calculate the same next ID and fail with duplicate primary-key errors.
  - Evidence: manual ID generation appears in `backend/src/modules/infra/infra.service.ts:16`, `:48`, `:78`; `backend/src/modules/users/users.service.ts:31`, `:65`; `backend/src/modules/farmers/farmers.service.ts:39`; `backend/src/modules/emission-factors/emission-factors.service.ts:72`, `:112`; `backend/src/modules/activities/activities.service.ts:139`, `:217`, plus import helper ID allocators later in the same file.
  - Update 2026-06-08: `backend/src/prisma/schema.prisma` was re-introspected from the live Aiven database, so the old Prisma autoincrement mismatch is no longer the main issue. The remaining risk is that the live database still exposes many primary keys with no default/identity, so concurrent `MAX(id) + 1` writes can still collide.
  - Next: replace manual next-ID allocation with database-managed sequences/identity where possible, and keep manual ID assignment only on tables whose real database schema must stay without defaults.

## Verification Notes

- `npm run build --workspace=backend`: passed after BUG-001 fix and again on 2026-05-30.
- `npm run build --workspace=backend`: passed again on 2026-06-05 after activity CSV import rule changes.
- `npm run build --workspace=backend`: passed again on 2026-06-08 after syncing Prisma schema from the live Aiven PostgreSQL database and updating affected create flows.
- `npm run prisma:generate --workspace=backend`: passed.
- `npm run build --workspace=frontend`: passed on 2026-05-25 and again on 2026-05-30.
- `npm run build --workspace=frontend`: passed again on 2026-06-05 after activity CSV import UI updates.
- PostgreSQL metadata confirmed BUG-002 for the live database configured by `backend/.env`.
- PostgreSQL metadata confirmed `land_id`, `land_camp_id`, and `landmap_id` also have no default/identity; BUG-012 backend workaround is in place.
- Static review on 2026-05-30 confirmed BUG-005 is fixed, BUG-006 is now weather-only, and added BUG-013 and BUG-014.
