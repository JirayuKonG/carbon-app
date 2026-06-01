# Project Component Map

Last updated: 2026-05-20

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
| Left navigation sidebar | `frontend/src/components/layout/Sidebar.tsx` | Desktop nav menu and route links. Supports nested activity links under `บันทึกกิจกรรม`. |
| Top bar | `frontend/src/components/layout/Topbar.tsx` | Header area above page content. |
| Mobile bottom navigation | `frontend/src/components/layout/MobileNav.tsx` | Mobile nav menu for small screens. |

## Shared UI Components

| Component | File | Used For |
| --- | --- | --- |
| Data table | `frontend/src/components/ui/DataTable.tsx` | Reusable searchable/paginated table. |
| CSV mapping wizard | `frontend/src/components/ui/CsvMappingWizard.tsx` | CSV import column matching flow. Used by weather and activities imports. |
| Confirm dialog | `frontend/src/components/ui/ConfirmDialog.tsx` | Delete confirmation modal. |
| Toast | `frontend/src/components/ui/Toast.tsx` | Toast notification UI. |

## Feature Pages

| Route | Page File | Main Purpose |
| --- | --- | --- |
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
| `/activities/manage` | `frontend/src/features/activities/ActivitiesPage.tsx` | Advanced activity management page with headers, import, and full workflow tools. |

## Backend/API Counterparts

| Frontend Feature | Backend Files | API Base |
| --- | --- | --- |
| Dashboard | `backend/src/modules/analytics/*` | `/api/analytics` |
| Geo | `backend/src/modules/geo/*` | `/api/geo` |
| Infra | `backend/src/modules/infra/*` | `/api/infra` |
| Users | `backend/src/modules/users/*` | `/api/users` |
| Farmers | `backend/src/modules/farmers/*` | `/api/farmers` |
| Lands | `backend/src/modules/lands/*` | `/api/lands` |
| Weather | `backend/src/modules/weather/*` | `/api/lands/weather` |
| Emission factors | `backend/src/modules/emission-factors/*` | `/api/emission-factors` |
| Activities | `backend/src/modules/activities/*` | `/api/activities` |
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
