import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { GeoPage }              from '@/features/geo/GeoPage'
import { InfraPage }            from '@/features/infra/InfraPage'
import { UsersPage }            from '@/features/users/UsersPage'
import { FarmersPage }          from '@/features/farmers/FarmersPage'
import { LandsPage }            from '@/features/lands/LandsPage'
import { WeatherPage }          from '@/features/weather/WeatherPage'
import { EmissionFactorsPage }  from '@/features/emission-factors/EmissionFactorsPage'
import { ActivitiesPage }       from '@/features/activities/ActivitiesPage'
import { ActivityLogListPage }  from '@/features/activities/ActivityLogListPage'
import { ActivityResourcesPage } from '@/features/activities/ActivityResourcesPage'
import { DashboardPage }        from '@/features/dashboard/DashboardPage'
import { CfOverviewPage }       from '@/features/cf-dashboard/pages/OverviewPage'
import { CfProcessPage }        from '@/features/cf-dashboard/pages/ProcessPage'
import { CfSpatialPage }        from '@/features/cf-dashboard/pages/SpatialPage'
import { CfReportPage }         from '@/features/cf-dashboard/pages/ReportPage'
import { CfFootprintReportPage } from '@/features/cf-dashboard/pages/FootprintReportPage'
import { CfCalculatePage }      from '@/features/cf-dashboard/pages/CalculatePage' // KONGJIRAYU05JUNE2026
import { CfPipelinePage }       from '@/features/cf-dashboard/pages/PipelinePage'  // KONGJIRAYU05JUNE2026
import { InputUsageSummaryPage } from '@/features/cf-dashboard/pages/InputUsageSummaryPage'
import { CarbonFootprintQueuePage } from '@/features/cf-dashboard/pages/CarbonFootprintQueuePage'
import { SoilOrganicCarbonPage } from '@/features/cf-dashboard/pages/SoilOrganicCarbonPage'
import { CarbonCreditPage }     from '@/features/cf-dashboard/pages/CarbonCreditPage'

function RedirectWithSearch({ to }: { to: string }) {
  const location = useLocation()
  return <Navigate to={{ pathname: to, search: location.search }} replace />
}

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to="/overview" replace />} />
        <Route path="overview"          element={<CfOverviewPage />} />
        <Route path="process"           element={<CfProcessPage />} />
        <Route path="spatial"           element={<CfSpatialPage />} />
        <Route path="report"            element={<CfReportPage />} />
        <Route path="footprint-report"  element={<CfFootprintReportPage />} />
        <Route path="pipeline"          element={<CfPipelinePage />} />
        <Route path="calculate"         element={<RedirectWithSearch to="/calculate/prepare" />} />
        <Route path="calculate/prepare" element={<CfCalculatePage />} />
        <Route path="calculate/usage"   element={<InputUsageSummaryPage />} />
        <Route path="calculate/footprint" element={<CarbonFootprintQueuePage />} />
        <Route path="calculate/soc"     element={<SoilOrganicCarbonPage />} />
        <Route path="calculate/credit"  element={<CarbonCreditPage />} />
        <Route path="dashboard"         element={<DashboardPage />} />
        <Route path="geo"               element={<GeoPage />} />
        <Route path="infra"             element={<InfraPage />} />
        <Route path="users"             element={<UsersPage />} />
        <Route path="farmers"           element={<FarmersPage />} />
        <Route path="lands"             element={<LandsPage />} />
        <Route path="lands/weather"     element={<WeatherPage />} />
        <Route path="emission-factors"  element={<EmissionFactorsPage />} />
        <Route path="activities"        element={<Navigate to="/activities/logs" replace />} />
        <Route path="activities/logs"   element={<ActivityLogListPage />} />
        <Route path="activities/resources" element={<ActivityResourcesPage />} />
        <Route path="activities/manage" element={<ActivitiesPage />} />
        <Route path="activities/logs/new" element={<RedirectWithSearch to="/activities/manage" />} />
        <Route path="*"                 element={<Navigate to="/overview" replace />} />
      </Route>
    </Routes>
  )
}
