export type DataSource = "api" | "mock";
export type SpatialLevel = "country" | "region" | "province" | "district" | "subdistrict" | "field";

export interface PipelineMeta {
  route: string;
  techniques: string[];
  rowCount: number;
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
