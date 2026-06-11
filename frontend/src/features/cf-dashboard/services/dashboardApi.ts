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
  return apiOrMock(route, () => get<OverviewKpi>(route, cleanParams(filter)), mockDashboard.kpi, hasUsableKpi);
}

export async function getTrend(filter?: Partial<ReportFilter>): Promise<DataResult<TrendPoint[]>> {
  const route = "/analytics/cf-trend";
  return apiOrMock(route, () => get<TrendPoint[]>(route, cleanParams(filter)), mockDashboard.trend, hasTrendRows);
}

export async function getProcessEmissions(filter?: Partial<ReportFilter>): Promise<DataResult<ProcessEmission[]>> {
  const route = "/analytics/cf-process";
  return apiOrMock(route, () => get<ProcessEmission[]>(route, cleanParams(filter)), mockDashboard.processEmissions, hasEmissionRows);
}

export async function getTransportEmissions(filter?: Partial<ReportFilter>): Promise<DataResult<ProcessEmission[]>> {
  const route = "/analytics/cf-transport";
  return apiOrMock(route, () => get<ProcessEmission[]>(route, cleanParams(filter)), [], () => true);
}

export async function getProvinceMap(filter?: Partial<ReportFilter>): Promise<DataResult<SpatialSummaryNode[]>> {
  return getCfSpatialNodes(filter);
}

export async function getCfProcessActivities(
  kind: "process" | "transport" | "all" = "all",
  filter?: Partial<ReportFilter>,
): Promise<DataResult<ProcessActivityBreakdown[]>> {
  const route = "/analytics/cf-process-activities";
  const mockData = kind === "transport" ? [] : mockDashboard.processActivities;
  return apiOrMock(route, () => get<ProcessActivityBreakdown[]>(route, cleanParams(filter, { kind })), mockData, kind === "transport" ? () => true : hasActivityRows);
}

export async function getCfSpatialNodes(filter?: Partial<ReportFilter>): Promise<DataResult<SpatialSummaryNode[]>> {
  const route = "/analytics/cf-spatial-nodes";
  return apiOrMock(route, () => get<SpatialSummaryNode[]>(route, cleanParams(filter)), mockDashboard.spatialNodes, hasSpatialRows);
}

export async function getProcessInputComparisons(filter?: Partial<ReportFilter>): Promise<DataResult<ProcessInputComparison[]>> {
  const route = "/analytics/cf-process-inputs";
  return apiOrMock(route, () => get<ProcessInputComparison[]>(route, cleanParams(filter)), mockDashboard.processInputComparisons, hasInputRows);
}

export async function getCaneTypeSummaries(filter?: Partial<ReportFilter>): Promise<DataResult<CaneTypeSummary[]>> {
  const route = "/analytics/cf-cane-types";
  return apiOrMock(route, () => get<CaneTypeSummary[]>(route, cleanParams(filter)), mockDashboard.caneTypeSummaries, hasCaneRows);
}

export async function getCampCarbonSummaries(): Promise<DataResult<CampCarbonSummary[]>> {
  const route = "/analytics/cf-camps";
  return apiOrMock(route, () => get<CampCarbonSummary[]>(route), mockDashboard.campSummaries, hasCampRows);
}

export async function getCampFieldCarbonDetails(campId?: number): Promise<DataResult<CampFieldCarbonDetail[]>> {
  const route = "/analytics/cf-camp-fields";
  const routeWithQuery = campId ? `${route}?camp_id=${campId}` : route;
  const data = campId ? mockDashboard.campFields.filter((field) => field.campId === campId) : mockDashboard.campFields;
  return apiOrMock(routeWithQuery, () => get<CampFieldCarbonDetail[]>(route, campId ? { camp_id: String(campId) } : undefined), data, hasCampFieldRows);
}

export async function getReportSummary(filter: ReportFilter): Promise<ReportSummary> {
  try {
    const apiReport = await get<ReportSummary>("/analytics/cf-report-summary", cleanParams(filter));
    if (hasUsableKpi(apiReport.kpi) && hasSpatialRows(apiReport.spatialNodes ?? [])) return apiReport;
  } catch {
    // Fall through to the mock report when calculated queue data is not ready.
  }
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

function hasRows(value: unknown) {
  return Array.isArray(value) ? value.length > 0 : Boolean(value);
}

function hasUsableKpi(value: OverviewKpi) {
  return Boolean(value.years?.length || value.currentEmission || value.baselineAvgEmission || value.fields);
}

function sumNumbers(values: number[]) {
  return values.reduce((sum, value) => sum + (Number.isFinite(value) ? Math.abs(value) : 0), 0);
}

function hasTrendRows(rows: TrendPoint[]) {
  return rows.length > 0 && sumNumbers(rows.map((row) => row.emission)) > 0;
}

function hasEmissionRows(rows: ProcessEmission[]) {
  return rows.length > 0 && sumNumbers(rows.map((row) => row.emission)) > 0;
}

function hasActivityRows(rows: ProcessActivityBreakdown[]) {
  return rows.length > 0 && sumNumbers(rows.map((row) => row.totalEmission)) > 0;
}

function hasInputRows(rows: ProcessInputComparison[]) {
  return rows.length > 0 && sumNumbers(rows.flatMap((row) => [
    row.baselineFertilizerKg,
    row.currentFertilizerKg,
    row.baselineFuelLiter,
    row.currentFuelLiter,
  ])) > 0;
}

function hasSpatialRows(rows: SpatialSummaryNode[]) {
  return rows.length > 1 && rows.some((row) =>
    row.areaRai > 0
    || row.fields > 0
    || row.baselineEmission > 0
    || row.currentEmission > 0
    || hasInputRows(row.processInputComparisons ?? []),
  );
}

function hasCaneRows(rows: CaneTypeSummary[]) {
  return rows.length > 0 && rows.some((row) => row.areaRai > 0 || row.percent > 0 || (row.co2eTotal ?? 0) > 0);
}

function hasCampRows(rows: CampCarbonSummary[]) {
  return rows.length > 0 && rows.some((row) =>
    row.areaRai > 0
    || row.fieldCount > 0
    || row.baselineCo2eTotal > 0
    || row.currentCo2eTotal > 0
    || hasInputRows(row.processInputComparisons ?? []),
  );
}

function hasCampFieldRows(rows: CampFieldCarbonDetail[]) {
  return rows.length > 0 && rows.some((row) =>
    row.areaRai > 0
    || row.baselineEmission > 0
    || row.currentEmission > 0
    || row.co2eTotal > 0
    || hasInputRows(row.processInputComparisons ?? []),
  );
}

async function apiOrMock<T>(
  route: string,
  apiCall: () => Promise<T>,
  mockData: T,
  isUsable: (value: T) => boolean = hasRows,
): Promise<DataResult<T>> {
  try {
    const data = await apiCall();
    if (isUsable(data)) return apiResult(route, data);
  } catch {
    // Keep dashboard pages usable while some API routes or calculated rows are not ready yet.
  }
  return mockResult(route, mockData);
}
