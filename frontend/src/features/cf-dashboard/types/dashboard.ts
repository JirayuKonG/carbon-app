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

export interface DashboardDataset {
  kpi: OverviewKpi;
  trend: TrendPoint[];
  processEmissions: ProcessEmission[];
  processActivities: ProcessActivityBreakdown[];
  transportActivities: ProcessActivityBreakdown[];
  spatialNodes: SpatialSummaryNode[];
  fields: FieldCarbonDetail[];
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
  spatialNodes: SpatialSummaryNode[];
  analysis: {
    headline: string;
    topProcess: string;
    lowProcess: string;
    topTransport: string;
    areaSummary: string;
  };
}
