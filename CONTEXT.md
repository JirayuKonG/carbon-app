# Project Context Memory

Last updated: 2026-06-16

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
- The newest SQL snapshot currently stored in the repo is `managementDataSystem_forCalculate_3.0_06152026_postgres.sql`.
- The live database may still be ahead of that SQL snapshot, so when schema behavior is unclear, prefer `schema.prisma` over assumptions from older SQL exports.
- Repo notes from the 2026-06-08 sync identify these important live-database tables in the current Prisma model set:
  - `activities_fileNameUse`
  - `activities_resourceOther`
  - `carbon_process_queue`
  - `carbon_roundCal`
  - `carbon_typeCal`
- Some tables do not have database-generated primary keys, so create flows still need extra care before assuming `autoincrement()`.

Recent Prisma sync update from user prompt on 2026-06-15:

- Prompt summary: the user provided a newer database snapshot `managementDataSystem_forCalculate_3.0_06152026_postgres` and asked to update Prisma so the repo is ready for upcoming work.
- Result: `backend/src/prisma/schema.prisma` now includes the newer database structures from `managementDataSystem_forCalculate_3.0_06152026_postgres.sql`, including:
  - new models `lands_camps_groups`, `activities_productYear`, `carbon_soc`, and `carbon_soilImprovementPlants`
  - new foreign-key field `land_camp_group_id` on `lands_camps`
  - new foreign-key field `act_productYear_id` on `log_activities_detail`
  - new Carbon Credit result fields on `carbon_process_queue`: `carbon_process_queue_resultValueCreditCalc`, `unit_prefix_id_resultValueCreditCalc`, and `unit_id_resultValueCreditCalc`
- Additional Prisma alignment: relation names were made explicit where `carbon_process_queue`, `carbon_soc`, and `carbon_soilImprovementPlants` point to `units` or `units_prefixs` multiple times, so Prisma Client generation succeeds cleanly.
- Source of truth: `backend/src/prisma/schema.prisma` and `managementDataSystem_forCalculate_3.0_06152026_postgres.sql`.
- Verification: `npm run prisma:generate --workspace=backend` and `npm run build --workspace=backend`.
- Limitation: this task prepared the ORM layer only; no backend service/module logic was added yet for the new SOC, soil-improvement plant, product-year, or camp-group tables.

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
- `/calculate/usage`: input usage summary page for fertilizer, fuel, and other activity factors by camp/field/year
- `/calculate/footprint`: carbon process queue page for unit/volume/soil/SOC preparation and calculation actions
- `/calculate/credit`: carbon credit analysis page
- `/dashboard`: older GHG dashboard
- `/geo`, `/infra`, `/users`, `/farmers`, `/lands`, `/lands/weather`
- `/emission-factors`
- `/activities/logs`, `/activities/resources`, `/activities/types`, `/activities/manage`

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
    - `/calculate/usage`
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
  - `/activities/types`
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
- `frontend/src/features/cf-dashboard/pages/InputUsageSummaryPage.tsx` shows the pre-footprint input usage summary for fertilizer, fuel, and other activity factors.
- `frontend/src/features/cf-dashboard/pages/CarbonFootprintQueuePage.tsx` is the queue-driven Carbon Footprint preparation/calculation page.
- `frontend/src/features/cf-dashboard/pages/CarbonCreditPage.tsx` is a comparison page for 4 baseline years plus 1 project year.
- Repo notes say preparation metadata is intentionally stored without adding new database columns, reusing existing queue and result-unit fields.
- Activity imports now maintain imported-file history through `activities_fileNameUse`.
- Backend bootstrap in `backend/src/main.ts` installs `50mb` JSON and URL-encoded body parsers to support large import payloads.

Recent input-usage summary page update from user prompt on 2026-06-15:

- Prompt summary: add a new page between `เตรียมข้อมูล Carbon` and `Carbon Footprint` that summarizes factor usage by camp, field, and year, using real database data while treating the newly added Excel files as reference examples only.
- Result: `/calculate/usage` now renders `frontend/src/features/cf-dashboard/pages/InputUsageSummaryPage.tsx`, with shared filters for year/camp/field/view density, fertilizer and fuel sections, other-factor summary, and a 2-4 target comparison workspace for camp or field comparison.
- Backend behavior: `GET /api/activities/input-usage-summary` in `backend/src/modules/activities/activities.controller.ts` and `backend/src/modules/activities/activities.service.ts` aggregates `log_activities_detail` with activity header, land/camp, resource, unit, status, and optional `carbon_process_queue_info` preparation data.
- Unit behavior: fertilizer is normalized to `kg`, fuel is normalized to `L`, and unknown unit conversions are counted as warnings instead of being added to the kg/L totals.
- Source-of-truth files: `frontend/src/features/cf-dashboard/pages/InputUsageSummaryPage.tsx`, `frontend/src/App.tsx`, `frontend/src/components/layout/Sidebar.tsx`, `backend/src/modules/activities/activities.controller.ts`, and `backend/src/modules/activities/activities.service.ts`.
- Verification: `npm run build --workspace=backend` and `npm run build --workspace=frontend`.

Recent input-usage summary readability update from user prompt on 2026-06-15:

- Prompt summary: refine the `สรุปการใช้ปัจจัย` page so the fertilizer section looks closer to the attached xlsx example and make the whole page easier to scan because the previous section colors felt too similar.
- Result: `frontend/src/features/cf-dashboard/pages/InputUsageSummaryPage.tsx` now renders the fertilizer section with a workbook-style table grouped by year and fertilizer item, including cane type, total kg, area, and warning columns per year group. The page header, shared-filter area, KPI cards, fertilizer block, fuel block, comparison workspace, and other-factor block now use more distinct color palettes and section framing to reduce the “everything blends together” feel.
- Backend behavior: `backend/src/modules/activities/activities.service.ts` now includes sugarcane type labels in the input-usage summary response so the workbook-style fertilizer table can show `ประเภทอ้อย` closer to the reference layout.
- Source of truth: `frontend/src/features/cf-dashboard/pages/InputUsageSummaryPage.tsx` and `backend/src/modules/activities/activities.service.ts`.
- Verification: `npm run build --workspace=frontend` and `npm run build --workspace=backend`.

Recent fertilizer-workbook usability update from user prompt on 2026-06-15:

- Prompt summary: keep the large fertilizer workbook table from pushing the rest of the page downward, remove the unnecessary dedicated camp column, and make workbook column titles readable in full instead of visually cut off.
- Result: `frontend/src/features/cf-dashboard/pages/InputUsageSummaryPage.tsx` now keeps the fertilizer workbook table inside its own scrollable frame with internal vertical and horizontal scrolling, plus an expand/collapse control for the frame. The dedicated `ไร่ / Camp` workbook column was removed, while camp information is still shown as supporting text inside the land cell. Fertilizer-item headers now use larger minimum widths and wrapped multi-line text so long names are readable without truncation.
- Additional behavior: the workbook frame now supports normal wheel scrolling for up/down and `Shift + Wheel` for left/right movement inside the table area.
- Source of truth: `frontend/src/features/cf-dashboard/pages/InputUsageSummaryPage.tsx`.
- Verification: `npm run build --workspace=frontend`.

Recent input-usage header/comparison workspace update from user prompt on 2026-06-15:

