import type { DataResult, InputUsageSummaryResponse, InputUsageSummaryRow } from "../types/dashboard";

export const emptyInputUsageSummary: InputUsageSummaryResponse = {
  filters: { years: [], camps: [], lands: [] },
  totals: {
    campCount: 0,
    landCount: 0,
    recordCount: 0,
    areaRai: 0,
    fertilizerKg: 0,
    fuelLiter: 0,
    otherRecordCount: 0,
    unknownUnitCount: 0,
  },
  fertilizer: [],
  fuel: [],
  other: [],
  comparisonTargets: [],
};

export interface ResourceUsageScope {
  campId?: number;
  landId?: number;
  year?: number;
}

export interface ResourceUsageSummary {
  rows: InputUsageSummaryRow[];
  fertilizerRows: InputUsageSummaryRow[];
  fuelRows: InputUsageSummaryRow[];
  solidFertilizerRows: InputUsageSummaryRow[];
  liquidFertilizerRows: InputUsageSummaryRow[];
  organicFertilizerRows: InputUsageSummaryRow[];
  chemicalFertilizerRows: InputUsageSummaryRow[];
  areaRai: number;
  recordCount: number;
  sourcePreparedCount: number;
  warningCount: number;
  fertilizerKg: number;
  chemicalFertilizerKg: number;
  organicFertilizerKg: number;
  liquidFertilizerLiter: number;
  fuelLiter: number;
  otherRecordCount: number;
  topFertilizer: string;
  topFuel: string;
  warnings: string[];
}

function matchesScope(row: InputUsageSummaryRow, scope: ResourceUsageScope) {
  return (scope.campId == null || row.campId === scope.campId)
    && (scope.landId == null || row.landId === scope.landId)
    && (scope.year == null || row.year === scope.year);
}

function sumAmount(rows: InputUsageSummaryRow[]) {
  return rows.reduce((sum, row) => sum + row.amount, 0);
}

function normalizedUnit(row: InputUsageSummaryRow) {
  return row.unit.trim().toLowerCase();
}

function topItem(rows: InputUsageSummaryRow[]) {
  return [...rows].sort((a, b) => b.amount - a.amount)[0]?.itemName ?? "-";
}

function uniqueArea(rows: InputUsageSummaryRow[]) {
  const areas = new Map<string, number>();
  rows.forEach((row) => {
    const key = row.landId != null ? `land:${row.landId}` : `camp:${row.campId ?? "unknown"}:${row.landLabel}`;
    areas.set(key, Math.max(areas.get(key) ?? 0, row.areaRai));
  });
  return Array.from(areas.values()).reduce((sum, area) => sum + area, 0);
}

export function summarizeResourceUsage(data: InputUsageSummaryResponse, scope: ResourceUsageScope = {}): ResourceUsageSummary {
  const rows = [...data.fertilizer, ...data.fuel, ...data.other].filter((row) => matchesScope(row, scope));
  const fertilizerRows = rows.filter((row) => row.bucket === "fertilizer");
  const fuelRows = rows.filter((row) => row.bucket === "fuel");
  const solidFertilizerRows = fertilizerRows.filter((row) => normalizedUnit(row) === "kg");
  const liquidFertilizerRows = fertilizerRows.filter((row) => ["l", "liter", "litre"].includes(normalizedUnit(row)));
  const organicFertilizerRows = solidFertilizerRows.filter((row) => row.fertilizerKind === "organic");
  const chemicalFertilizerRows = solidFertilizerRows.filter((row) => row.fertilizerKind === "chemical");
  const warningMessages = rows.flatMap((row) => row.warnings).filter(Boolean);

  return {
    rows,
    fertilizerRows,
    fuelRows,
    solidFertilizerRows,
    liquidFertilizerRows,
    organicFertilizerRows,
    chemicalFertilizerRows,
    areaRai: uniqueArea(rows),
    recordCount: rows.reduce((sum, row) => sum + row.recordCount, 0),
    sourcePreparedCount: rows.reduce((sum, row) => sum + row.sourcePreparedCount, 0),
    warningCount: rows.reduce((sum, row) => sum + row.warningCount, 0),
    fertilizerKg: sumAmount(solidFertilizerRows),
    chemicalFertilizerKg: sumAmount(chemicalFertilizerRows),
    organicFertilizerKg: sumAmount(organicFertilizerRows),
    liquidFertilizerLiter: sumAmount(liquidFertilizerRows),
    fuelLiter: sumAmount(fuelRows),
    otherRecordCount: rows.filter((row) => row.bucket === "other").reduce((sum, row) => sum + row.recordCount, 0),
    topFertilizer: topItem(fertilizerRows),
    topFuel: topItem(fuelRows),
    warnings: Array.from(new Set(warningMessages)).slice(0, 5),
  };
}

export function resourceDataResult(
  result: DataResult<InputUsageSummaryResponse>,
  scope: ResourceUsageScope = {},
) {
  return summarizeResourceUsage(result.data, scope);
}
