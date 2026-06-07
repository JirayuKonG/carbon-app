import { get } from "@/lib/api";
import type {
  CaneTypeSummary,
  CampCarbonSummary,
  CampFieldCarbonDetail,
  DataResult,
  OverviewKpi,
  ProcessInputComparison,
  ProcessActivityBreakdown,
  ProcessEmission,
  ReportFilter,
  ReportSummary,
  SpatialSummaryNode,
  TrendPoint,
} from "../types/dashboard";
import { mockDashboard } from "../data/mockDashboard";

// Temporary preview mode: API routes below are wired and backend contracts are prepared
// (/cf-kpi, /cf-trend, /cf-process, /cf-process-activities, /cf-spatial-nodes,
// /cf-report-summary, /cf-process-inputs, /cf-cane-types, /cf-camps, /cf-camp-fields).
// Keep mock data visible until the real activity/input data is validated end-to-end.
const ENABLE_API_DASHBOARD = false;

function cleanParams(filter?: Partial<ReportFilter>, extra?: Record<string, string>) {
  const params: Record<string, string> = { ...(extra ?? {}) };
  if (filter?.level && filter.level !== "all") params.level = filter.level;
  if (filter?.id) params.id = filter.id;
  return params;
}

function apiResult<T>(route: string, data: T): DataResult<T> {
  return {
    data,
    source: "api",
    meta: {
      route,
      techniques: ["NestJS", "Prisma", "PostgreSQL"],
      rowCount: Array.isArray(data) ? data.length : 1,
    },
  };
}

function mockResult<T>(route: string, data: T): DataResult<T> {
  return {
    data,
    source: "mock",
    meta: {
      route,
      techniques: ["Mock data", "Temporary dashboard preview"],
      rowCount: Array.isArray(data) ? data.length : 1,
    },
  };
}

export async function getOverviewKpi(filter?: Partial<ReportFilter>): Promise<DataResult<OverviewKpi>> {
  const route = "/analytics/cf-kpi";
  if (ENABLE_API_DASHBOARD) return apiResult(route, await get<OverviewKpi>(route, cleanParams(filter)));
  return mockResult(route, mockDashboard.kpi);
}

export async function getTrend(filter?: Partial<ReportFilter>): Promise<DataResult<TrendPoint[]>> {
  const route = "/analytics/cf-trend";
  if (ENABLE_API_DASHBOARD) return apiResult(route, await get<TrendPoint[]>(route, cleanParams(filter)));
  return mockResult(route, mockDashboard.trend);
}

export async function getProcessEmissions(filter?: Partial<ReportFilter>): Promise<DataResult<ProcessEmission[]>> {
  const route = "/analytics/cf-process";
  if (ENABLE_API_DASHBOARD) return apiResult(route, await get<ProcessEmission[]>(route, cleanParams(filter)));
  return mockResult(route, mockDashboard.processEmissions);
}

export async function getTransportEmissions(filter?: Partial<ReportFilter>): Promise<DataResult<ProcessEmission[]>> {
  const route = "/analytics/cf-transport";
  if (ENABLE_API_DASHBOARD) return apiResult(route, await get<ProcessEmission[]>(route, cleanParams(filter)));
  return mockResult(route, []);
}

export async function getProvinceMap(filter?: Partial<ReportFilter>): Promise<DataResult<SpatialSummaryNode[]>> {
  return getCfSpatialNodes(filter);
}

export async function getCfProcessActivities(
  kind: "process" | "transport" | "all" = "all",
  filter?: Partial<ReportFilter>,
): Promise<DataResult<ProcessActivityBreakdown[]>> {
  const route = "/analytics/cf-process-activities";
  if (ENABLE_API_DASHBOARD) return apiResult(route, await get<ProcessActivityBreakdown[]>(route, cleanParams(filter, { kind })));
  if (kind === "transport") return mockResult(route, []);
  return mockResult(route, mockDashboard.processActivities);
}

export async function getCfSpatialNodes(filter?: Partial<ReportFilter>): Promise<DataResult<SpatialSummaryNode[]>> {
  const route = "/analytics/cf-spatial-nodes";
  if (ENABLE_API_DASHBOARD) return apiResult(route, await get<SpatialSummaryNode[]>(route, cleanParams(filter)));
  return mockResult(route, mockDashboard.spatialNodes);
}

export async function getProcessInputComparisons(filter?: Partial<ReportFilter>): Promise<DataResult<ProcessInputComparison[]>> {
  const route = "/analytics/cf-process-inputs";
  if (ENABLE_API_DASHBOARD) return apiResult(route, await get<ProcessInputComparison[]>(route, cleanParams(filter)));
  return mockResult(route, mockDashboard.processInputComparisons);
}

export async function getCaneTypeSummaries(filter?: Partial<ReportFilter>): Promise<DataResult<CaneTypeSummary[]>> {
  const route = "/analytics/cf-cane-types";
  if (ENABLE_API_DASHBOARD) return apiResult(route, await get<CaneTypeSummary[]>(route, cleanParams(filter)));
  return mockResult(route, mockDashboard.caneTypeSummaries);
}

