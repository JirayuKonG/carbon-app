# Project Component Map

Last updated: 2026-06-15

Use this file to quickly find where a page, component, layout element, or related API code lives.

## App Entry And Routing

| Part | File | Notes |
| --- | --- | --- |
| React entry point | `frontend/src/main.tsx` | Mounts the React app. |
| App routes | `frontend/src/App.tsx` | Defines all frontend pages and redirects. |
| API helper | `frontend/src/lib/api.ts` | Axios instance using `VITE_API_BASE_URL`, plus generic `get/post/put/del` helpers. |
| Global styles | `frontend/src/index.css` | Tailwind and shared CSS classes like cards, buttons, and tables. |

## Main Layout

| UI Part | File | Notes |
| --- | --- | --- |
| Page shell / layout wrapper | `frontend/src/components/layout/AppLayout.tsx` | Wraps pages with sidebar, topbar, mobile nav, and outlet. |
| Left navigation sidebar | `frontend/src/components/layout/Sidebar.tsx` | Desktop nav menu and route links. |
| Top bar | `frontend/src/components/layout/Topbar.tsx` | Header area above page content. |
| Mobile bottom navigation | `frontend/src/components/layout/MobileNav.tsx` | Mobile nav menu for small screens. |

## Sidebar Navigation Groups

| Group | Items | Notes |
| --- | --- | --- |
| `CARBON ANALYTICS` | `ข้อมูลสรุปคาร์บอนเครดิต`, `ข้อมูลสรุปคาร์บอนฟุตพริ้นท์`, `แผนที่พื้นที่` | `ข้อมูลสรุปคาร์บอนเครดิต` expands to `คาร์บอนเครดิต` and `รายงาน Premium T-VER`; `ข้อมูลสรุปคาร์บอนฟุตพริ้นท์` expands to `คาร์บอนฟุตพริ้นท์` and `รายงานคาร์บอนฟุตพริ้นท์`. |
| `CARBON` | `บันทึกกิจกรรม`, `คำนวณ Carbon` | `บันทึกกิจกรรม` expands to `จัดการกิจกรรม` and `รายการบันทึกกิจกรรม`; `คำนวณ Carbon` expands to `เตรียมข้อมูล Carbon`, `สรุปการใช้ปัจจัย`, `Carbon Footprint`, and `Carbon Credit`. |
| `ข้อมูลเกษตรกร` | `จัดการเกษตรกร`, `พื้นที่เพาะปลูก`, `ข้อมูลสภาพอากาศ` | Farmer and land-related operational pages. |
| `ตั้งค่าระบบ` | `พื้นที่ในประเทศไทย`, `โรงงาน / บริการ`, `จัดการผู้ใช้`, `EF / GWP / หน่วย`, `ปุ๋ย / น้ำมัน` | System reference data, user management, and activity-resource setup pages. |

## Shared UI Components

| Component | File | Used For |
| --- | --- | --- |
| Data table | `frontend/src/components/ui/DataTable.tsx` | Reusable searchable/paginated table. |
| CSV mapping wizard | `frontend/src/components/ui/CsvMappingWizard.tsx` | CSV import column matching flow. Used by weather and activities imports. |
| Dashboard visibility menu | `frontend/src/components/ui/DashboardVisibilityMenu.tsx` | Small header control for choosing which summary cards are shown on a page. |
| Confirm dialog | `frontend/src/components/ui/ConfirmDialog.tsx` | Delete confirmation modal. |
| Toast | `frontend/src/components/ui/Toast.tsx` | Toast notification UI. |

## Carbon Analytics Feature Area

| Part | File/Folder | Notes |
| --- | --- | --- |
| Carbon Analytics pages | `frontend/src/features/cf-dashboard/pages/` | Contains the active Carbon Analytics route pages. |
| Dashboard API adapter | `frontend/src/features/cf-dashboard/services/dashboardApi.ts` | Loads API data first and falls back to mock data when needed. |
| Dashboard mock data | `frontend/src/features/cf-dashboard/data/mockDashboard.ts` | Mock/fallback data for preview and partial API gaps. |
| Shared dashboard styles | `frontend/src/features/cf-dashboard/cf-dashboard.css` | Feature-specific styling for analytics pages. |
| Shared charts | `frontend/src/features/cf-dashboard/components/charts/` | Chart building blocks and chart registry/palette setup. |
| Shared dashboard UI | `frontend/src/features/cf-dashboard/components/common/` | Reusable cards, KPI blocks, filters, and shared dashboard UI parts. |
| Spatial map UI | `frontend/src/features/cf-dashboard/components/map/` | Map and spatial drill-down related components. |

