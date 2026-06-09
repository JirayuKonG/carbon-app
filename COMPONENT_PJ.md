# Project Component Map

Last updated: 2026-06-04

Use this file to quickly find where a page, component, layout element, or related API code lives.

## App Entry And Routing

| Part | File | Notes |
| --- | --- | --- |
| React entry point | `frontend/src/main.tsx` | Mounts the React app. |
| App routes | `frontend/src/App.tsx` | Defines all frontend pages and redirects. |
| API helper | `frontend/src/lib/api.ts` | Axios instance, base URL `/api`, generic `get/post/put/del`. |
| Global styles | `frontend/src/index.css` | Tailwind and shared CSS classes like cards, buttons, tables. |

## Main Layout

| UI Part | File | Notes |
| --- | --- | --- |
| Page shell / layout wrapper | `frontend/src/components/layout/AppLayout.tsx` | Wraps pages with sidebar, topbar, mobile nav, and outlet. |
| Left navigation sidebar | `frontend/src/components/layout/Sidebar.tsx` | Desktop nav menu and route links. Current group order is `CARBON ANALYTICS`, `CARBON`, `ข้อมูลเกษตรกร`, `ตั้งค่าระบบ`. Supports nested Carbon Analytics and activity links. |
| Top bar | `frontend/src/components/layout/Topbar.tsx` | Header area above page content. |
| Mobile bottom navigation | `frontend/src/components/layout/MobileNav.tsx` | Mobile nav menu for small screens. |

## Sidebar Navigation Groups

| Group | Items | Notes |
| --- | --- | --- |
| `CARBON ANALYTICS` | `ภาพรวม Carbon`, `แผนที่พื้นที่` | `ภาพรวม Carbon` expands to `ข้อมูลสรุป`, `กระบวนการเพาะปลูก`, and `รายงาน Premium T-VER`. |
| `CARBON` | `บันทึกกิจกรรม`, `คำนวณ Carbon` | `บันทึกกิจกรรม` expands to `จัดการกิจกรรม` and `รายการบันทึกกิจกรรม`; `คำนวณ Carbon` expands to `Carbon Footprint` and `Carbon Credit`. |
| `ข้อมูลเกษตรกร` | `จัดการเกษตรกร`, `พื้นที่เพาะปลูก`, `ข้อมูลสภาพอากาศ` | Farmer and land-related operational pages. |
| `ตั้งค่าระบบ` | `พื้นที่ในประเทศไทย`, `โรงงาน / บริการ`, `จัดการผู้ใช้`, `EF / GWP / หน่วย`, `ปุ๋ย / น้ำมัน` | System reference data and supporting setup pages. |

## Shared UI Components

| Component | File | Used For |
| --- | --- | --- |
| Data table | `frontend/src/components/ui/DataTable.tsx` | Reusable searchable/paginated table. |
| CSV mapping wizard | `frontend/src/components/ui/CsvMappingWizard.tsx` | CSV import column matching flow. Used by weather and activities imports. |
| Dashboard visibility menu | `frontend/src/components/ui/DashboardVisibilityMenu.tsx` | Small header control for choosing which summary cards are shown on a page. Used by the activity pages. |
| Confirm dialog | `frontend/src/components/ui/ConfirmDialog.tsx` | Delete confirmation modal. |
| Toast | `frontend/src/components/ui/Toast.tsx` | Toast notification UI. |

## Carbon Analytics Feature Area

| Part | File/Folder | Notes |
| --- | --- | --- |
| Carbon Analytics pages | `frontend/src/features/cf-dashboard/pages/` | Contains the active Carbon Analytics route pages. |
| Dashboard API adapter | `frontend/src/features/cf-dashboard/services/dashboardApi.ts` | Handles Carbon Analytics data loading and the mock/API switch. |
| Dashboard mock data | `frontend/src/features/cf-dashboard/data/mockDashboard.ts` | Temporary preview data used while API mode is disabled. |
| Shared dashboard styles | `frontend/src/features/cf-dashboard/cf-dashboard.css` | Feature-specific styling for analytics pages. |
| Shared charts | `frontend/src/features/cf-dashboard/components/charts/` | Chart building blocks and chart registry/palette setup. |
| Shared dashboard UI | `frontend/src/features/cf-dashboard/components/common/` | Reusable cards, KPI blocks, filters, and other shared dashboard UI parts. |
| Spatial map UI | `frontend/src/features/cf-dashboard/components/map/` | Map and spatial drill-down related components. |

## Feature Pages