export async function getCampCarbonSummaries(): Promise<DataResult<CampCarbonSummary[]>> {
  const route = "/analytics/cf-camps";
  if (ENABLE_API_DASHBOARD) return apiResult(route, await get<CampCarbonSummary[]>(route));
  return mockResult(route, mockDashboard.campSummaries);
}

export async function getCampFieldCarbonDetails(campId?: number): Promise<DataResult<CampFieldCarbonDetail[]>> {
  const route = "/analytics/cf-camp-fields";
  const routeWithQuery = campId ? `${route}?camp_id=${campId}` : route;
  if (ENABLE_API_DASHBOARD) {
    return apiResult(routeWithQuery, await get<CampFieldCarbonDetail[]>(route, campId ? { camp_id: String(campId) } : undefined));
  }
  const data = campId ? mockDashboard.campFields.filter((field) => field.campId === campId) : mockDashboard.campFields;
  return mockResult(routeWithQuery, data);
}

export async function getReportSummary(filter: ReportFilter): Promise<ReportSummary> {
  if (ENABLE_API_DASHBOARD) return get<ReportSummary>("/analytics/cf-report-summary", cleanParams(filter));
  const selectedNode = filter.level && filter.level !== "all" && filter.id
    ? mockDashboard.spatialNodes.find((node) => node.id === `${filter.level}-${filter.id}` || node.id === filter.id)
    : mockDashboard.spatialNodes.find((node) => node.level === "country") ?? mockDashboard.spatialNodes[0];
  const keepIds = new Set<string>();
  if (selectedNode) {
    const visit = (nodeId: string) => {
      keepIds.add(nodeId);
      mockDashboard.spatialNodes.filter((node) => node.parentId === nodeId).forEach((node) => visit(node.id));
    };
    visit(selectedNode.id);
  }
  const spatialNodes = keepIds.size ? mockDashboard.spatialNodes.filter((node) => keepIds.has(node.id)) : mockDashboard.spatialNodes;
  const baselineScale = selectedNode ? selectedNode.baselineEmission / mockDashboard.kpi.baselineAvgEmission : 1;
  const currentScale = selectedNode ? selectedNode.currentEmission / mockDashboard.kpi.currentEmission : 1;
  const process = mockDashboard.processEmissions.map((row) => ({
    ...row,
    emission: Number((row.emission * (row.isBaseline ? baselineScale : currentScale)).toFixed(2)),
  }));
  const processInputs = mockDashboard.processInputComparisons.map((row) => ({
    ...row,
    baselineFertilizerKg: Number((row.baselineFertilizerKg * baselineScale).toFixed(1)),
    currentFertilizerKg: Number((row.currentFertilizerKg * currentScale).toFixed(1)),
    baselineFuelLiter: Number((row.baselineFuelLiter * baselineScale).toFixed(1)),
    currentFuelLiter: Number((row.currentFuelLiter * currentScale).toFixed(1)),
  }));
  const currentRows = process.filter((item) => !item.isBaseline);
  const topProcess = [...currentRows].sort((a, b) => b.emission - a.emission)[0]?.process ?? "-";
  const lowProcess = [...currentRows].sort((a, b) => a.emission - b.emission)[0]?.process ?? "-";
  const kpi = {
    ...mockDashboard.kpi,
    baselineAvgEmission: Number((mockDashboard.kpi.baselineAvgEmission * baselineScale).toFixed(2)),
    currentEmission: Number((mockDashboard.kpi.currentEmission * currentScale).toFixed(2)),
    machineEmission: Number((mockDashboard.kpi.machineEmission * currentScale).toFixed(2)),
    inputEmission: Number((mockDashboard.kpi.inputEmission * currentScale).toFixed(2)),
    fertilizerAmountKg: Number((mockDashboard.kpi.fertilizerAmountKg * currentScale).toFixed(1)),
    fertilizerEmission: Number((mockDashboard.kpi.fertilizerEmission * currentScale).toFixed(2)),
    areaRai: selectedNode?.areaRai ?? mockDashboard.kpi.areaRai,
    farmers: selectedNode?.farmers ?? mockDashboard.kpi.farmers,
    fields: selectedNode?.fields ?? mockDashboard.kpi.fields,
  };
  return {
    generatedAt: new Date().toISOString(),
    filter,
    kpi,
    trend: mockDashboard.trend,
    process,
    transport: [],
    processInputs,
    spatialNodes,
    analysis: {
      headline: "ข้อมูลสมมุติสำหรับตรวจหน้าตาแดชบอร์ดก่อนเชื่อมข้อมูลจริง แสดงเฉพาะกระบวนการเพาะปลูก 4 ขั้นตอน",
      topProcess,
      lowProcess,
      topTransport: "ตัดออกจากขอบเขต Carbon Analytics แล้ว",
      areaSummary: `มีแปลงเข้าร่วมโครงการ ${kpi.fields.toLocaleString()} แปลง รวมพื้นที่ ${kpi.areaRai.toLocaleString()} ไร่`,
    },
  };
}
