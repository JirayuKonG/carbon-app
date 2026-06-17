import { get } from "@/lib/api";
import type {
  CalculationSummaryParams,
  CalculationSummaryResponse,
  CaneTypeSummary,
  CampCarbonSummary,
  CampFieldCarbonDetail,
  DataResult,
  InputUsageSummaryResponse,
  OverviewKpi,
  ProcessInputComparison,
  ProcessActivityBreakdown,
  ProcessEmission,
  ReportFilter,
  ReportSummary,
  SpatialSummaryNode,
  TrendPoint,
} from "../types/dashboard";
import { projectDashboardDataset } from "../data/projectDashboardDataset";
import { emptyInputUsageSummary } from "../utils/resourceUsage";

const ANALYTICS_SOURCE = import.meta.env.VITE_CF_ANALYTICS_SOURCE ?? "api";
const ALLOW_DEMO_FALLBACK = ANALYTICS_SOURCE === "demo" || ANALYTICS_SOURCE === "mock";
const USE_ANALYTICS_API = ANALYTICS_SOURCE !== "demo" && ANALYTICS_SOURCE !== "mock";

const emptyOverviewKpi: OverviewKpi = {
  baselineAvgEmission: 0,
  currentEmission: 0,
  currentYear: "-",
  machineEmission: 0,
  inputEmission: 0,
  fertilizerAmountKg: 0,
  fertilizerEmission: 0,
  areaRai: 0,
  yieldTon: 0,
  co2ePerTon: 0,
  farmers: 0,
  fields: 0,
  years: [],
  baselineYears: [],
};

const emptyCalculationSummary = (mode: CalculationSummaryParams["mode"] = "footprint"): CalculationSummaryResponse => ({
  mode: mode === "credit" ? "credit" : "footprint",
  datasourceStatus: "missing",
  notes: ["calculation summary API unavailable"],
  filters: {
    yearOptions: [],
    campGroups: [],
    camps: [],
    lands: [],
  },
  kpi: {
    areaRai: 0,
    rowCount: 0,
    calculatedCount: 0,
    missingBreakdownCount: 0,
    grossEmissionTco2e: 0,
    socRemovalTco2e: 0,
    netEmissionTco2e: 0,
    intensityTco2ePerRai: null,
  },
  breakdowns: {
    emissionByFormula: [],
    emissionByResource: [],
    emissionByYear: [],
  },
  rows: [],
  insights: [],
});

function cleanParams(filter?: Partial<ReportFilter>, extra?: Record<string, string>) {
  const params: Record<string, string> = { ...(extra ?? {}) };
  if (filter?.level && filter.level !== "all") params.level = filter.level;
  if (filter?.id) params.id = filter.id;
  if (filter?.year && filter.year !== "project") params.year = filter.year;
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
      datasourceStatus: "api_real",
    },
  };
}

function mockResult<T>(route: string, data: T): DataResult<T> {
  return {
    data,
    source: "mock",
    meta: {
      route,
      techniques: ["ข้อมูลไร่จริง", "ผลคำนวณสมมุติ"],
      rowCount: Array.isArray(data) ? data.length : 1,
      datasourceStatus: "fallback",
      note: "API unavailable or incomplete",
    },
  };
}

function missingResult<T>(route: string, data: T, note = "API unavailable or incomplete"): DataResult<T> {
  return {
    data,
    source: "api",
    meta: {
      route,
      techniques: ["NestJS", "Prisma", "PostgreSQL"],
      rowCount: Array.isArray(data) ? data.length : 1,
      datasourceStatus: "missing",
      note,
    },
  };
}

export async function getOverviewKpi(filter?: Partial<ReportFilter>): Promise<DataResult<OverviewKpi>> {
  const route = "/analytics/cf-kpi";
  return apiOrFallback(route, () => get<OverviewKpi>(route, cleanParams(filter)), projectDashboardDataset.kpi, emptyOverviewKpi, hasUsableKpi);
}

export async function getTrend(filter?: Partial<ReportFilter>): Promise<DataResult<TrendPoint[]>> {
  const route = "/analytics/cf-trend";
  return apiOrFallback(route, () => get<TrendPoint[]>(route, cleanParams(filter)), projectDashboardDataset.trend, [], hasTrendRows);
}

export async function getProcessEmissions(filter?: Partial<ReportFilter>): Promise<DataResult<ProcessEmission[]>> {
  const route = "/analytics/cf-process";
  return apiOrFallback(route, () => get<ProcessEmission[]>(route, cleanParams(filter)), projectDashboardDataset.processEmissions, [], hasEmissionRows);
}

export async function getTransportEmissions(filter?: Partial<ReportFilter>): Promise<DataResult<ProcessEmission[]>> {
  const route = "/analytics/cf-transport";
  return apiOrFallback(route, () => get<ProcessEmission[]>(route, cleanParams(filter)), [], [], () => true);
}

export async function getProvinceMap(filter?: Partial<ReportFilter>): Promise<DataResult<SpatialSummaryNode[]>> {
  return getCfSpatialNodes(filter);
}