- Prompt summary: make the top `สรุปการใช้ปัจจัย` header frame smaller/tidier instead of large, and expand the `เปรียบเทียบไร่ / แปลง` area so users can add more comparison cards while still being able to read the text.
- Result: `frontend/src/features/cf-dashboard/pages/InputUsageSummaryPage.tsx` now uses a more compact top hero/header card with smaller padding, badge sizing, and supporting chips while keeping the same information. The comparison workspace now supports up to 10 cards instead of 4 and lays them out in multiple responsive rows (`1 / 2 / 3 / 4` columns by screen size) instead of over-compressing everything into a single row.
- Additional behavior: the comparison area shows a current usage counter and keeps card text readable by allowing more vertical wrapping in values and top-item summaries.
- Source of truth: `frontend/src/features/cf-dashboard/pages/InputUsageSummaryPage.tsx`.
- Verification: `npm run build --workspace=frontend`.

Recent lands bulk-subdistrict management update from user prompt on 2026-06-15:

- Prompt summary: the user asked whether the `lands` table can manage subdistrict data and requested an easy-to-find tool under `พื้นที่เพาะปลูก` to change `subdistrict code` for many rows at once, preferably using selected lands as the main driver.
- Result: `frontend/src/features/lands/LandsPage.tsx` still keeps the existing per-row edit flow for subdistricts, and now also renders a new `จัดการตำบลหลายแปลง` panel directly on the `แปลงที่ดิน` tab. Users can select lands by checkbox, select all rows in the current camp-filtered list, choose province/district/subdistrict once, preview the zip code, and bulk-apply the new subdistrict to all selected lands.
- Backend behavior: `PUT /api/lands/bulk/subdistrict` in `backend/src/modules/lands/lands.controller.ts` and `backend/src/modules/lands/lands.service.ts` validates the selected land IDs, validates the destination subdistrict, updates `subdistrict_code` for all selected `lands` rows, and copies the subdistrict zip code onto `lands.zip_code` when available.
- Source of truth: `frontend/src/features/lands/LandsPage.tsx`, `backend/src/modules/lands/lands.controller.ts`, and `backend/src/modules/lands/lands.service.ts`.
- Verification: `npm run build --workspace=backend` and `npm run build --workspace=frontend`.
- Related docs updated: `CONTEXT.md` and `COMPONENT_PJ.md` updated for project memory and lookup guidance. No schema or route-structure docs needed beyond the API note.

Follow-up usability fix on 2026-06-15 for the same lands bulk-subdistrict tool:

- Prompt summary: the user reported that updating selected lands did not work because the panel still behaved as if no lands were selected.
- Result: `frontend/src/features/lands/LandsPage.tsx` now supports selecting lands by clicking the entire row in addition to the checkbox, and the checkbox click path explicitly stops row propagation so selection no longer feels broken or inconsistent between row-click and checkbox-click behavior.
- Additional behavior: the empty-state helper text in the bulk-subdistrict panel now tells users they can select by checkbox, by row click, or by the bulk-select button.
- Verification: `npm run build --workspace=frontend`.

Follow-up completion-notice update on 2026-06-15 for the same lands bulk-subdistrict tool:

- Prompt summary: after bulk-updating subdistricts from the `พื้นที่เพาะปลูก` page, the user wanted a visible success notification when the process finishes.
- Result: `frontend/src/main.tsx` now wraps the app with `ToastProvider`, and `frontend/src/features/lands/LandsPage.tsx` now shows a success toast after `อัปเดตตำบลให้แปลงที่เลือก` completes.
- Additional behavior: the toast message includes both the number of updated lands and the destination subdistrict name, plus zip code when available.
- Verification: `npm run build --workspace=frontend`.

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

Recent Carbon Footprint card-page update from user prompt on 2026-06-13:

- Prompt summary: on the `Carbon Footprint -> คำนวณรายการที่เลือก` card page, change the visible/default generic calculation result unit from `kgCO2e` to `tCO2e`, keep the `เพิ่มหน่วยใหม่` button visible but disabled for now, and make the fuel-row EF selector inside the table searchable as well as selectable.
- Result: `frontend/src/features/cf-dashboard/pages/CarbonFootprintQueuePage.tsx` now defaults the `generic_ef` preview/result-unit selection to the `tCO2e` group so the frontend preview and submitted result-unit preference align with tonne-based output instead of showing kilogram-scale values unchanged.
- Additional behavior: the `เพิ่มหน่วยใหม่` button is still rendered in the result-unit section, but it is disabled with explanatory text because this workflow should use only the existing `kgCO2e` and `tCO2e` units for now.
- Additional behavior: fuel EF selection in the calculation table now uses a searchable input with browser suggestions (`datalist`) so users can type and choose EF rows directly in-table instead of scrolling a long native select list.
- Source of truth: `frontend/src/features/cf-dashboard/pages/CarbonFootprintQueuePage.tsx`.
- Verification: `npm run build --workspace=frontend`.
- Related docs updated: `CONTEXT.md` updated for project memory. No schema or backend API changes were required.

Recent Carbon Footprint preview/unit correction from user prompt on 2026-06-13:

- Prompt summary: on the same `Carbon Footprint -> คำนวณรายการที่เลือก` card page, switch the generic-EF default-system label back to `kgCO2e` and make the frontend preview formula show tonne conversion only when the selected result unit is `tCO2e`, using `(activityAmount * selectedEfTotal) / 1000`.
- Result: `frontend/src/features/cf-dashboard/pages/CarbonFootprintQueuePage.tsx` now treats `generic_ef` default output as `kgCO2e` again, matching the backend generic calculation base unit. If the user selects a `tCO2e` result unit, the frontend preview still converts the preview value from kg to tonne before display and submission.
- Additional behavior: the fuel preview formula text now reflects the actual conversion path shown to the user, for example `activityAmount x EF_total` for `kgCO2e` and `(activityAmount x EF_total) / 1000` for `tCO2e`.
- Source of truth: `frontend/src/features/cf-dashboard/pages/CarbonFootprintQueuePage.tsx`.
- Verification: `npm run build --workspace=frontend`.
- Related docs updated: `CONTEXT.md` updated for project memory. No backend code or schema changes were required.

Recent Carbon Footprint preview/card readability update from user prompt on 2026-06-13:

- Prompt summary: refine the same `Carbon Footprint -> คำนวณรายการที่เลือก` card page so the preview formula clearly follows the selected result unit, and make the EF selection area wide/readable enough to show the full selected text.
- Result: `frontend/src/features/cf-dashboard/pages/CarbonFootprintQueuePage.tsx` now shows the generic-EF preview formula as `activityAmount * selectedEfTotal` for `kgCO2e` and `(activityAmount * selectedEfTotal) / 1000` for `tCO2e`, matching the requested preview wording.
- Additional behavior: the fuel EF selection table was widened, the searchable EF input now keeps a wrapped full-text summary below the field, and the `EF ที่เลือก` column now wraps long names/details instead of visually cutting them off inside the card/modal.
- Source of truth: `frontend/src/features/cf-dashboard/pages/CarbonFootprintQueuePage.tsx`.
- Verification: `npm run build --workspace=frontend`.
- Related docs updated: `CONTEXT.md` updated for project memory. No backend code or schema changes were required.

Recent Carbon Footprint fuel-preview formatting update from user prompt on 2026-06-13:

