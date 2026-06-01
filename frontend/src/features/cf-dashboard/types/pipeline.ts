export interface PipelineMetadata {
  route: string;
  techniques: string[];
  row_count: number;
}

export interface PerformanceMetrics {
  elapsed_ms: number;
  peak_mem_kb: number;
}

export interface ApiResponse<T> {
  data: T[];
  pipeline_metadata: PipelineMetadata;
  performance: PerformanceMetrics;
}

export interface KpiRecord {
  is_baseline: number;
  total_emission_co2e: number;
  total_machine_co2e: number;
  total_input_co2e: number;
  total_yield_ton: number;
  avg_co2e_per_ton: number;
  total_farmer: number;
  total_field: number;
}

export interface ProvinceSummary {
  province?: string;
  total_emission_co2e?: number;
  total_field?: number;
  [key: string]: unknown;
}

export interface ProcessBreakdown {
  name?: string;
  process?: string;
  value?: number;
  total_emission_co2e?: number;
  [key: string]: unknown;
}

export interface BaselineComparison {
  label?: string;
  baseline?: number;
  current?: number;
  [key: string]: unknown;
}

export interface SpatialLocation {
  province?: string;
  district?: string;
  sub_district?: string;
  lat?: number;
  lng?: number;
  [key: string]: unknown;
}

export interface FieldDetail {
  field_key?: number;
  province?: string;
  district?: string;
  total_emission_co2e?: number;
  [key: string]: unknown;
}

export interface ChanotRecord {
  chanot_no?: string;
  field_key?: number;
  area_rai?: number;
  [key: string]: unknown;
}

export interface BenchmarkStats {
  avg_ms: number;
  min_ms: number;
  max_ms: number;
  mem_kb: number;
}

export interface BenchmarkResult {
  speedup_x: number;
  saved_ms: number;
  without_pipeline: BenchmarkStats;
  with_pipeline: BenchmarkStats;
  interpretation: string;
}