## Feature Pages

| Route | Page File | Main Purpose |
| --- | --- | --- |
| `/overview` | `frontend/src/features/cf-dashboard/pages/OverviewPage.tsx` | Carbon Analytics summary page for KPI, trend, and high-level project comparison. |
| `/process` | `frontend/src/features/cf-dashboard/pages/ProcessPage.tsx` | Cultivation-process analytics focused on process breakdowns and comparisons. |
| `/spatial` | `frontend/src/features/cf-dashboard/pages/SpatialPage.tsx` | Area map, drill-down, and spatial detail summaries. |
| `/report` | `frontend/src/features/cf-dashboard/pages/ReportPage.tsx` | Premium T-VER summary, preview, and export/download flow. |
| `/footprint-report` | `frontend/src/features/cf-dashboard/pages/FootprintReportPage.tsx` | Carbon footprint report page and export-oriented presentation. |
| `/pipeline` | `frontend/src/features/cf-dashboard/pages/PipelinePage.tsx` | Carbon Analytics pipeline view that still exists as a direct route. |
| `/calculate` | `frontend/src/App.tsx` | Redirects to `/calculate/prepare`. |
| `/calculate/prepare` | `frontend/src/features/cf-dashboard/pages/CalculatePage.tsx` | Carbon data preparation page that moves imported activity details into `carbon_process_queue`. |
| `/calculate/usage` | `frontend/src/features/cf-dashboard/pages/InputUsageSummaryPage.tsx` | Input usage summary page for fertilizer, fuel, and other activity factors by camp/field/year before Carbon Footprint calculation, including a workbook-style fertilizer view based on the attached xlsx report layout. |
| `/calculate/footprint` | `frontend/src/features/cf-dashboard/pages/CarbonFootprintQueuePage.tsx` | Carbon Footprint queue page for unit/volume preparation, fertilizer/fuel conversions, soil/SOC inputs, ready status, and calculation actions. |
| `/calculate/credit` | `frontend/src/features/cf-dashboard/pages/CarbonCreditPage.tsx` | Read-only Carbon Credit analysis page with 4 baseline years, 1 project year, and plot-level fertilizer/fuel comparison. |
| `/dashboard` | `frontend/src/features/dashboard/DashboardPage.tsx` | Older GHG dashboard page kept as a separate route. |
| `/geo` | `frontend/src/features/geo/GeoPage.tsx` | Geographies, provinces, districts, and subdistricts. |
| `/infra` | `frontend/src/features/infra/InfraPage.tsx` | Factories, service areas, and departments. |
| `/users` | `frontend/src/features/users/UsersPage.tsx` | Users and roles. |
| `/farmers` | `frontend/src/features/farmers/FarmersPage.tsx` | Farmer records. |
| `/lands` | `frontend/src/features/lands/LandsPage.tsx` | Lands, camps, landmaps, grouped land form, geo-assisted location selection, and a bulk subdistrict-management panel for updating many selected lands at once. |
| `/lands/weather` | `frontend/src/features/weather/WeatherPage.tsx` | Weather station records and CSV import. |
| `/emission-factors` | `frontend/src/features/emission-factors/EmissionFactorsPage.tsx` | Emission factors, GWP, units, and reference data. |
| `/activities` | `frontend/src/App.tsx` | Redirects to `/activities/logs`. |
| `/activities/logs` | `frontend/src/features/activities/ActivityLogListPage.tsx` | Daily-use list for `log_activities_detail` with filters and add/edit/delete. |
| `/activities/resources` | `frontend/src/features/activities/ActivityResourcesPage.tsx` | Read-only activity resource reference lists for fertilizers, chemicals, and equipments. |
| `/activities/manage` | `frontend/src/features/activities/ActivitiesPage.tsx` | Advanced activity management page with headers, import, workflow tools, and imported-file history. |
| `/activities/logs/new` | `frontend/src/App.tsx` | Redirect helper that preserves the query string and sends users to `/activities/manage`. |

## Route Notes