- Prompt summary: make the fuel preview on `Carbon Footprint -> คำนวณรายการที่เลือก` show unit-specific numeric output such as `0.002302 tCO2e` or `2.302 kgCO2e`, and ensure the EF chooser shows full option text instead of clipping it.
- Result: `frontend/src/features/cf-dashboard/pages/CarbonFootprintQueuePage.tsx` now formats generic fuel-preview results with 6 decimals for `tCO2e` and 3 decimals for `kgCO2e`, so the preview card better matches the requested examples.
- Additional behavior: the EF chooser no longer relies on the browser `datalist`; it now renders an in-app searchable suggestion panel with wrapped full labels, which makes long EF names/details readable and selectable inside the modal.
- Source of truth: `frontend/src/features/cf-dashboard/pages/CarbonFootprintQueuePage.tsx`.
- Verification: `npm run build --workspace=frontend`.
- Related docs updated: `CONTEXT.md` updated for project memory. No backend code or schema changes were required.

Recent Carbon Footprint split-pane update from user prompt on 2026-06-13:

Recent Carbon Footprint fertilizer manual-formula update from user prompt on 2026-06-14:

- Prompt summary: on `คำนวณ Carbon -> Carbon Footprint -> คำนวณรายการที่เลือก`, allow fertilizer rows that do not have a parseable `N-P2O5-K2O` formula in the item name to be calculated by manually entering `N`, `P2O5`, and `K2O` in the card/modal page, with decimal input up to 4 places, based on `CONCLUSION_CARBON_CAL_TABLE.md`.
- Result: `frontend/src/features/cf-dashboard/pages/CarbonFootprintQueuePage.tsx` now shows a manual `N-P2O5-K2O` input section for fertilizer rows whose formula cannot be detected from the fertilizer name. The frontend preview uses those manual values immediately when they are complete and valid.
- Additional behavior: the modal validates that `N`, `P2O5`, and `K2O` are all provided, are numeric, are not negative, and sum to at most `100`. It also shows the derived filler percentage and blocks submission until the required manual formula is complete.
- Backend alignment: `backend/src/modules/activities/activities.service.ts` and `backend/src/modules/activities/activities.controller.ts` now accept the manual fertilizer percentages in the queue-calculation request and use them as a fallback when the fertilizer name does not contain a parseable chemical formula.
- Source of truth: the card-page UI and preview behavior live in `frontend/src/features/cf-dashboard/pages/CarbonFootprintQueuePage.tsx`; the persisted calculation behavior lives in `backend/src/modules/activities/activities.service.ts`.
- Verification: `npm run build --workspace=frontend` and `npm run build --workspace=backend`.
- Limitation kept intentionally: the main queue table can still show the original blocked input status before modal entry because the manual formula is supplied inside the calculation modal, not stored back onto the queue row itself.
- Related docs updated: `CONTEXT.md` updated for project memory. No schema/database changes were made.

Recent Carbon Footprint card-page warning-layout update from user prompt on 2026-06-14:

- Prompt summary: on `คำนวณ Carbon -> Carbon Footprint -> คำนวณรายการที่เลือก`, when users select mixed rows such as fertilizer, organic fertilizer, and fuel together, the warning text at the bottom of the card page can overflow beyond the modal/card boundary.
- Result: `frontend/src/features/cf-dashboard/pages/CarbonFootprintQueuePage.tsx` now keeps the preview modal body in a constrained flex/scroll layout and renders bottom warnings inside a full-width warning box within the card page instead of as loose text lines below the action buttons.
- Additional behavior: long warning content now wraps inside the modal and remains visible together with the footer buttons instead of visually spilling outside the card page.
- Source of truth: `frontend/src/features/cf-dashboard/pages/CarbonFootprintQueuePage.tsx`.
- Verification: `npm run build --workspace=frontend`.

Recent Carbon preparation bulk-status performance update from user prompt on 2026-06-14:

- Prompt summary: on `คำนวณ Carbon -> เตรียมข้อมูล Carbon`, the bulk action `ย้ายเป็นกำลังเตรียมข้อมูล` could fail with `timeout of 30000ms exceeded` when moving many rows from `นำเข้าข้อมูลแล้ว` to `กำลังเตรียมข้อมูล`.
- Result: `backend/src/modules/activities/activities.service.ts` now handles bulk manual/workflow status transitions with a batch-oriented path instead of looping one row at a time. The service now validates the selected rows first, updates detail statuses in bulk, and creates or updates `carbon_process_queue` records in bulk when moving rows into the preparing state.
- Frontend alignment: `frontend/src/features/cf-dashboard/pages/CalculatePage.tsx` now gives the single-row manual-status request a 2-minute timeout and the bulk manual-status request a 10-minute timeout, so large valid requests are less likely to fail only because of the old 30-second client timeout.
- Source of truth: bulk status-transition performance behavior now lives in `backend/src/modules/activities/activities.service.ts`, while the calling timeout behavior for the `เตรียมข้อมูล Carbon` page lives in `frontend/src/features/cf-dashboard/pages/CalculatePage.tsx`.
- Verification: `npm run build --workspace=backend` and `npm run build --workspace=frontend`.
- Limitation kept intentionally: the page still waits for the backend to finish before showing success, so extremely large batches can still take noticeable time, but they should no longer pay the previous per-row transition overhead or hit the default 30-second client timeout as easily.

Recent Carbon preparation-queue status timeout update from user prompt on 2026-06-14:

- Prompt summary: on `คำนวณ Carbon -> เตรียมข้อมูล Carbon`, inside the `คิวเตรียมข้อมูล` section, large batch status changes from `กำลังเตรียมข้อมูล -> นำเข้าข้อมูลแล้ว` and `กำลังเตรียมข้อมูล -> พร้อมคำนวณมาตรฐาน` could still hit `timeout of 30000ms exceeded`, including the card-page flow that applies actions to checked rows.
- Result: `frontend/src/features/cf-dashboard/pages/CarbonFootprintQueuePage.tsx` now gives manual-status transitions a longer request timeout for both the bulk status buttons (`ย้ายกลับไปนำเข้า`, `ย้ายเป็นพร้อมคำนวณ`) and the bulk-preparation card-page checkbox flow that auto-moves prepared rows to `พร้อมคำนวณมาตรฐาน`.
- Backend alignment: `backend/src/modules/activities/activities.controller.ts` and `backend/src/modules/activities/activities.service.ts` now explicitly treat `นำเข้าข้อมูลแล้ว` as a supported manual-status target in the typed controller/service signatures, matching the existing runtime behavior of the queue-preparation UI.
- Source of truth: `frontend/src/features/cf-dashboard/pages/CarbonFootprintQueuePage.tsx` for client timeout behavior, and `backend/src/modules/activities/activities.controller.ts` plus `backend/src/modules/activities/activities.service.ts` for accepted status-transition targets.
- Verification: `npm run build --workspace=frontend` and `npm run build --workspace=backend`.

Recent Carbon preparation queue visual-separation update from user prompt on 2026-06-14:

Recent calculation-status naming update from user prompt on 2026-06-15:

- Prompt summary: rename the calculation status label `คำนวณแล้ว(มาตรฐาน,CFP)` to `คำนวณแล้ว(มาตรฐาน,C-credit)` across backend and frontend because the current project meaning treats `มาตรฐาน` and `CFP` as overlapping, while the combined status should communicate `มาตรฐาน` plus `C-credit`.
- Result: the canonical calculated-combined status name is now `คำนวณแล้ว(มาตรฐาน,C-credit)` in `backend/src/modules/activities/activities.service.ts` and `frontend/src/features/activities/cal-status.ts`.
- Compatibility behavior: the backend status bootstrap still recognizes legacy names `คำนวณแล้ว(มาตรฐาน,CFP)` and `คำนวณแล้ว(มาตรฐาน+CFP)` and upgrades them to the new canonical label, while the frontend still renders old saved values as the new label until backend normalization runs.
- Frontend alignment: dashboard cards, filters, and status-facing helper text that referenced the old combined label now show `คำนวณแล้ว(มาตรฐาน,C-credit)` in the activity pages and Carbon calculation pages.
- Source of truth: combined calculation-status naming now lives in `backend/src/modules/activities/activities.service.ts` and `frontend/src/features/activities/cal-status.ts`.
- Verification: pending focused frontend and backend builds for this rename-only change.

- Prompt summary: on `คำนวณ Carbon -> เตรียมข้อมูล Carbon`, the lower `คิวเตรียมข้อมูลทั้งหมด` area looked too visually similar to the upper `เตรียมข้อมูล Carbon` area, making the queue section harder to recognize quickly.
- Result: `frontend/src/features/cf-dashboard/pages/CalculatePage.tsx` now wraps the embedded queue workspace in a distinct warm-toned section with its own heading and descriptive label, while `frontend/src/features/cf-dashboard/pages/CarbonFootprintQueuePage.tsx` applies a matching warm-toned card treatment when rendered in embedded preparation mode.
- Additional behavior: the lower queue workspace now reads as a separate operational area from the upper import/preparation section without changing the actual workflow or data behavior.
- Source of truth: `frontend/src/features/cf-dashboard/pages/CalculatePage.tsx` and `frontend/src/features/cf-dashboard/pages/CarbonFootprintQueuePage.tsx`.
- Verification: `npm run build --workspace=frontend`.

Recent Carbon Footprint calculation-run timeout update from user prompt on 2026-06-15:

- Prompt summary: on `คำนวณ Carbon -> Carbon Footprint`, the card-page flow behind `คำนวณรายการทั้งหมดที่เลือก` needs to better tolerate long-running calculations and large selected batches because each row can involve multiple calculation parts before its status is updated.
- Result: `frontend/src/features/cf-dashboard/pages/CarbonFootprintQueuePage.tsx` now sends each queue-row `calculate` request with a dedicated long timeout (`20 minutes`) instead of relying on the default `30 seconds` API timeout.
- Additional behavior: the frontend no longer inserts the old fixed `120ms` delay between row calculations in the bulk run loop, reducing cumulative overhead when many rows are selected.
- Status alignment: the same per-row calculate request still performs the full existing backend flow for `calculate + save result + update status`, so extending the request tolerance also extends tolerance for the status-update part of the run without changing the calculation logic itself.
- Source of truth: `frontend/src/features/cf-dashboard/pages/CarbonFootprintQueuePage.tsx`.
- Verification: `npm run build --workspace=frontend`.
- Limitation kept intentionally: this run flow still sends one request per selected queue row so users can keep row-specific EF selections, fertilizer factor choices, and manual fertilizer formula inputs; this update improves tolerance for long-running rows rather than replacing that row-by-row architecture.

- Prompt summary: on the same `Carbon Footprint -> คำนวณรายการที่เลือก` card page, keep the preview-result behavior aligned with the selected unit and make the left-hand card area adjustable because it felt too narrow.
- Result: `frontend/src/features/cf-dashboard/pages/CarbonFootprintQueuePage.tsx` now keeps the generic fuel preview result formatted by selected unit and adds a draggable vertical divider between the left control panel and the right preview panel in the calculation modal.
- Additional behavior: drag-resize is active on extra-large viewports only, with the left pane clamped to a safe width range so the modal remains usable while still letting users widen the EF-selection side.
- Source of truth: `frontend/src/features/cf-dashboard/pages/CarbonFootprintQueuePage.tsx`.
- Verification: `npm run build --workspace=frontend`.
- Related docs updated: `CONTEXT.md` updated for project memory. No backend code or schema changes were required.

Recent Carbon Footprint preview-reason update from user prompt on 2026-06-13:

- Prompt summary: clarify why `preview result` may or may not change numerically when the user switches between `kgCO2e` and `tCO2e` in the `คำนวณรายการที่เลือก` modal.
- Result: `frontend/src/features/cf-dashboard/pages/CarbonFootprintQueuePage.tsx` now adds a note in the generic fuel preview that explains whether the preview value was converted between `kgCO2e` and `tCO2e`, or whether no `/1000` conversion was needed because the selected EF already uses `tCO2e` as its source result unit.
- Source of truth: `frontend/src/features/cf-dashboard/pages/CarbonFootprintQueuePage.tsx`.
- Verification: `npm run build --workspace=frontend`.
- Related docs updated: `CONTEXT.md` updated for project memory. No backend code or schema changes were required.

Recent Carbon Footprint generic-EF unit normalization update from user prompt on 2026-06-13:

- Prompt summary: fix the `คำนวณรายการที่เลือก` card page so changing the selected result unit between `kgCO2e` and `tCO2e` actually changes both `preview result` and the frontend formula as expected.
- Result: `frontend/src/features/cf-dashboard/pages/CarbonFootprintQueuePage.tsx` now treats generic `EF_total` preview calculations as `kgCO2e`-based before converting to the selected result unit, so values like `2.302 kgCO2e` become `0.002302 tCO2e` when the user switches to `tCO2e`.
- Additional backend alignment: `backend/src/modules/activities/activities.service.ts` now normalizes generic `EF_total` calculation outputs to `kgCO2e` as the source unit before any requested result-unit conversion is applied, keeping the saved calculation result aligned with the frontend preview instead of relying on inconsistent EF result-unit metadata.
- Source of truth: `frontend/src/features/cf-dashboard/pages/CarbonFootprintQueuePage.tsx` and `backend/src/modules/activities/activities.service.ts`.
- Verification: `npm run build --workspace=frontend`; `npm run build --workspace=backend`.
- Assumption: for this Carbon Footprint generic-EF workflow, `coef_em_factor_value_total` should be interpreted from a `kgCO2e` base for conversion purposes.
- Related docs updated: `CONTEXT.md` updated for project memory. No schema changes were required.

Recent Carbon Footprint page simplification from user prompt on 2026-06-13:

- Prompt summary: remove the dashboard summary cards shown on the main `คำนวณ Carbon -> Carbon Footprint` page.
- Result: `frontend/src/features/cf-dashboard/pages/CarbonFootprintQueuePage.tsx` no longer renders the top dashboard/stat-card section on the non-preparation Carbon Footprint page, leaving the page header, filters, queue table, and calculation modal intact.
- Source of truth: `frontend/src/features/cf-dashboard/pages/CarbonFootprintQueuePage.tsx`.
- Verification: `npm run build --workspace=frontend`.
- Related docs updated: `CONTEXT.md` updated for project memory. No backend or schema changes were required.

Recent Carbon Footprint fertilizer sub-filter update from user prompt on 2026-06-13:

- Prompt summary: on the `คำนวณ Carbon -> Carbon Footprint` page, add a more detailed fertilizer filter under `ประเภทปัจจัย` so fertilizer rows can be narrowed by fertilizer type.
- Result: `frontend/src/features/cf-dashboard/pages/CarbonFootprintQueuePage.tsx` now shows an extra `ประเภทปุ๋ย` filter whenever the selected `ประเภทปัจจัย` resolves to fertilizer rows.
- Filter behavior: the new fertilizer sub-filter supports `ปุ๋ยเคมี (มีค่า N)`, `ปุ๋ยอินทรีย์ (ไม่มี N)`, and `ยังไม่ทราบ / ขาดค่า N`, reusing the page’s existing fertilizer-profile detection logic.
- Source of truth: `frontend/src/features/cf-dashboard/pages/CarbonFootprintQueuePage.tsx`.
- Verification: `npm run build --workspace=frontend`.
- Related docs updated: `CONTEXT.md` updated for project memory. No backend or schema changes were required.