export async function getCfProcessActivities(
  kind: "process" | "transport" | "all" = "all",
  filter?: Partial<ReportFilter>,
): Promise<DataResult<ProcessActivityBreakdown[]>> {
  const route = "/analytics/cf-process-activities";
  const demoFallback = kind === "transport" ? [] : projectDashboardDataset.processActivities;
  return apiOrFallback(route, () => get<ProcessActivityBreakdown[]>(route, cleanParams(filter, { kind })), demoFallback, [], kind === "transport" ? () => true : hasActivityRows);
}

export async function getCfSpatialNodes(filter?: Partial<ReportFilter>): Promise<DataResult<SpatialSummaryNode[]>> {
  const route = "/analytics/cf-spatial-nodes";
  return apiOrFallback(route, () => get<SpatialSummaryNode[]>(route, cleanParams(filter)), projectDashboardDataset.spatialNodes, [], hasSpatialRows);
}

export async function getProcessInputComparisons(filter?: Partial<ReportFilter>): Promise<DataResult<ProcessInputComparison[]>> {
  const route = "/analytics/cf-process-inputs";
  return apiOrFallback(route, () => get<ProcessInputComparison[]>(route, cleanParams(filter)), projectDashboardDataset.processInputComparisons, [], hasInputRows);
}

export async function getInputUsageSummary(): Promise<DataResult<InputUsageSummaryResponse>> {
  const route = "/activities/input-usage-summary";
  try {
    const data = await get<InputUsageSummaryResponse>(route);
    return apiResult(route, data);
  } catch {
    return missingResult(route, emptyInputUsageSummary, "resource usage API unavailable");
  }
}

export async function getCalculationSummary(params: CalculationSummaryParams = {}): Promise<DataResult<CalculationSummaryResponse>> {
  const route = "/analytics/calculation-summary";
  const cleanedParams = Object.fromEntries(
    Object.entries(params)
      .filter(([, value]) => value !== undefined && value !== null && value !== "")
      .map(([key, value]) => [key, String(value)]),
  );
  const queryParts = Object.entries(cleanedParams).map(([key, value]) => `${key}=${value}`).join("&");
  const routeWithQuery = queryParts ? `${route}?${queryParts}` : route;

  try {
    const data = await get<CalculationSummaryResponse>(route, Object.keys(cleanedParams).length ? cleanedParams : undefined);
    return {
      data,
      source: "api",
      meta: {
        route: routeWithQuery,
        techniques: ["NestJS", "Prisma", "PostgreSQL"],
        rowCount: data.rows.length,
        datasourceStatus: data.datasourceStatus,
        note: data.notes[0],
      },
    };
  } catch (error) {
    return {
      ...missingResult(routeWithQuery, emptyCalculationSummary(params.mode), "calculation summary API unavailable"),
      error: error instanceof Error ? error.message : "calculation summary API unavailable",
    };
  }
}

export async function getCaneTypeSummaries(filter?: Partial<ReportFilter>): Promise<DataResult<CaneTypeSummary[]>> {
  const route = "/analytics/cf-cane-types";
  return apiOrFallback(route, () => get<CaneTypeSummary[]>(route, cleanParams(filter)), projectDashboardDataset.caneTypeSummaries, [], hasCaneRows);
}

export async function getCampCarbonSummaries(filter?: Partial<ReportFilter>): Promise<DataResult<CampCarbonSummary[]>> {
  const route = "/analytics/cf-camps";
  const params = filter?.year ? { year: filter.year } : undefined;
  const routeWithQuery = filter?.year ? `${route}?year=${filter.year}` : route;
  return apiOrFallback(routeWithQuery, () => get<CampCarbonSummary[]>(route, params), projectDashboardDataset.campSummaries, [], hasCampRows);
}

export async function getCampFieldCarbonDetails(filter?: Partial<ReportFilter>, campId?: number): Promise<DataResult<CampFieldCarbonDetail[]>> {
  const route = "/analytics/cf-camp-fields";
  const params: Record<string, string> = {};
  if (campId) params.camp_id = String(campId);
  if (filter?.year) params.year = filter.year;
  const queryParts = Object.entries(params).map(([k, v]) => `${k}=${v}`).join("&");
  const routeWithQuery = queryParts ? `${route}?${queryParts}` : route;
  const demoFallback = campId ? projectDashboardDataset.campFields.filter((field) => field.campId === campId) : projectDashboardDataset.campFields;
  return apiOrFallback(routeWithQuery, () => get<CampFieldCarbonDetail[]>(route, Object.keys(params).length ? params : undefined), demoFallback, [], hasCampFieldRows);
}

