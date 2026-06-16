export type DataSource = "api" | "mock";
export type DataSourceStatus = "api_real" | "api_partial" | "fallback";
export type SpatialLevel = "country" | "region" | "province" | "district" | "subdistrict" | "field";

export interface PipelineMeta {
  route: string;
  techniques: string[];
  rowCount: number;
  datasourceStatus?: DataSourceStatus;
  note?: string;
  elapsedMs?: number;
  peakMemKb?: number;
}

export interface DataResult<T> {
  data: T;
  source: DataSource;
  meta?: PipelineMeta;
  error?: string;
}

export interface OverviewKpi {
  baselineAvgEmission: number;
  currentEmission: number;
  currentYear: string;
  machineEmission: number;
  inputEmission: number;
  fertilizerAmountKg: number;
  fertilizerEmission: number;
  areaRai: number;
  yieldTon: number;
  co2ePerTon: number;
  farmers: number;
  fields: number;
  years?: string[];
  baselineYears?: string[];
}

export interface TrendPoint {
  year: string;
  emission: number;
  isBaseline: boolean;
  baselineAverage?: number;
}

export interface ProcessEmission {
  year: string;
  process: string;
  emission: number;
  isBaseline: boolean;
}

export interface ActivityValue {
  name: string;
  emission: number;
}

export interface ProcessActivityBreakdown {
  year: string;
  process: string;
  totalEmission: number;
  activities: ActivityValue[];
}

export interface ProcessInputComparison {
  process: string;
  baselineFertilizerKg: number;
  currentFertilizerKg: number;
  baselineFuelLiter: number;
  currentFuelLiter: number;
}

export type InputUsageBucket = "fertilizer" | "fuel" | "other";
export type FertilizerKind = "chemical" | "organic" | "unknown";

export interface InputUsageSummaryRow {
  id: string;
  bucket: InputUsageBucket;
  year: number | null;
  caneTypeName?: string;
  campId: number | null;
  campName: string;
  landId: number | null;
  landCode: string;
  landName: string;
  landLabel: string;
  itemName: string;
  resourceTypeName: string;
  fertilizerKind?: FertilizerKind;
  fertilizerFormula?: string | null;
  amount: number;
  unit: string;
  areaRai: number;
  recordCount: number;
  sourcePreparedCount: number;
  warningCount: number;
  warnings: string[];
}

export interface InputUsageComparisonTarget {
  id: string;
  type: "camp" | "land";
  label: string;
  campId: number | null;
  campName: string;
  landId?: number | null;
  landLabel?: string;
  areaRai: number;
  recordCount: number;
  fertilizerKg: number;
  fuelLiter: number;
  otherRecordCount: number;
  topFertilizer: string;
  topFuel: string;
  warningCount: number;
}

export interface InputUsageSummaryResponse {
  filters: {
    years: number[];
    camps: Array<{ id: number; label: string }>;
    lands: Array<{ id: number; label: string; campId: number | null; campLabel: string }>;
  };
  totals: {
    campCount: number;
    landCount: number;
    recordCount: number;
    areaRai: number;
    fertilizerKg: number;
    fuelLiter: number;
    otherRecordCount: number;
    unknownUnitCount: number;
  };
  fertilizer: InputUsageSummaryRow[];
  fuel: InputUsageSummaryRow[];
  other: InputUsageSummaryRow[];
  comparisonTargets: InputUsageComparisonTarget[];
}

export type CalculationBreakdown = Record<string, unknown>;

export interface CaneTypeSummary {
  name: string;
  areaRai: number;
  percent: number;
  co2eTotal?: number;
}

export interface SpatialSummaryNode {
  id: string;
  parentId?: string;
  level: SpatialLevel;
  name: string;
  lat: number;
  lng: number;
  zoom: number;
  fields: number;
  farmers: number;
  areaRai: number;
  baselineEmission: number;
  currentEmission: number;
  processBreakdown: ActivityValue[];
  processInputComparisons?: ProcessInputComparison[];
  childrenIds: string[];
  calculationBreakdowns?: CalculationBreakdown[];
}

export interface ChanotRecord {
  chanotNo: string;
  areaRai: number;
}

export interface FieldCarbonDetail extends SpatialSummaryNode {
  level: "field";
  fieldCode: string;
  fieldName: string;
  farmerName: string;
  phone: string;
  province: string;
  district: string;
  subdistrict: string;
  soilType: string;
  irrigationType: string;
  chanots: ChanotRecord[];
}

export interface CampCarbonSummary {
  campId: number;
  campName: string;
  fieldCount: number;
  areaRai: number;
  baselineCo2eTotal: number;
  currentCo2eTotal: number;
  co2eTotal: number;
  co2ePerRai: number;
  topActivity: string;
  baselineActivityBreakdown: ActivityValue[];
  currentActivityBreakdown: ActivityValue[];
  baselineProcessActivities: ProcessActivityBreakdown[];
  currentProcessActivities: ProcessActivityBreakdown[];
  processInputComparisons: ProcessInputComparison[];
  calculationBreakdowns?: CalculationBreakdown[];
}

export interface CampFieldCarbonDetail extends FieldCarbonDetail {
  campId: number;
  campName: string;
  activitiesLogged: string[];
  co2eTotal: number;
}

export interface DashboardDataset {
  kpi: OverviewKpi;
  trend: TrendPoint[];
  processEmissions: ProcessEmission[];
  processActivities: ProcessActivityBreakdown[];
  processInputComparisons: ProcessInputComparison[];
  transportActivities: ProcessActivityBreakdown[];
  caneTypeSummaries: CaneTypeSummary[];
  spatialNodes: SpatialSummaryNode[];
  fields: FieldCarbonDetail[];
  campSummaries: CampCarbonSummary[];
  campFields: CampFieldCarbonDetail[];
}

export type ReportFilterLevel = "all" | "region" | "province" | "district" | "subdistrict" | "field";

export interface ReportFilter {
  level: ReportFilterLevel;
  id?: string;
}

export interface ReportSummary {
  generatedAt: string;
  filter: ReportFilter;
  kpi: OverviewKpi;
  trend: TrendPoint[];
  process: ProcessEmission[];
  transport: ProcessEmission[];
  processInputs?: ProcessInputComparison[];
  spatialNodes: SpatialSummaryNode[];
  analysis: {
    headline: string;
    topProcess: string;
    lowProcess: string;
    topTransport: string;
    areaSummary: string;
  };
}