Recent fertilizer-calculation documentation update from user prompt on 2026-06-13:

- Prompt summary: summarize the newly added fertilizer Carbon Footprint workbook into `CONCLUSION_CARBON_CAL_TABLE.md` so it can be used as a development/reference document, then remove the original Excel file `ts_c2919cb957.xlsx`.
- Result: `CONCLUSION_CARBON_CAL_TABLE.md` now includes an additional fertilizer Carbon Footprint section covering the workbook’s two-part method: upstream fertilizer production from N-P2O5-K2O master fertilizer EF values, and a simple use-phase N2O calculation using a 1% N-to-N2O-N assumption plus `44/28` and `GWP = 298`.
- Additional behavior: the summary explicitly distinguishes this `simple fertilizer CFP template` from the repo’s existing detailed field/project fertilizer N2O method so future implementation can keep the two calculation modes separate.
- File cleanup: the source workbook `ts_c2919cb957.xlsx` was removed after the summary was captured in the markdown document.
- Source of truth: `CONCLUSION_CARBON_CAL_TABLE.md`.
- Related docs updated: `CONTEXT.md` updated for project memory. No schema or code changes were made.

Recent Carbon Footprint fertilizer formula update from user prompt on 2026-06-13:

- Prompt summary: on `Carbon Footprint -> คำนวณรายการที่เลือก`, switch the fertilizer calculation flow to use the fertilizer Carbon Footprint method summarized in `CONCLUSION_CARBON_CAL_TABLE.md`, make the default system result unit `kgCO2e`, and update the frontend preview to reflect the real formula with example-style values.
- Result: `frontend/src/features/cf-dashboard/pages/CarbonFootprintQueuePage.tsx` and `backend/src/modules/activities/activities.service.ts` now treat the fertilizer modal flow as a simple fertilizer CFP calculation based on parsed fertilizer formulas such as `15-15-15`, using `upstream + use phase` from the document instead of the previous detailed N2O-only preview/calc path.
- Formula behavior: the system now computes fertilizer results from `((N/100)*3.3036) + ((P2O5/100)*1.5716) + ((K2O/100)*0.4974)` for upstream plus `((N/100)*0.01*(44/28)*298)` for use phase, with all fertilizer results normalized to a `kgCO2e` base before optional conversion to `tCO2e`.
- Preview behavior: the preview code card now shows parsed fertilizer formula values, upstream/use-phase example numbers, and changes `preview result` numerically when users switch between `kgCO2e` and `tCO2e`.
- Limitation: this fertilizer CFP path currently requires a fertilizer name that contains an `N-P2O5-K2O` pattern such as `15-15-15`; organic fertilizer names or names without a parseable formula are blocked with an explicit message instead of using guessed values.
- Source of truth: `CONCLUSION_CARBON_CAL_TABLE.md`, `frontend/src/features/cf-dashboard/pages/CarbonFootprintQueuePage.tsx`, and `backend/src/modules/activities/activities.service.ts`.
- Verification: `npm run build --workspace=frontend` and `npm run build --workspace=backend`.
- Related docs updated: `CONTEXT.md` updated for project memory. `README.md`, `GUIDE.md`, `COMPONENT_PJ.md`, and `BUG_LOG.md` were not changed in this task.

Recent long-text table readability update from user prompt on 2026-06-13:

- Prompt summary: on `EF / GWP / หน่วย`, make long-detail columns start in a compact width, allow their widths to be resized, and let users open the full text in a popup; apply the same pattern to other pages with similarly long detail/note columns.
- Result: `frontend/src/components/ui/DataTable.tsx` now supports per-column resizing on desktop tables and exports a shared `ExpandableTextCell` helper that shows long content in a compact preview with a `ดูรายละเอียด` popup for the full text.
- Applied pages: the new long-text behavior is now wired into `frontend/src/features/emission-factors/EmissionFactorsPage.tsx`, `frontend/src/features/activities/ActivityResourcesPage.tsx`, `frontend/src/features/infra/InfraPage.tsx`, `frontend/src/features/lands/LandsPage.tsx`, and `frontend/src/features/activities/ActivitiesPage.tsx` for `รายละเอียด`, `หมายเหตุ`, `ข้อมูลเพิ่มเติม`, and other long-name columns.
- UI behavior: long text now appears short by default, can be expanded by popup when needed, and selected desktop columns can be dragged wider or narrower from the table header.
- Source of truth: `frontend/src/components/ui/DataTable.tsx` for the shared interaction, plus the page-level column configs in the feature files above.
- Verification: `npm run build --workspace=frontend`.
- Related docs updated: `CONTEXT.md` updated for project memory. `COMPONENT_PJ.md`, `README.md`, `GUIDE.md`, and `BUG_LOG.md` were not changed in this task.

Recent emission-factors favorites update from user prompt on 2026-06-16:

- Prompt summary: on `EF / GWP / หน่วย`, the user wanted a way to mark frequently used rows as favorites without changing the database, and wanted a dedicated page/view that shows the favorited rows together.
- Result: `frontend/src/features/emission-factors/EmissionFactorsPage.tsx` now adds a heart/favorite toggle on every `Emission Factors`, `GWP`, and `units` row, plus quick filters to show only favorited rows inside those tabs.
- Favorites view behavior: the same page now includes a `รายการโปรด` tab that aggregates only the favorited `EF`, `GWP`, and `Unit` rows into separate searchable tables so users can reopen common rows quickly.
- Storage behavior: favorites are stored in browser `localStorage` under the emission-factors page only, so no database schema, Prisma schema, API contract, or backend behavior changed.
- Limitation: favorites are browser-specific for that machine/profile and currently do not include `CF Type`, `กลุ่ม EF`, or `units_prefixs`.
- Source of truth: `frontend/src/features/emission-factors/EmissionFactorsPage.tsx`.
- Verification: `npm run build --workspace=frontend`.
- Related docs updated: `CONTEXT.md` and `COMPONENT_PJ.md` updated. `README.md`, `GUIDE.md`, and `BUG_LOG.md` were not changed in this task.

Recent activity type management page update from user prompt on 2026-06-16:

- Prompt summary: create a system-settings page for `activities_header_type` and `activities_header_detail_type`, including management of which activity detail type belongs under which activity header type, with careful loading/update behavior and no schema changes.
- Result: `/activities/types` now renders `frontend/src/features/activities/ActivityTypesPage.tsx` and is listed under `ตั้งค่าระบบ` as `กิจกรรมหลัก / กิจกรรมย่อย`.
- Backend behavior: `backend/src/modules/activities/activities.controller.ts` and `backend/src/modules/activities/activities.service.ts` now expose CRUD for `/api/activities/header-types` and `/api/activities/detail-types`. List responses include usage counts, and deletes are guarded with readable `BadRequestException` messages when rows are still referenced.
- Relationship behavior: this uses the existing one-parent relationship `activities_header_detail_type.act_header_type_id -> activities_header_type.act_header_type_id`. Updating a detail type changes only the master row and does not rewrite old `log_activities_detail` records.
- Safety behavior: create/update trims names, validates parent header types, prevents new duplicate header/detail master names using canonical comparison, invalidates the shared frontend query keys used by existing activity dropdowns, and disables pending mutations in the UI.
- Source of truth: `frontend/src/features/activities/ActivityTypesPage.tsx`, `frontend/src/App.tsx`, `frontend/src/components/layout/Sidebar.tsx`, `backend/src/modules/activities/activities.controller.ts`, and `backend/src/modules/activities/activities.service.ts`.
- Verification: `npm run build --workspace=backend` and `npm run build --workspace=frontend`.
- Related docs updated: `CONTEXT.md` and `COMPONENT_PJ.md` updated. No Prisma schema, SQL snapshot, or migration files were changed.