| Route | Page File | Main Purpose |
| --- | --- | --- |
| `/overview` | `frontend/src/features/cf-dashboard/pages/OverviewPage.tsx` | Carbon Analytics summary page for KPI, trend, and high-level project comparison. |
| `/process` | `frontend/src/features/cf-dashboard/pages/ProcessPage.tsx` | Cultivation-process analytics focused on process breakdowns and comparisons. |
| `/spatial` | `frontend/src/features/cf-dashboard/pages/SpatialPage.tsx` | Area map, drill-down, and spatial detail summaries. |
| `/report` | `frontend/src/features/cf-dashboard/pages/ReportPage.tsx` | Premium T-VER summary, preview, and export/download flow. |
| `/calculate` | `frontend/src/App.tsx` | Redirects to `/calculate/footprint`. |
| `/calculate/footprint` | `frontend/src/features/cf-dashboard/pages/CalculatePage.tsx` | Carbon Footprint calculation workflow page with status management and standard/CFP actions. |
| `/calculate/credit` | `frontend/src/features/cf-dashboard/pages/CarbonCreditPage.tsx` | Read-only Carbon Credit analysis page with 4 baseline years, 1 project year, and plot-level fertilizer/fuel comparison. |
| `/dashboard` | `frontend/src/features/dashboard/DashboardPage.tsx` | GHG dashboard, charts, summaries. |
| `/geo` | `frontend/src/features/geo/GeoPage.tsx` | Geographies, provinces, districts, subdistricts. |
| `/infra` | `frontend/src/features/infra/InfraPage.tsx` | Factories, service areas, departments. |
| `/users` | `frontend/src/features/users/UsersPage.tsx` | Users and roles. |
| `/farmers` | `frontend/src/features/farmers/FarmersPage.tsx` | Farmer records. |
| `/lands` | `frontend/src/features/lands/LandsPage.tsx` | Lands, camps, landmaps, grouped land form, and geo-assisted location selection. |
| `/lands/weather` | `frontend/src/features/weather/WeatherPage.tsx` | Weather station records and CSV import. |
| `/emission-factors` | `frontend/src/features/emission-factors/EmissionFactorsPage.tsx` | Emission factors, GWP, units/reference data. |
| `/activities/resources` | `frontend/src/features/activities/ActivityResourcesPage.tsx` | Read-only activity resource reference lists for fertilizers, chemicals, and equipments. |
| `/activities` | `frontend/src/App.tsx` | Redirects to `/activities/logs`. |
| `/activities/logs` | `frontend/src/features/activities/ActivityLogListPage.tsx` | Simpler daily-use list for `log_activities_detail` with filters and add/edit/delete. |
| `/activities/manage` | `frontend/src/features/activities/ActivitiesPage.tsx` | Advanced activity management page with headers, import, full workflow tools, and imported-file history from `activities_fileNameUse`. |
| `/activities/logs/new` | `frontend/src/App.tsx` | Redirect helper that preserves query string and sends users to `/activities/manage`. |

## Route Notes

- The app default route redirects to `/overview`.
- The current sidebar navigation order is:
  - `CARBON ANALYTICS`
  - `CARBON`
  - `ข้อมูลเกษตรกร`
  - `ตั้งค่าระบบ`
- The older `/dashboard` page still exists as a route, but it is no longer listed in the main sidebar navigation.
- The Carbon Analytics pipeline page file still exists at `frontend/src/features/cf-dashboard/pages/PipelinePage.tsx`, but its route is currently commented out in `frontend/src/App.tsx`.
- A `TransportPage.tsx` file also still exists under `frontend/src/features/cf-dashboard/pages/`, but there is no active `/transport` route in the current router.

## Backend/API Counterparts

| Frontend Feature | Backend Files | API Base |
| --- | --- | --- |
| Carbon Analytics (`/overview`, `/process`, `/spatial`, `/report`) | `backend/src/modules/analytics/*` | `/api/analytics` |
| Legacy dashboard (`/dashboard`) | `backend/src/modules/analytics/*` | `/api/analytics` |
| Geo | `backend/src/modules/geo/*` | `/api/geo` |
| Infra | `backend/src/modules/infra/*` | `/api/infra` |
| Users | `backend/src/modules/users/*` | `/api/users` |
| Farmers | `backend/src/modules/farmers/*` | `/api/farmers` |
| Lands | `backend/src/modules/lands/*` | `/api/lands` |
| Weather | `backend/src/modules/weather/*` | `/api/lands/weather` |
| Emission factors | `backend/src/modules/emission-factors/*` | `/api/emission-factors` |
| Activities | `backend/src/modules/activities/*` | `/api/activities` including activity headers/details, CSV import, and imported-file history endpoints such as `/api/activities/import-files`. |
| Prisma database access | `backend/src/modules/prisma/*` | Used by all backend services. |

## Database And Schema

| Part | File | Notes |
| --- | --- | --- |
| Prisma schema | `backend/src/prisma/schema.prisma` | Database models and PostgreSQL datasource. |
| Prisma service | `backend/src/modules/prisma/prisma.service.ts` | Creates/disconnects Prisma client. |
| Backend config | `backend/.env` | Contains `DATABASE_URL`; do not commit secrets. |
| Backend env example | `backend/.env.example` | Template for database connection config. |

## Common Debug Lookup

| Question | Start Here |
| --- | --- |
| Where is the nav bar? | `frontend/src/components/layout/Sidebar.tsx`, `MobileNav.tsx`, `Topbar.tsx` |
| Where are routes defined? | `frontend/src/App.tsx` |
| Where is Carbon Analytics data loading? | `frontend/src/features/cf-dashboard/services/dashboardApi.ts` |
| Where is the mock-vs-API dashboard switch? | `frontend/src/features/cf-dashboard/services/dashboardApi.ts` |
| Where are Carbon Analytics pages? | `frontend/src/features/cf-dashboard/pages/` |
| Where are Carbon Analytics charts/components? | `frontend/src/features/cf-dashboard/components/` |
| Where is the table component? | `frontend/src/components/ui/DataTable.tsx` |
| Where is CSV import UI? | `frontend/src/components/ui/CsvMappingWizard.tsx` |
| Where is weather manual/import page? | `frontend/src/features/weather/WeatherPage.tsx` |
| Where is the simpler activity log page? | `frontend/src/features/activities/ActivityLogListPage.tsx` |
| Where are `/lands/camps` routes handled? | `backend/src/modules/lands/lands.controller.ts` |
| Where is PostgreSQL/Prisma schema? | `backend/src/prisma/schema.prisma` |
| Where are API requests configured? | `frontend/src/lib/api.ts` |

## Tracking Notes

- Keep this file updated when adding a new page, route, or shared component.
- If a component has a frontend page and backend module, list both.
- For active bugs, use `BUG_LOG.md`; for file locations, use this component map.