- The app default route redirects to `/overview`.
- The older `/dashboard` page still exists as a route, but it is no longer listed in the main sidebar navigation.
- The `/pipeline` route is active in `frontend/src/App.tsx`, but it is not surfaced in the current main sidebar navigation.
- A `TransportPage.tsx` file still exists under `frontend/src/features/cf-dashboard/pages/`, but there is no active `/transport` route in the current router.

## Backend/API Counterparts

| Frontend Feature | Backend Files | API Base |
| --- | --- | --- |
| Carbon Analytics (`/overview`, `/process`, `/spatial`, `/report`, `/footprint-report`, `/pipeline`) | `backend/src/modules/analytics/*` | `/api/analytics` |
| Legacy dashboard (`/dashboard`) | `backend/src/modules/analytics/*` | `/api/analytics` |
| Geo | `backend/src/modules/geo/*` | `/api/geo` |
| Infra | `backend/src/modules/infra/*` | `/api/infra` |
| Users | `backend/src/modules/users/*` | `/api/users` |
| Farmers | `backend/src/modules/farmers/*` | `/api/farmers` |
| Lands | `backend/src/modules/lands/*` | `/api/lands` including the bulk subdistrict update endpoint `/api/lands/bulk/subdistrict`. |
| Weather | `backend/src/modules/weather/*` | `/api/lands/weather` |
| Emission factors | `backend/src/modules/emission-factors/*` | `/api/emission-factors` |
| Activities | `backend/src/modules/activities/*` | `/api/activities` including headers/details, CSV import, import-history endpoints, input usage summary `/api/activities/input-usage-summary`, and carbon queue endpoints such as `/api/activities/carbon-process-queue`. |
| Prisma database access | `backend/src/modules/prisma/*` | Used by all backend services. |

## Database And Schema

| Part | File | Notes |
| --- | --- | --- |
| Prisma schema | `backend/src/prisma/schema.prisma` | Database models and PostgreSQL datasource. |
| Prisma service | `backend/src/modules/prisma/prisma.service.ts` | Creates and disconnects the Prisma client. |
| Backend config | `backend/.env` | Contains `DATABASE_URL`; do not commit secrets. |
| Backend env example | `backend/.env.example` | Template for database connection config. |
| SQL snapshot | `managementDataSystem_forCalculate_2.0_06082026_postgres.sql` | Repo bootstrap snapshot for local or fresh environment setup. |

## Common Debug Lookup

| Question | Start Here |
| --- | --- |
| Where is the nav bar? | `frontend/src/components/layout/Sidebar.tsx`, `MobileNav.tsx`, `Topbar.tsx` |
| Where are routes defined? | `frontend/src/App.tsx` |
| Where is Carbon Analytics data loading? | `frontend/src/features/cf-dashboard/services/dashboardApi.ts` |
| Where is API-to-mock fallback logic? | `frontend/src/features/cf-dashboard/services/dashboardApi.ts` |
| Where are Carbon Analytics pages? | `frontend/src/features/cf-dashboard/pages/` |
| Where is the input usage summary page? | `frontend/src/features/cf-dashboard/pages/InputUsageSummaryPage.tsx`; backend source is `backend/src/modules/activities/activities.service.ts`. |
| Where are Carbon Analytics charts/components? | `frontend/src/features/cf-dashboard/components/` |
| Where is the table component? | `frontend/src/components/ui/DataTable.tsx` |
| Where is CSV import UI? | `frontend/src/components/ui/CsvMappingWizard.tsx` |
| Where is weather manual/import page? | `frontend/src/features/weather/WeatherPage.tsx` |
| Where is the activity log page? | `frontend/src/features/activities/ActivityLogListPage.tsx` |
| Where is the advanced activity management page? | `frontend/src/features/activities/ActivitiesPage.tsx` |
| Where is the bulk subdistrict tool for lands? | `frontend/src/features/lands/LandsPage.tsx`; backend update endpoint is `backend/src/modules/lands/lands.service.ts`. |
| Where are `/lands/camps` routes handled? | `backend/src/modules/lands/lands.controller.ts` |
| Where is PostgreSQL/Prisma schema? | `backend/src/prisma/schema.prisma` |
| Where are API requests configured? | `frontend/src/lib/api.ts` |

## Tracking Notes

- Keep this file updated when adding a new page, route, or shared component.
- If a feature has both frontend and backend touchpoints, list both.
- For active bugs, use `BUG_LOG.md`; for file locations, use this component map.