Recent input-usage density filter update from user prompt on 2026-06-16:

- Prompt summary: on `สรุปการใช้ปัจจัย`, remove the shared filter control named `ความหนาแน่น` and make the page use the expanded layout by default.
- Result: `frontend/src/features/cf-dashboard/pages/InputUsageSummaryPage.tsx` now locks the density mode to `expanded`, removes the visible density selector from `ตัวกรองร่วมของทั้งหน้า`, and keeps the remaining shared filters aligned in a 5-column desktop grid.
- Source of truth: `frontend/src/features/cf-dashboard/pages/InputUsageSummaryPage.tsx`.
- Verification: `npm run build --workspace=frontend`.
- Related docs updated: `CONTEXT.md` updated. No route, backend, schema, or API changes were made.

Recent input-usage year-label clarification from user prompt on 2026-06-16:

- Prompt summary: the user asked what the shared `ปี` filter on `สรุปการใช้ปัจจัย` means and requested a clearer name.
- Clarification: backend input-usage aggregation resolves `year` from `activities_productYear.act_productYear_name` first, and only falls back to activity/log dates when no production-year master value is available.
- Result: `frontend/src/features/cf-dashboard/pages/InputUsageSummaryPage.tsx` now labels the shared year filter, table columns, workbook labels, empty labels, and search placeholders as `ปีการผลิต` instead of the ambiguous `ปี`.
- Source of truth: `frontend/src/features/cf-dashboard/pages/InputUsageSummaryPage.tsx` for UI wording and `backend/src/modules/activities/activities.service.ts` for year resolution behavior.
- Verification: `npm run build --workspace=frontend`.

Recent fertilizer input-usage table/export update from user prompt on 2026-06-16:

- Prompt summary: on `สรุปการใช้ปัจจัย -> ส่วนที่ 1: ปุ๋ย`, let users choose which production years appear, make the fertilizer table switch rows between camp and land views, shorten land-view labels to plot codes only, and export the visible fertilizer table to Excel.
- Result: `frontend/src/features/cf-dashboard/pages/InputUsageSummaryPage.tsx` now uses multi-select production-year chips in the shared filters, and the fertilizer workbook/table rows follow `มุมมองตาราง` (`รายไร่` aggregates by camp/year; `รายแปลง` aggregates by land/year).
- Display behavior: land-view fertilizer rows show `landCode`/plot number as the main label to keep cells compact, while the full land label remains available in table search/title and in the exported summary sheet.
- Export behavior: Section 1 now has an `Export Excel` action that writes the currently filtered fertilizer workbook sheet plus the fertilizer summary sheet for the active camp/land view and selected production years.
- Source of truth: `frontend/src/features/cf-dashboard/pages/InputUsageSummaryPage.tsx`.
- Verification: `npm run build --workspace=frontend`.

Recent fertilizer factor-selection update from user prompt on 2026-06-13:

- Prompt summary: on `Carbon Footprint -> คำนวณรายการที่เลือก`, keep the fertilizer CFP formula but make its variable constants user-selectable from master data: `Emission Factor value total` for `ยูเรีย as N`, `DAP as P2O5`, `KCl as K2O`, plus a selectable `GWP` value for `N2O`, and make sure frontend preview uses those selected values correctly.
- Result: `frontend/src/features/cf-dashboard/pages/CarbonFootprintQueuePage.tsx` now shows a dedicated fertilizer-factor selection section inside the calculation modal, with searchable pickers for the three EF_total inputs and the `GWP N2O` row.
- Preview behavior: the fertilizer frontend preview now recalculates immediately from the currently selected EF/GWP values, and the preview code card also shows the selected factor values alongside upstream/use-phase breakdowns.
- Backend alignment: `backend/src/modules/activities/activities.service.ts` and `backend/src/modules/activities/activities.controller.ts` now accept the selected fertilizer EF/GWP IDs in the calculate payload and use those chosen values for the persisted calculation instead of always forcing the hard-coded defaults.
- Fallback behavior: if a specific fertilizer EF or GWP is not selected, the system still falls back to the document constants (`3.3036`, `1.5716`, `0.4974`, `298`) so the flow stays usable, but the modal auto-select logic now tries to match likely default rows from the master data when fertilizer rows are present.
- Source of truth: `frontend/src/features/cf-dashboard/pages/CarbonFootprintQueuePage.tsx`, `backend/src/modules/activities/activities.service.ts`, and `backend/src/modules/activities/activities.controller.ts`.
- Verification: `npm run build --workspace=frontend` and `npm run build --workspace=backend`.
- Related docs updated: `CONTEXT.md` updated for project memory. No schema changes were made.

Recent activity production-year CSV/filter update from user prompt on 2026-06-15:

- Prompt summary: support the new `log_activities_detail.act_productYear_id` field in activity CSV import, store CSV-selected `อื่น ๆ` resource items in `activities_resourceOther`, create or reuse `activities_productYear` rows during import, and add production-year filters to activity-related tables.
- CSV behavior: `frontend/src/features/activities/ActivitiesPage.tsx` adds `ปีการผลิต` as the first activity CSV mapping target, and `frontend/src/components/ui/CsvMappingWizard.tsx` now auto-maps common production-year headers such as `ปีการผลิต`, `cropyear`, and `seasonyear`.
- Backend behavior: `backend/src/modules/activities/activities.service.ts` now reads `act_productYear_name` during CSV import, reuses an existing `activities_productYear` by id/name when present, creates a new row when missing, and writes the resulting `act_productYear_id` into `log_activities_detail`.
- Resource behavior: CSV resource category selection/inference now preserves `อื่น ๆ` so backend import creates or links `activities_resourceOther` instead of falling back to fertilizer when an item is explicitly classified as other.
- UI behavior: production-year display/filtering was added to the activity management table, daily activity log page, Carbon preparation page, Carbon Footprint queue page, Carbon Credit year selection, and the activity-operation badges on the lands table; manual activity detail forms on the activity pages can select an existing production year. The input usage summary keeps its existing year filter, but backend aggregation now uses production year first when available.
- Source of truth: `frontend/src/features/activities/ActivitiesPage.tsx`, `frontend/src/features/activities/ActivityLogListPage.tsx`, `frontend/src/features/cf-dashboard/pages/CalculatePage.tsx`, `frontend/src/features/cf-dashboard/pages/CarbonFootprintQueuePage.tsx`, `frontend/src/features/cf-dashboard/pages/CarbonCreditPage.tsx`, `frontend/src/features/lands/LandsPage.tsx`, `frontend/src/components/ui/CsvMappingWizard.tsx`, `backend/src/modules/activities/activities.service.ts`, and `backend/src/modules/activities/activities.controller.ts`.
- Verification: `npm run build --workspace=backend` and `npm run build --workspace=frontend`.
- Related docs updated: `CONTEXT.md` and `COMPONENT_PJ.md` updated for project memory/component map. No additional database schema edits were made in this task.