export async function getReportSummary(filter: ReportFilter): Promise<ReportSummary> {
  if (USE_ANALYTICS_API) {
    try {
      const apiReport = await get<ReportSummary>("/analytics/cf-report-summary", cleanParams(filter));
      if (hasUsableKpi(apiReport.kpi) || hasSpatialRows(apiReport.spatialNodes ?? [])) return apiReport;
      if (!ALLOW_DEMO_FALLBACK) return emptyReportSummary(filter);
    } catch {
      if (!ALLOW_DEMO_FALLBACK) return emptyReportSummary(filter);
    }
  } else if (!ALLOW_DEMO_FALLBACK) {
    return emptyReportSummary(filter);
  }

  if (!ALLOW_DEMO_FALLBACK) return emptyReportSummary(filter);

  const selectedNode = filter.level && filter.level !== "all" && filter.id
    ? projectDashboardDataset.spatialNodes.find((node) => node.id === `${filter.level}-${filter.id}` || node.id === filter.id)
    : projectDashboardDataset.spatialNodes.find((node) => node.level === "country") ?? projectDashboardDataset.spatialNodes[0];
  const keepIds = new Set<string>();
  if (selectedNode) {
    const visit = (nodeId: string) => {
      keepIds.add(nodeId);
      projectDashboardDataset.spatialNodes.filter((node) => node.parentId === nodeId).forEach((node) => visit(node.id));
    };
    visit(selectedNode.id);
  }
  const spatialNodes = keepIds.size ? projectDashboardDataset.spatialNodes.filter((node) => keepIds.has(node.id)) : projectDashboardDataset.spatialNodes;
  const baselineScale = selectedNode ? selectedNode.baselineEmission / projectDashboardDataset.kpi.baselineAvgEmission : 1;
  const currentScale = selectedNode ? selectedNode.currentEmission / projectDashboardDataset.kpi.currentEmission : 1;
  const process = projectDashboardDataset.processEmissions.map((row) => ({
    ...row,
    emission: Number((row.emission * (row.isBaseline ? baselineScale : currentScale)).toFixed(2)),
  }));
  const processInputs = projectDashboardDataset.processInputComparisons.map((row) => ({
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
    ...projectDashboardDataset.kpi,
    baselineAvgEmission: Number((projectDashboardDataset.kpi.baselineAvgEmission * baselineScale).toFixed(2)),
    currentEmission: Number((projectDashboardDataset.kpi.currentEmission * currentScale).toFixed(2)),
    machineEmission: Number((projectDashboardDataset.kpi.machineEmission * currentScale).toFixed(2)),
    inputEmission: Number((projectDashboardDataset.kpi.inputEmission * currentScale).toFixed(2)),
    fertilizerAmountKg: Number((projectDashboardDataset.kpi.fertilizerAmountKg * currentScale).toFixed(1)),
    fertilizerEmission: Number((projectDashboardDataset.kpi.fertilizerEmission * currentScale).toFixed(2)),
    areaRai: selectedNode?.areaRai ?? projectDashboardDataset.kpi.areaRai,
    farmers: selectedNode?.farmers ?? projectDashboardDataset.kpi.farmers,
    fields: selectedNode?.fields ?? projectDashboardDataset.kpi.fields,
  };
  return {
    generatedAt: new Date().toISOString(),
    filter,
    kpi,
    trend: projectDashboardDataset.trend,
    process,
    transport: [],
    processInputs,
    spatialNodes,
    analysis: {
      headline: "ข้อมูลไร่จริงพร้อมผลคำนวณเครดิตสมมุติสำหรับเตรียมยื่น Premium T-VER",
      topProcess,
      lowProcess,
      topTransport: "ไม่รวมขนส่งในขอบเขต Carbon Analytics ชุดนี้",
      areaSummary: `มีแปลงเข้าร่วมโครงการ ${kpi.fields.toLocaleString()} แปลง รวมพื้นที่ ${kpi.areaRai.toLocaleString()} ไร่`,
    },
  };
}

function emptyReportSummary(filter: ReportFilter): ReportSummary {
  return {
    generatedAt: new Date().toISOString(),
    filter,
    kpi: emptyOverviewKpi,
    trend: [],
    process: [],
    transport: [],
    processInputs: [],
    spatialNodes: [],
    analysis: {
      headline: "ข้อมูลจริงยังไม่พร้อมสำหรับขอบเขตที่เลือก",
      topProcess: "-",
      lowProcess: "-",
      topTransport: "-",
      areaSummary: "-",
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

async function apiOrFallback<T>(
  route: string,
  apiCall: () => Promise<T>,
  demoFallbackData: T,
  missingData: T,
  isUsable: (value: T) => boolean = hasRows,
): Promise<DataResult<T>> {
  if (!USE_ANALYTICS_API) {
    return ALLOW_DEMO_FALLBACK
      ? mockResult(route, demoFallbackData)
      : missingResult(route, missingData, "analytics API disabled");
  }

  try {
    const data = await apiCall();
    if (isUsable(data)) return apiResult(route, data);
    if (ALLOW_DEMO_FALLBACK) return mockResult(route, demoFallbackData);
    return missingResult(route, missingData);
  } catch {
    if (ALLOW_DEMO_FALLBACK) return mockResult(route, demoFallbackData);
    return missingResult(route, missingData);
  }
}