Recent land camp-group management update from user prompt on 2026-06-15:

- Prompt summary: after adding the new `lands_camps_groups` table, add a grouped-camp management section into the `พื้นที่เพาะปลูก` page so camp records can be organized under reusable farm/camp groups.
- Backend behavior: `backend/src/modules/lands/lands.controller.ts` and `backend/src/modules/lands/lands.service.ts` now expose `/api/lands/camp-groups` CRUD endpoints, include `_count` metadata for linked camps, and let camp create/update requests save `land_camp_group_id`.
- Frontend behavior: `frontend/src/features/lands/LandsPage.tsx` now shows a `กลุ่มไร่` management table inside the `แคมป์` tab, supports add/edit/delete for camp groups, and adds a group selector to the camp form so each camp can be linked to an existing group.
- UI result: users can maintain reusable camp-group master data and immediately assign camps into those groups from the same page without leaving the land-management workflow.
- Source of truth: `frontend/src/features/lands/LandsPage.tsx`, `backend/src/modules/lands/lands.controller.ts`, and `backend/src/modules/lands/lands.service.ts`.
- Verification: `npm run build --workspace=backend` and `npm run build --workspace=frontend`.
- Related docs updated: `CONTEXT.md` and `COMPONENT_PJ.md` updated for project memory/component map. No Prisma schema or SQL snapshot changes were made in this task.

Recent camp bulk group-assignment update from user prompt on 2026-06-15:

- Prompt summary: on the `พื้นที่เพาะปลูก` page inside the `แคมป์` section, clearly separate camps with and without a farm group, then allow multi-select assignment for ungrouped camps and group moves for already-grouped camps.
- Frontend behavior: `frontend/src/features/lands/LandsPage.tsx` now adds grouped/ungrouped filter chips, row multi-select checkboxes for camps, a bulk target-group picker, and a shared action flow for both `เพิ่มเข้ากลุ่มไร่` and `ย้ายกลุ่มไร่`.
- Backend behavior: `backend/src/modules/lands/lands.controller.ts` and `backend/src/modules/lands/lands.service.ts` now expose `/api/lands/camps/bulk-group` so many selected camps can be linked to one `lands_camps_groups` row in a single request.
- UI result: users can quickly review which camps still need grouping, select many rows at once, assign them into a group, or move already-grouped camps to another group without editing each camp individually.
- Source of truth: `frontend/src/features/lands/LandsPage.tsx`, `backend/src/modules/lands/lands.controller.ts`, and `backend/src/modules/lands/lands.service.ts`.
- Verification: `npm run build --workspace=backend` and `npm run build --workspace=frontend`.
- Related docs updated: `CONTEXT.md` and `COMPONENT_PJ.md` updated for project memory/component map. No Prisma schema or SQL snapshot changes were made in this task.

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

## Recent Carbon Analytics Datasource Status Update - 2026-06-15

- Prompt summary: implement Phase 2D by showing datasource status on the Carbon Analytics UI so users can distinguish real API data, partial frontend-derived data, and fallback/mock data.
- Result: `DataResult.meta` now supports `datasourceStatus` and `note`, `SourceBadge` displays `API real calculation`, `API partial`, or `Fallback dataset`, and dashboard pages show badges on important KPI/chart/report blocks.
- Follow-up update: datasource badges are hidden by default for end users. A small `DS` toggle on the Carbon Credit Premium T-VER page controls visibility globally through localStorage for the Carbon Analytics pages.
- Source of truth: `frontend/src/features/cf-dashboard/types/dashboard.ts`, `frontend/src/features/cf-dashboard/services/dashboardApi.ts`, `frontend/src/features/cf-dashboard/components/common/SourceBadge.tsx`, and the Carbon Analytics pages under `frontend/src/features/cf-dashboard/pages/`.
- Current limitation: this is a UI/status transparency layer. It does not replace Phase 2B/2C real SOC, cane type, yield, or data-quality calculation work.
- Verification: `npm run build --workspace=frontend` passed. The first sandboxed build hit an EPERM on `C:\Users\User`, then passed when rerun with approved unsandboxed execution.

## Recent Activity CSV Detail-Type Deduplication Update - 2026-06-16

- Prompt summary: the user noticed many near-duplicate `activities_header_detail_type` rows such as `416-ให้น้ำ ปลูก (จ้างเหมา)- น้ำ 416` and asked to prevent the CSV Validate flow from creating repeated activity-detail master rows.
- Result: `frontend/src/components/ui/CsvMappingWizard.tsx` now normalizes activity-detail names during Step Validate, grouping raw CSV values by a canonical name before users confirm the import. Names with numeric prefixes such as `416-` or `604-` and row-number suffixes such as `- น้ำ 416`, `- น้ำ417`, or `- water 416` are grouped under the same clean detail type.
- Backend behavior: `backend/src/modules/activities/activities.service.ts` now applies the same detail-type normalization during CSV import, so imports that bypass or chunk through the frontend still reuse/create only the canonical detail type.
- Additional verification fix: `frontend/src/features/cf-dashboard/pages/SoilOrganicCarbonPage.tsx` now types its delete mutation as `unknown` because the same mutation can delete either SOC rows or soil-improvement plant rows; this was needed for the frontend build to pass.
- Source of truth: `frontend/src/components/ui/CsvMappingWizard.tsx` and `backend/src/modules/activities/activities.service.ts`.
- Verification: detail-type normalization was checked with the four sample names from the user prompt, then `npm run build --workspace=backend` and `npm run build --workspace=frontend` passed.
- Limitation: this prevents new duplicate detail-type master rows from future imports. Existing duplicate rows in the database were intentionally not cleaned up; a future cleanup should remap `log_activities_detail.act_header_detail_type_id` to canonical rows before deleting or hiding old duplicate master rows.

## Recent SOC Annualization Formula Update - 2026-06-16

- Prompt summary: the user requested that SOC CO2e results be annualized across 20 years by dividing the converted `tCO2e/rai` value by `20` before multiplying by area.
- Result: the SOC formula in `frontend/src/features/cf-dashboard/pages/SoilOrganicCarbonPage.tsx` and `backend/src/modules/carbon-soc/carbon-soc.service.ts` now uses `soc_tCO2e_per_rai = (soc_tC_per_rai * (44 / 12)) / 20`, and `soc_tCO2e_total` is now the annualized total per plot based on that per-year value.
- UI clarification: the SOC preview card, table headers, and summary labels now describe the result as `tCO2e/ไร่/ปี` and `SOC รวม/ปี` so the page better reflects the new annualized meaning without changing the underlying database column names.
- Documentation update: `CONCLUSION_CARBON_CAL_TABLE.md` now records the 20-year annualization note alongside the SOC formula example.
- Source of truth: `backend/src/modules/carbon-soc/carbon-soc.service.ts`, `frontend/src/features/cf-dashboard/pages/SoilOrganicCarbonPage.tsx`, and `CONCLUSION_CARBON_CAL_TABLE.md`.
- Limitation: the database still stores the annualized SOC total in the existing `carbon_soc_socIT` column and still uses the existing result-unit relation, so the numeric meaning changed without a schema/unit redesign. If future reporting needs explicit yearly units, that should be handled as a follow-up task.

## Recent SOC Page Usability And Unit Standardization Update - 2026-06-16

- Prompt summary: the user asked to make land selection easier in both SOC and soil-improvement plant forms, show the formulas as calculation simulations, and lock the units so users cannot accidentally choose inconsistent units.
- Result: `frontend/src/features/cf-dashboard/pages/SoilOrganicCarbonPage.tsx` now uses a searchable land selector for both forms, filtering by land camp group, land ID/code/name, and camp while keeping the selected land visible during edits.
- Formula UI: both preview panels now show a simulation block that substitutes current input values into the Fnfix and SOC formulas, including the SOC 20-year annualization step.
- Unit behavior: the frontend no longer shows unit dropdowns for SOC/Fnfix inputs. It displays fixed standard units instead: SOC `%`, BD `g/cm3`, depth `cm`, SOC result `tCO2e/ปี`, plant dry matter `kg/ไร่`, plant nitrogen `%N`, and Fnfix result `tN`.
- Backend behavior: `backend/src/modules/carbon-soc/carbon-soc.service.ts` now enforces the same standard units on create, update, and calculate. If a required unit is missing from `units`, the service creates/reuses it before saving the SOC or soil-improvement plant record. `backend/src/modules/lands/lands.service.ts` now also includes camp-group relation data on `/api/lands` so the SOC page can filter plots by `กลุ่มไร่`.
- Source of truth: `frontend/src/features/cf-dashboard/pages/SoilOrganicCarbonPage.tsx`, `backend/src/modules/carbon-soc/carbon-soc.service.ts`, and `CONCLUSION_CARBON_CAL_TABLE.md`.
- Limitation: this adds/reuses rows in the existing `units` master table but does not clean old SOC/Fnfix rows that may already point to non-standard unit IDs until those rows are updated or recalculated.

## Recent Activity Resource Destination Selection Update - 2026-06-16

- Prompt summary: the user found that the `เพิ่มรายการ` flow on the activity resource page could save new items into the wrong master table because the frontend inferred the target from `ประเภทปัจจัย`, and asked to choose the destination explicitly from `chemical`, `Equipment`, `Fertilizer`, and `otherSource`.
- Result: `frontend/src/features/activities/ActivityResourcesPage.tsx` now shows a required `ปลายทางรายการ` selector in the add-item modal, so new resource rows are created in the exact destination chosen by the user instead of being inferred.
- Expanded page scope: the same page now fully supports `chemical` records alongside fertilizer, fuel/equipment, and other-source records, including list display, filter visibility, add/edit/delete modal flows, and delete confirmation handling.
- Backend behavior: `backend/src/modules/activities/activities.controller.ts` and `backend/src/modules/activities/activities.service.ts` now expose full CRUD endpoints for `activities_chemiscals`, and `GET /api/activities/chemicals` now includes `resource_used_type` label data like the other resource master lists.
- Documentation update: `COMPONENT_PJ.md` now describes `/activities/resources` as a real master-data CRUD page with explicit destination selection instead of a read-only reference list.
- Source of truth: `frontend/src/features/activities/ActivityResourcesPage.tsx`, `backend/src/modules/activities/activities.controller.ts`, `backend/src/modules/activities/activities.service.ts`, and `COMPONENT_PJ.md`.

## Recent Carbon Queue Liquid Fertilizer Preparation Update - 2026-06-16

- Prompt summary: the user found that some fertilizer rows use liquid units such as `L`, but the Carbon Footprint queue bulk action `ทำรายการทั้งหมดจากที่เลือก` still prepared them like sack fertilizer and pushed them into `kg`.
- Result: `frontend/src/features/cf-dashboard/pages/CarbonFootprintQueuePage.tsx` now detects liquid-fertilizer rows from the current/prepared unit and preparation type, keeps them out of the sack-fertilizer bulk preset, and routes them through the generic conversion path instead of forcing `จำนวน x kg/กระสอบ`.
- UI clarification: the `ทำรายการทั้งหมดจากที่เลือก` modal now renders `ปุ๋ยน้ำ` as its own section with volume-style controls and preview text, so liquid rows no longer show the fertilizer card that explains `จำนวน x ปริมาณต่อจำนวน = kg`.
- Calculation behavior: liquid fertilizer rows now resolve to `EF ทั่วไป` instead of `ปุ๋ย / CFP Simple`, and the single-row preparation modal shows them as `ปุ๋ยน้ำ` with volume presets (`L` / `m3`) instead of sack `kg` shortcuts.
- Backend behavior: `backend/src/modules/activities/activities.service.ts` now mirrors the same liquid-fertilizer detection so the actual Carbon Footprint calculation does not fall back to `fertilizer_n2o` for rows prepared as `liquid_fertilizer` or rows still carrying liquid units.
- Source of truth: `frontend/src/features/cf-dashboard/pages/CarbonFootprintQueuePage.tsx` and `backend/src/modules/activities/activities.service.ts`.
- Verification: `npm run build --workspace=backend` and `npm run build --workspace=frontend` passed.
- Limitation: this change stops new liquid-fertilizer rows from being auto-forced into sack/kg preparation, but it does not retroactively reclassify already prepared historical rows until those rows are edited or prepared again.

## Recent Calculation Status Rename Alignment Update - 2026-06-16

- Prompt summary: the user shared updated `log_act_detail_calStatus` names from the live database and asked to align frontend and backend behavior with the newer labels.
- Result: the app now treats the renamed statuses as:
  - `id 1` -> `คำนวณแล้ว(CFP)`
  - `id 2` -> `พร้อมคำนวณ`
  - `id 3` -> `คำนวณแล้ว(CFP,C-credit)`
  - `id 7` -> `คำนวณแล้ว(C-credit)`
- Frontend behavior: `frontend/src/features/activities/cal-status.ts` now recognizes both old and new status names, maps fallback IDs correctly, and adds a separate `creditDone` status kind for `คำนวณแล้ว(C-credit)` instead of merging it into the combined done state. Dashboard cards and status filters on the activity pages, Carbon preparation page, Carbon Footprint queue page, and Carbon Credit page now show the new labels.
- Backend behavior: `backend/src/modules/activities/activities.service.ts` and `backend/src/modules/activities/activities.controller.ts` now use the new canonical names for ready/CFP/C-credit statuses, accept the legacy names as aliases for compatibility, and allow manual status operations to include the new standalone `C-credit` done state.
- Source of truth: `frontend/src/features/activities/cal-status.ts`, `frontend/src/features/activities/ActivitiesPage.tsx`, `frontend/src/features/activities/ActivityLogListPage.tsx`, `frontend/src/features/cf-dashboard/pages/CalculatePage.tsx`, `frontend/src/features/cf-dashboard/pages/CarbonFootprintQueuePage.tsx`, `frontend/src/features/cf-dashboard/pages/CarbonCreditPage.tsx`, `backend/src/modules/activities/activities.service.ts`, and `backend/src/modules/activities/activities.controller.ts`.
- Verification: `npm run build --workspace=backend` and `npm run build --workspace=frontend` passed.
- Assumption kept intentionally: the code still treats `คำนวณผิดพลาด` as the canonical error label, but now also accepts the typo variant `คำนวณผิดผลาด` as an alias in case that text exists in live data.
- Related docs updated: `CONTEXT.md` updated for project memory. `COMPONENT_PJ.md` and `BUG_LOG.md` did not need changes for this status-label alignment task.
