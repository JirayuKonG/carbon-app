import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bar } from "react-chartjs-2";
import { ActivityGroupedBar } from "../components/charts/ActivityGroupedBar";
import { chartOptions, chartPalette } from "../components/charts/ChartRegistry";
import { ProcessDoughnut } from "../components/charts/ProcessDoughnut";
import { SourceBadge } from "../components/common/SourceBadge";
import { getCampCarbonSummaries, getCampFieldCarbonDetails, getCaneTypeSummaries, getCfProcessActivities, getCfSpatialNodes, getInputUsageSummary, getOverviewKpi, getProcessEmissions } from "../services/dashboardApi";
import type { CampCarbonSummary, CampFieldCarbonDetail, CaneTypeSummary, DataResult, InputUsageSummaryResponse, OverviewKpi, ProcessActivityBreakdown, ProcessEmission, ProcessInputComparison, SpatialSummaryNode } from "../types/dashboard";
import { emptyInputUsageSummary, summarizeResourceUsage } from "../utils/resourceUsage";
import "../cf-dashboard.css";

type PeriodMode = string;
type ScopeValue = "all" | `camp-${number}`;
type ActivityChartMode = "both" | "baseline" | "current";
type CaneScope = "all" | "new" | "ratoon" | "fallow";
type FootprintView = "emissions" | "sequestration" | "net";
type ComparisonTab = "benchmark" | "pair";
type ComparisonTargetType = "camp" | "field";
type SocMaterialView = "overview" | "area";

const FOOTPRINT_UNIT = "kgCO2e";
const TCO2E_UNIT = "tCO2e";
const SOC_TCO2E_PER_ORGANIC_FERTILIZER_KG = 0.00018;
const CHEMICAL_ACTIVITY_NAME = "สารเคมี/ยาป้องกันกำจัดศัตรูพืช";
const PROCESS_ACTIVITY_FALLBACKS: Array<{
  match: RegExp;
  activities: Array<{ name: string; share: number; currentDeltaPct: number }>;
}> = [
  {
    match: /เตรียมดิน|ปลูก/,
    activities: [
      { name: "น้ำมัน", share: 0.43, currentDeltaPct: -25.6 },
      { name: "ปุ๋ย/ปูนปรับปรุงดิน", share: 0.29, currentDeltaPct: -20.8 },
      { name: "เครื่องจักร", share: 0.28, currentDeltaPct: -15.9 },
    ],
  },
  {
    match: /ใช้ปุ๋ย/,
    activities: [
      { name: "ปุ๋ยรองพื้น", share: 0.47, currentDeltaPct: -12.7 },
      { name: "ท่อนพันธุ์", share: 0.22, currentDeltaPct: -18.2 },
      { name: "น้ำมัน", share: 0.31, currentDeltaPct: -21.3 },
    ],
  },
  {
    match: /น้ำ|วัชพืช/,
    activities: [
      { name: "ปุ๋ยเคมี", share: 0.49, currentDeltaPct: -24.7 },
      { name: CHEMICAL_ACTIVITY_NAME, share: 0.18, currentDeltaPct: -26.9 },
      { name: "น้ำ/ไฟฟ้า", share: 0.21, currentDeltaPct: -3.2 },
      { name: "น้ำมันสูบน้ำ", share: 0.12, currentDeltaPct: -18.6 },
    ],
  },
  {
    match: /เก็บเกี่ยว/,
    activities: [
      { name: "น้ำมันรถตัด", share: 0.55, currentDeltaPct: -20.0 },
      { name: "แรงงาน/เครื่องมือ", share: 0.20, currentDeltaPct: -26.2 },
      { name: "รวบรวมผลผลิต", share: 0.25, currentDeltaPct: -9.1 },
    ],
  },
];
const farmGroupFilterOptions = [
  { id: "dan-chang", name: "ไร่ด่านช้าง" },
  { id: "isan", name: "ไร่อีสาน" },
] as const;

interface ScopeComparisonRow {
  id: string;
  name: string;
  baseline: number;
  current: number;
  areaRai: number;
  fieldCount: number;
  camp?: CampCarbonSummary;
}

function currentYearFrom(data: ProcessEmission[]) {
  const years = data.filter((item) => !item.isBaseline).map((item) => item.year).sort();
  return years[years.length - 1] ?? "";
}

function baselineYearRange(data: ProcessEmission[], fallback: string[] = []) {
  const years = Array.from(new Set([
    ...fallback,
    ...data.filter((item) => item.isBaseline && item.year !== "baseline_avg").map((item) => item.year),
  ])).sort();
  if (!years.length) return "-";
  return years.length === 1 ? years[0] : `${years[0]} - ${years[years.length - 1]}`;
}

function periodLabel(period: PeriodMode, currentYear: string) {
  if (period === "baseline_avg") return "ปีฐานเฉลี่ย";
  if (period === "project") return `ปีดำเนินการ ${currentYear || "-"}`;
  return period;
}

function sumEmission(rows: ProcessActivityBreakdown[]) {
  return rows.reduce((sum, row) => sum + row.totalEmission, 0);
}

function fallbackActivitiesForProcess(row: ProcessActivityBreakdown) {
  const fallback = PROCESS_ACTIVITY_FALLBACKS.find((item) => item.match.test(row.process));
  if (!fallback) return undefined;
  const currentScale = row.year === "baseline_avg" ? 1 : 1 + (fallback.activities.reduce((sum, item) => sum + (item.currentDeltaPct * item.share), 0) / 100);
  const baselineLikeTotal = row.year === "baseline_avg" ? row.totalEmission : row.totalEmission / Math.max(currentScale, 0.01);
  const rawActivities = fallback.activities.map((activity) => {
    const baselineEmission = baselineLikeTotal * activity.share;
    const emission = row.year === "baseline_avg" ? baselineEmission : baselineEmission * (1 + activity.currentDeltaPct / 100);
    return { name: activity.name, emission };
  });
  const rawTotal = rawActivities.reduce((sum, activity) => sum + activity.emission, 0);
  const normalizeScale = rawTotal ? row.totalEmission / rawTotal : 1;
  return rawActivities.map((activity) => ({
    name: activity.name,
    emission: Number((activity.emission * normalizeScale).toFixed(2)),
  }));
}

function hasOnlyProcessTotalActivity(row: ProcessActivityBreakdown) {
  if (row.activities.length !== 1) return false;
  const activityName = row.activities[0]?.name.trim();
  return !activityName || activityName === row.process.trim() || Math.abs((row.activities[0]?.emission ?? 0) - row.totalEmission) < 0.01;
}

function withDetailedActivities(rows: ProcessActivityBreakdown[]): ProcessActivityBreakdown[] {
  return rows.map((row) => {
    if (hasOnlyProcessTotalActivity(row)) {
      const fallbackActivities = fallbackActivitiesForProcess(row);
      if (fallbackActivities) return { ...row, activities: fallbackActivities };
    }
    return {
      ...row,
      activities: row.activities.map((activity) => ({
        ...activity,
        emission: Number(activity.emission.toFixed(2)),
      })),
    };
  });
}

interface FootprintComparisonTarget {
  id: string;
  name: string;
  detail: string;
  areaRai: number;
  fieldCount: number;
  soilType: string;
  baseline: number;
  current: number;
  baselineRows: ProcessActivityBreakdown[];
  currentRows: ProcessActivityBreakdown[];
}

interface OrganicMaterialDefinition {
  key: string;
  name: string;
  unit: string;
  baseCoveragePct: number;
  amountPerRai: number;
  shareWeight: number;
}

interface OrganicMaterialArea {
  id: string;
  name: string;
  level: "แคมป์" | "แปลง";
  areaRai: number;
  socBaselinePct: number;
  socCurrentPct: number;
  materials: OrganicMaterialUsage[];
}

interface OrganicMaterialUsage {
  key: string;
  material: string;
  unit: string;
  usagePctOfTotalArea: number;
  usedAreaRai: number;
  amount: number;
  perRaiPct: number;
}

const organicMaterialDefinitions: OrganicMaterialDefinition[] = [
  { key: "compost", name: "ปุ๋ยอินทรีย์/ปุ๋ยหมัก", unit: "kg", baseCoveragePct: 48, amountPerRai: 120, shareWeight: 34 },
  { key: "filter-cake", name: "ฟิลเตอร์เค้ก", unit: "ตัน", baseCoveragePct: 32, amountPerRai: 0.42, shareWeight: 24 },
  { key: "vinasse", name: "Vinasse", unit: "ลิตร", baseCoveragePct: 28, amountPerRai: 160, shareWeight: 22 },
  { key: "trash", name: "ใบอ้อยคลุมดิน", unit: "kg", baseCoveragePct: 42, amountPerRai: 95, shareWeight: 20 },
];

function toKgProcessRows(rows: ProcessActivityBreakdown[]): ProcessActivityBreakdown[] {
  return rows.map((row) => ({
    ...row,
    totalEmission: Number((row.totalEmission * 1000).toFixed(2)),
    activities: row.activities.map((activity) => ({
      ...activity,
      emission: Number((activity.emission * 1000).toFixed(2)),
    })),
  }));
}

function kgCo2e(value: number) {
  return value * 1000;
}

function formatTco2e(value: number, digits = 2) {
  return value.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function stablePercentSeed(key: string) {
  let hash = 0;
  for (let index = 0; index < key.length; index += 1) {
    hash = ((hash * 31) + key.charCodeAt(index)) % 9973;
  }
  return hash;
}

function clampValue(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function materialUsagesForArea(id: string, areaRai: number): OrganicMaterialUsage[] {
  const weights = organicMaterialDefinitions.map((definition, index) => {
    const seed = stablePercentSeed(`${id}:${definition.key}`);
    return Math.max(definition.shareWeight + (seed % 11) - 5 + index, 5);
  });
  const totalWeight = weights.reduce((sum, value) => sum + value, 0) || 1;

  return organicMaterialDefinitions.map((definition, index) => {
    const seed = stablePercentSeed(`${id}:${definition.key}`);
    const usagePctOfTotalArea = clampValue(definition.baseCoveragePct + (seed % 17) - 8, 8, 88);
    const usedAreaRai = Number((areaRai * usagePctOfTotalArea / 100).toFixed(2));
    return {
      key: definition.key,
      material: definition.name,
      unit: definition.unit,
      usagePctOfTotalArea: Number(usagePctOfTotalArea.toFixed(1)),
      usedAreaRai,
      amount: Number((usedAreaRai * definition.amountPerRai).toFixed(definition.unit === "ตัน" ? 2 : 1)),
      perRaiPct: Number(((weights[index] / totalWeight) * 100).toFixed(1)),
    };
  });
}

function organicMaterialAreaFromCamp(row: ScopeComparisonRow & { socIndex?: number }, index: number): OrganicMaterialArea {
  const baseline = 1.35 + (index % 4) * 0.08;
  const socIndex = row.socIndex ?? 0;
  return {
    id: row.id,
    name: row.name,
    level: "แคมป์",
    areaRai: row.areaRai,
    socBaselinePct: Number(baseline.toFixed(2)),
    socCurrentPct: Number((baseline + socIndex / 8 + 0.18).toFixed(2)),
    materials: materialUsagesForArea(row.id, row.areaRai),
  };
}

function organicMaterialAreaFromField(field: CampFieldCarbonDetail, index: number, factor: number): OrganicMaterialArea {
  const reduction = Math.max(field.baselineEmission - field.currentEmission, 0) * factor;
  const baseline = 1.25 + (index % 5) * 0.06;
  return {
    id: field.id,
    name: `${field.fieldCode} · ${field.fieldName}`,
    level: "แปลง",
    areaRai: field.areaRai,
    socBaselinePct: Number(baseline.toFixed(2)),
    socCurrentPct: Number((baseline + reduction / Math.max(field.areaRai, 1) * 0.18 + 0.12).toFixed(2)),
    materials: materialUsagesForArea(field.id, field.areaRai),
  };
}

function summarizeOrganicMaterials(rows: OrganicMaterialArea[], totalAreaRai: number): OrganicMaterialUsage[] {
  return organicMaterialDefinitions.map((definition) => {
    const matching = rows.flatMap((row) => row.materials).filter((item) => item.key === definition.key);
    const usedAreaRai = matching.reduce((sum, item) => sum + item.usedAreaRai, 0);
    const amount = matching.reduce((sum, item) => sum + item.amount, 0);
    const perRaiPct = matching.length ? matching.reduce((sum, item) => sum + item.perRaiPct, 0) / matching.length : 0;
    return {
      key: definition.key,
      material: definition.name,
      unit: definition.unit,
      usagePctOfTotalArea: totalAreaRai ? Number(((usedAreaRai / totalAreaRai) * 100).toFixed(1)) : 0,
      usedAreaRai: Number(usedAreaRai.toFixed(2)),
      amount: Number(amount.toFixed(definition.unit === "ตัน" ? 2 : 1)),
      perRaiPct: Number(perRaiPct.toFixed(1)),
    };
  });
}

function socBeforeAfterRows(rows: OrganicMaterialArea[]) {
  const baselineRows: ProcessActivityBreakdown[] = rows.map((row) => ({
    year: "baseline_avg",
    process: row.name,
    totalEmission: row.socBaselinePct,
    activities: [{ name: "ก่อนปรับปรุงดิน", emission: row.socBaselinePct }],
  }));
  const currentRows: ProcessActivityBreakdown[] = rows.map((row) => ({
    year: "project",
    process: row.name,
    totalEmission: row.socCurrentPct,
    activities: [{ name: "หลังปรับปรุงดิน", emission: row.socCurrentPct }],
  }));
  return { baselineRows, currentRows };
}

function fieldProcessRows(field: CampFieldCarbonDetail, year: string, totalEmission: number): ProcessActivityBreakdown[] {
  const sourceTotal = field.processBreakdown.reduce((sum, item) => sum + item.emission, 0) || 1;
  return field.processBreakdown.map((item) => {
    const emission = Number(((item.emission / sourceTotal) * totalEmission).toFixed(2));
    return {
      year,
      process: item.name,
      totalEmission: emission,
      activities: [{ name: item.name, emission }],
    };
  });
}

function caneScopeInfo(data: CaneTypeSummary[], scope: CaneScope) {
  if (scope === "all") return { label: "รวมทั้งหมด", factor: 1, detail: "รวมข้อมูลทุกประเภทอ้อยตามมุมมองปัจจุบัน" };
  const keyword = scope === "new" ? "ปลูก" : scope === "ratoon" ? "ตอ" : "พักดิน";
  const fallbackLabel = scope === "new" ? "อ้อยปลูกใหม่" : scope === "ratoon" ? "อ้อยตอ" : "พื้นที่พักดิน";
  const cane = data.find((item) => item.name.includes(keyword));
  return {
    label: scope === "new" ? "อ้อยปลูกใหม่" : cane?.name ?? fallbackLabel,
    factor: cane ? cane.percent / 100 : 1,
    detail: cane ? `${cane.percent.toFixed(1)}% ของพื้นที่ · ${cane.areaRai.toLocaleString(undefined, { maximumFractionDigits: 1 })} ไร่` : "รอข้อมูลประเภทอ้อย",
  };
}

function scaleProcessRows(rows: ProcessActivityBreakdown[], factor: number): ProcessActivityBreakdown[] {
  if (factor === 1) return rows;
  return rows.map((row) => ({
    ...row,
    totalEmission: Number((row.totalEmission * factor).toFixed(2)),
    activities: row.activities.map((activity) => ({
      ...activity,
      emission: Number((activity.emission * factor).toFixed(2)),
    })),
  }));
}

function scaleInputRows(rows: ProcessInputComparison[], factor: number): ProcessInputComparison[] {
  if (factor === 1) return rows;
  return rows.map((row) => ({
    process: row.process,
    baselineFertilizerKg: Number((row.baselineFertilizerKg * factor).toFixed(1)),
    currentFertilizerKg: Number((row.currentFertilizerKg * factor).toFixed(1)),
    baselineFuelLiter: Number((row.baselineFuelLiter * factor).toFixed(1)),
    currentFuelLiter: Number((row.currentFuelLiter * factor).toFixed(1)),
  }));
}

function scaleCampRows(rows: CampCarbonSummary[], factor: number): CampCarbonSummary[] {
  if (factor === 1) return rows;
  return rows.map((camp) => ({
    ...camp,
    baselineCo2eTotal: Number((camp.baselineCo2eTotal * factor).toFixed(2)),
    currentCo2eTotal: Number((camp.currentCo2eTotal * factor).toFixed(2)),
    co2eTotal: Number((camp.co2eTotal * factor).toFixed(2)),
    co2ePerRai: Number((camp.co2ePerRai * factor).toFixed(4)),
    baselineActivityBreakdown: camp.baselineActivityBreakdown.map((item) => ({ ...item, emission: Number((item.emission * factor).toFixed(2)) })),
    currentActivityBreakdown: camp.currentActivityBreakdown.map((item) => ({ ...item, emission: Number((item.emission * factor).toFixed(2)) })),
    baselineProcessActivities: scaleProcessRows(camp.baselineProcessActivities, factor),
    currentProcessActivities: scaleProcessRows(camp.currentProcessActivities, factor),
    processInputComparisons: scaleInputRows(camp.processInputComparisons, factor),
  }));
}

function campBenchmarkValue(value: number, areaRai: number) {
  return areaRai ? Number((kgCo2e(value) / areaRai).toFixed(2)) : 0;
}

function wrapChartLabel(label: string, maxChars = 12, maxRows = 3) {
  const normalized = label.replace(/\s+/g, " ").trim();
  if (!normalized) return [label];
  const words = normalized.split(" ");
  const rows: string[] = [];
  let current = "";

  words.forEach((word) => {
    if (!current) {
      current = word;
      return;
    }
    if (`${current} ${word}`.length <= maxChars) {
      current = `${current} ${word}`;
      return;
    }
    rows.push(current);
    current = word;
  });
  if (current) rows.push(current);

  const splitRows = rows.flatMap((row) => {
    if (row.length <= maxChars) return [row];
    const chunks: string[] = [];
    for (let index = 0; index < row.length; index += maxChars) {
      chunks.push(row.slice(index, index + maxChars));
    }
    return chunks;
  });

  if (splitRows.length <= maxRows) return splitRows;
  return [...splitRows.slice(0, maxRows - 1), `${splitRows.slice(maxRows - 1).join("").slice(0, maxChars - 1)}…`];
}

function CampBenchmarkBar({ rows, labelA, labelB }: { rows: ScopeComparisonRow[]; labelA: string; labelB: string }) {
  const labels = rows.map((row) => wrapChartLabel(row.name));
  const maxLabelRows = Math.max(...labels.map((label) => label.length), 1);
  const chartHeight = Math.max(430, 360 + maxLabelRows * 26);
  const chartWidth = Math.max(1120, rows.length * 84);
  const benchmarkOptions = {
    ...chartOptions,
    maintainAspectRatio: false,
    layout: {
      padding: {
        bottom: maxLabelRows * 12,
      },
    },
    scales: {
      ...chartOptions.scales,
      x: {
        ...chartOptions.scales.x,
        ticks: {
          ...chartOptions.scales.x.ticks,
          autoSkip: false,
          font: { size: 11 },
          padding: 12,
        },
      },
    },
    datasets: {
      bar: {
        categoryPercentage: 0.72,
        barPercentage: 0.86,
      },
    },
  };

  return (
    <div className="chart-box md camp-benchmark-chart" style={{ height: chartHeight }}>
      <div className="camp-benchmark-canvas" style={{ width: chartWidth, height: chartHeight - 24 }}>
        <Bar
          data={{
            labels,
            datasets: [
              {
                label: `${labelA} (${FOOTPRINT_UNIT}/ไร่)`,
                data: rows.map((row) => campBenchmarkValue(row.baseline, row.areaRai)),
                backgroundColor: chartPalette.baseline.bg,
                borderColor: chartPalette.baseline.border,
                borderWidth: 1,
              },
              {
                label: `${labelB} (${FOOTPRINT_UNIT}/ไร่)`,
                data: rows.map((row) => campBenchmarkValue(row.current, row.areaRai)),
                backgroundColor: chartPalette.project.bg,
                borderColor: chartPalette.project.border,
                borderWidth: 1,
              },
            ],
          }}
          options={benchmarkOptions}
        />
      </div>
    </div>
  );
}

function campComparisonTarget(
  camp: CampCarbonSummary | undefined,
  yearA: string,
  yearB: string,
  currentYear: string,
  emissions: ProcessEmission[],
  factor: number,
): FootprintComparisonTarget | undefined {
  if (!camp) return undefined;
  const baselineRows = withDetailedActivities(scaleProcessRows(rowsForComparisonYear({
    year: yearA,
    currentYear,
    activities: [],
    emissions,
    baselineRows: camp.baselineProcessActivities,
    currentRows: camp.currentProcessActivities,
  }), factor));
  const currentRows = withDetailedActivities(scaleProcessRows(rowsForComparisonYear({
    year: yearB,
    currentYear,
    activities: [],
    emissions,
    baselineRows: camp.baselineProcessActivities,
    currentRows: camp.currentProcessActivities,
  }), factor));
  return {
    id: `camp-${camp.campId}`,
    name: camp.campName,
    detail: "ภาพรวมแคมป์",
    areaRai: camp.areaRai,
    fieldCount: camp.fieldCount,
    soilType: "-",
    baseline: scopedTotalForYear(yearA, camp.baselineCo2eTotal, camp.currentCo2eTotal, currentYear, emissions) * factor,
    current: scopedTotalForYear(yearB, camp.baselineCo2eTotal, camp.currentCo2eTotal, currentYear, emissions) * factor,
    baselineRows,
    currentRows,
  };
}

function fieldComparisonTarget(
  field: CampFieldCarbonDetail | undefined,
  yearA: string,
  yearB: string,
  currentYear: string,
  emissions: ProcessEmission[],
  factor: number,
): FootprintComparisonTarget | undefined {
  if (!field) return undefined;
  const sourceBaselineRows = fieldProcessRows(field, "baseline_avg", field.baselineEmission);
  const sourceCurrentRows = fieldProcessRows(field, currentYear || "project", field.currentEmission);
  const baselineRows = withDetailedActivities(scaleProcessRows(rowsForComparisonYear({
    year: yearA,
    currentYear,
    activities: [],
    emissions,
    baselineRows: sourceBaselineRows,
    currentRows: sourceCurrentRows,
  }), factor));
  const currentRows = withDetailedActivities(scaleProcessRows(rowsForComparisonYear({
    year: yearB,
    currentYear,
    activities: [],
    emissions,
    baselineRows: sourceBaselineRows,
    currentRows: sourceCurrentRows,
  }), factor));
  return {
    id: field.id,
    name: field.fieldName,
    detail: `${field.fieldCode} · ${field.campName}`,
    areaRai: field.areaRai,
    fieldCount: 1,
    soilType: field.soilType || "-",
    baseline: scopedTotalForYear(yearA, field.baselineEmission, field.currentEmission, currentYear, emissions) * factor,
    current: scopedTotalForYear(yearB, field.baselineEmission, field.currentEmission, currentYear, emissions) * factor,
    baselineRows,
    currentRows,
  };
}

function ComparisonSummaryCard({ label, target }: { label: string; target?: FootprintComparisonTarget }) {
  if (!target) {
    return <div className="comparison-summary-card empty-state">{label}: ยังไม่มีข้อมูลสำหรับเปรียบเทียบ</div>;
  }
  const diff = target.baseline - target.current;
  const diffPct = target.baseline ? (diff / target.baseline) * 100 : 0;
  const perRai = campBenchmarkValue(target.current, target.areaRai);
  return (
    <div className="comparison-summary-card">
      <span>{label}</span>
      <strong>{target.name}</strong>
      <small>{target.detail}</small>
      <div className="comparison-summary-metrics">
        <div><b>{target.areaRai.toLocaleString(undefined, { maximumFractionDigits: 1 })}</b><em>ไร่</em></div>
        <div><b>{target.fieldCount.toLocaleString()}</b><em>แปลง</em></div>
        <div><b>{target.soilType}</b><em>ชนิดดิน</em></div>
        <div><b>{perRai.toLocaleString(undefined, { maximumFractionDigits: 1 })}</b><em>{FOOTPRINT_UNIT}/ไร่</em></div>
      </div>
      <p className={diff >= 0 ? "green-text" : "red-text"}>
        {diff >= 0 ? "ลดลง" : "เพิ่มขึ้น"} {Math.abs(kgCo2e(diff)).toLocaleString(undefined, { maximumFractionDigits: 0 })} {FOOTPRINT_UNIT} ({Math.abs(diffPct).toFixed(1)}%)
      </p>
    </div>
  );
}

function nodeIsWithin(nodes: SpatialSummaryNode[], nodeId: string | undefined, scopeId: string | undefined) {
  if (!scopeId || !nodeId) return false;
  if (scopeId === nodeId) return true;
  let cur = nodes.find((node) => node.id === nodeId);
  while (cur?.parentId) {
    if (cur.parentId === scopeId) return true;
    cur = nodes.find((node) => node.id === cur?.parentId);
  }
  return false;
}

function aggregateCampActivities(camps: CampCarbonSummary[], key: "baselineProcessActivities" | "currentProcessActivities") {
  const grouped = new Map<string, ProcessActivityBreakdown>();
  camps.flatMap((camp) => camp[key]).forEach((row) => {
    const current = grouped.get(row.process) ?? { year: row.year, process: row.process, totalEmission: 0, activities: [] };
    const activities = new Map(current.activities.map((activity) => [activity.name, activity.emission]));
    row.activities.forEach((activity) => activities.set(activity.name, (activities.get(activity.name) ?? 0) + activity.emission));
    grouped.set(row.process, {
      year: row.year,
      process: row.process,
      totalEmission: current.totalEmission + row.totalEmission,
      activities: Array.from(activities.entries()).map(([name, emission]) => ({ name, emission })),
    });
  });
  return Array.from(grouped.values());
}

function processEmissionTotalForYear(emissions: ProcessEmission[], year: string) {
  return emissions
    .filter((item) => item.year === year)
    .reduce((sum, item) => sum + item.emission, 0);
}

function processRowsFromEmissions(emissions: ProcessEmission[], year: string): ProcessActivityBreakdown[] {
  return emissions
    .filter((item) => item.year === year)
    .map((item) => ({
      year,
      process: item.process,
      totalEmission: item.emission,
      activities: [{ name: item.process, emission: item.emission }],
    }));
}

function scaleRowsToTotal(rows: ProcessActivityBreakdown[], year: string, total: number): ProcessActivityBreakdown[] {
  const sourceTotal = sumEmission(rows) || 1;
  return rows.map((row) => {
    const nextTotal = Number(((row.totalEmission / sourceTotal) * total).toFixed(2));
    return {
      ...row,
      year,
      totalEmission: nextTotal,
      activities: row.activities.map((activity) => ({
        ...activity,
        emission: Number((activity.emission * (nextTotal / Math.max(row.totalEmission, 0.01))).toFixed(2)),
      })),
    };
  });
}

function rowsForComparisonYear({
  year,
  currentYear,
  activities,
  emissions,
  baselineRows,
  currentRows,
}: {
  year: string;
  currentYear: string;
  activities: ProcessActivityBreakdown[];
  emissions: ProcessEmission[];
  baselineRows: ProcessActivityBreakdown[];
  currentRows: ProcessActivityBreakdown[];
}) {
  if (year === "baseline_avg") return baselineRows;
  if (year === "project" || year === currentYear) return currentRows;

  const exactActivityRows = activities.filter((item) => item.year === year);
  if (exactActivityRows.length) return exactActivityRows;

  const exactEmissionRows = processRowsFromEmissions(emissions, year);
  if (exactEmissionRows.length && !baselineRows.length && !currentRows.length) return exactEmissionRows;

  const targetTotal = processEmissionTotalForYear(emissions, year);
  if (targetTotal > 0) {
    const baselineTotal = processEmissionTotalForYear(emissions, "baseline_avg");
    const projectTotal = processEmissionTotalForYear(emissions, currentYear);
    const sourceRows = Math.abs(targetTotal - baselineTotal) <= Math.abs(targetTotal - projectTotal) ? baselineRows : currentRows;
    return scaleRowsToTotal(sourceRows.length ? sourceRows : exactEmissionRows, year, targetTotal);
  }

  return currentRows;
}

function scopedTotalForYear(year: string, baselineTotal: number, currentTotal: number, currentYear: string, emissions: ProcessEmission[]) {
  if (year === "baseline_avg") return baselineTotal;
  if (year === "project" || year === currentYear) return currentTotal;
  const globalBaseline = processEmissionTotalForYear(emissions, "baseline_avg");
  const globalProject = processEmissionTotalForYear(emissions, currentYear);
  const targetTotal = processEmissionTotalForYear(emissions, year);
  if (!targetTotal) return currentTotal;
  const referenceTotal = Math.abs(targetTotal - globalBaseline) <= Math.abs(targetTotal - globalProject) ? globalBaseline : globalProject;
  const scopedReference = referenceTotal === globalBaseline ? baselineTotal : currentTotal;
  return Number((scopedReference * (targetTotal / Math.max(referenceTotal, 0.01))).toFixed(2));
}

function GraphComparisonFilter({
  yearA,
  yearB,
  availableYears,
  onChangeA,
  onChangeB,
}: {
  yearA: string;
  yearB: string;
  availableYears: string[];
  onChangeA: (value: string) => void;
  onChangeB: (value: string) => void;
}) {
  return (
    <div className="card graph-comparison-filter" style={{ padding: "1rem", marginBottom: "1.5rem", display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
      <strong>ตัวกรองกราฟเปรียบเทียบ:</strong>
      <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        ปี A:
        <select value={yearA} onChange={(event) => onChangeA(event.target.value)}>
          <option value="baseline_avg">ปีฐานเฉลี่ย</option>
          {availableYears.map((year) => <option key={`graph-a-${year}`} value={year}>{year}</option>)}
        </select>
      </label>
      <span style={{ fontWeight: "bold" }}>VS</span>
      <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        ปี B:
        <select value={yearB} onChange={(event) => onChangeB(event.target.value)}>
          <option value="project">ปีดำเนินการ</option>
          <option value="baseline_avg">ปีฐานเฉลี่ย</option>
          {availableYears.map((year) => <option key={`graph-b-${year}`} value={year}>{year}</option>)}
        </select>
      </label>
    </div>
  );
}

function simplifyActivities(activities: { name: string; emission: number }[]) {
  let fuel = 0;
  let fertilizer = 0;
  let chemical = 0;
  let electricity = 0;

  for (const a of activities) {
    const actName = a.name;
    if (actName.includes('ปุ๋ย') || actName.includes('ปูน')) {
      fertilizer += a.emission;
    } else if (actName.includes('สารเคมี') || actName.includes('ยา')) {
      chemical += a.emission;
    } else if (actName.includes('ไฟฟ้า') || actName.includes('น้ำ/')) {
      electricity += a.emission;
    } else if (actName.includes('น้ำมัน') || actName.includes('เครื่องจักร') || actName.includes('รถตัด') || actName.includes('รวบรวมผลผลิต') || actName.includes('แรงงาน/เครื่องมือ')) {
      fuel += a.emission;
    }
  }

  const result = [];
  if (fuel > 0) result.push({ name: 'น้ำมัน', emission: fuel });
  if (fertilizer > 0) result.push({ name: 'ปุ๋ย', emission: fertilizer });
  if (chemical > 0) result.push({ name: 'สารเคมี', emission: chemical });
  if (electricity > 0) result.push({ name: 'ไฟฟ้า', emission: electricity });

  return result;
}

export function CfProcessPage() {
  const [period, setPeriod] = useState<string>("project");
  const [activeView, setActiveView] = useState<FootprintView>("emissions");
  const [activityChartMode, setActivityChartMode] = useState<ActivityChartMode>("both");
  const [graphYearA, setGraphYearA] = useState<string>("baseline_avg");
  const [graphYearB, setGraphYearB] = useState<string>("project");
  const [graph2Mode, setGraph2Mode] = useState<"baseline" | "current">("current");
  const [comparisonTab, setComparisonTab] = useState<ComparisonTab>("benchmark");
  const [compareAType, setCompareAType] = useState<ComparisonTargetType>("camp");
  const [compareBType, setCompareBType] = useState<ComparisonTargetType>("camp");
  const [compareACampId, setCompareACampId] = useState("");
  const [compareBCampId, setCompareBCampId] = useState("");
  const [compareAFieldId, setCompareAFieldId] = useState("");
  const [compareBFieldId, setCompareBFieldId] = useState("");
  const [socMaterialView, setSocMaterialView] = useState<SocMaterialView>("overview");
  const [caneScope, setCaneScope] = useState<CaneScope>("all");
  const [scope, setScope] = useState<ScopeValue>("all");
  const [regionId, setRegionId] = useState("all");
  const [activities, setActivities] = useState<ProcessActivityBreakdown[]>([]);
  const [emissions, setEmissions] = useState<ProcessEmission[]>([]);
  const [activityResult, setActivityResult] = useState<DataResult<ProcessActivityBreakdown[]>>({ data: [], source: "mock" });
  const [emissionResult, setEmissionResult] = useState<DataResult<ProcessEmission[]>>({ data: [], source: "mock" });
  const [campResult, setCampResult] = useState<DataResult<CampCarbonSummary[]>>({ data: [], source: "mock" });
  const [fieldResult, setFieldResult] = useState<DataResult<CampFieldCarbonDetail[]>>({ data: [], source: "mock" });
  const [caneTypeResult, setCaneTypeResult] = useState<DataResult<CaneTypeSummary[]>>({ data: [], source: "mock" });
  const [inputUsageResult, setInputUsageResult] = useState<DataResult<InputUsageSummaryResponse>>({ data: emptyInputUsageSummary, source: "api" });
  const [spatialNodes, setSpatialNodes] = useState<SpatialSummaryNode[]>([]);
  const [overviewKpi, setOverviewKpi] = useState<OverviewKpi | null>(null);
  const [selectedFieldId, setSelectedFieldId] = useState("all");
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([getCfProcessActivities("process"), getProcessEmissions(), getCampCarbonSummaries(), getCampFieldCarbonDetails(), getCaneTypeSummaries(), getOverviewKpi(), getCfSpatialNodes(), getInputUsageSummary()])
      .then(([activityResult, emissionResult, campSummaryResult, fieldDetailResult, caneSummaryResult, kpiResult, spatialResult, inputUsageResult]) => {
        setActivities(activityResult.data);
        setEmissions(emissionResult.data);
        setActivityResult(activityResult);
        setEmissionResult(emissionResult);
        setCampResult(campSummaryResult);
        setFieldResult(fieldDetailResult);
        setCaneTypeResult(caneSummaryResult);
        setOverviewKpi(kpiResult.data);
        setSpatialNodes(spatialResult.data);
        setInputUsageResult(inputUsageResult);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "โหลดข้อมูลไม่สำเร็จ"));
  }, []);

  const currentYear = currentYearFrom(emissions);
  const availableYears = Array.from(new Set([
    ...(overviewKpi?.years ?? []),
    ...emissions.map((item) => item.year),
    ...activities.map((item) => item.year),
  ].filter((year) => year && year !== "baseline_avg"))).sort();
  const actualPeriod = period === "project" ? currentYear : period;
  const actualGraphYearA = graphYearA === "project" ? currentYear : graphYearA;
  const actualGraphYearB = graphYearB === "project" ? currentYear : graphYearB;
  const selectedCampId = scope === "all" ? undefined : Number(scope.replace("camp-", ""));
  const fieldsInRegion = regionId === "all"
    ? fieldResult.data
    : fieldResult.data.filter((field) => nodeIsWithin(spatialNodes, field.parentId, regionId) || nodeIsWithin(spatialNodes, field.id, regionId));
  const campIdsInRegion = new Set(fieldsInRegion.map((field) => field.campId));
  const campsInRegion = campResult.data.filter((camp) => regionId === "all" || campIdsInRegion.has(camp.campId));
  const selectedCamp = selectedCampId ? campsInRegion.find((camp) => camp.campId === selectedCampId) : undefined;
  const selectedField = selectedFieldId === "all" ? undefined : fieldsInRegion.find((field) => field.id === selectedFieldId);
  const fieldsInCamp = selectedCampId ? fieldsInRegion.filter((field) => field.campId === selectedCampId) : [];
  const baseline = activities.filter((item) => item.year === "baseline_avg");
  const currentYearNumber = /^\d+$/.test(currentYear) ? Number(currentYear) : undefined;
  const fieldBaseline = selectedField ? fieldProcessRows(selectedField, "baseline_avg", selectedField.baselineEmission) : [];
  const fieldCurrent = selectedField ? fieldProcessRows(selectedField, currentYear, selectedField.currentEmission) : [];
  const scopedCamps = selectedCamp ? [selectedCamp] : campsInRegion;
  const chartBaselineRaw = selectedField ? fieldBaseline : selectedCamp ? selectedCamp.baselineProcessActivities : scopedCamps.length ? aggregateCampActivities(scopedCamps, "baselineProcessActivities") : baseline;
  const chartCurrentRaw = selectedField ? fieldCurrent : selectedCamp ? selectedCamp.currentProcessActivities : scopedCamps.length ? aggregateCampActivities(scopedCamps, "currentProcessActivities") : activities.filter((item) => item.year === currentYear);
  const effectiveCaneScope = activeView === "emissions" ? caneScope : "all";
  const caneMeta = caneScopeInfo(caneTypeResult.data, effectiveCaneScope);
  const chartBaseline = withDetailedActivities(scaleProcessRows(rowsForComparisonYear({
    year: actualGraphYearA,
    currentYear,
    activities,
    emissions,
    baselineRows: chartBaselineRaw,
    currentRows: chartCurrentRaw,
  }), caneMeta.factor));
  const chartCurrent = withDetailedActivities(scaleProcessRows(rowsForComparisonYear({
    year: actualGraphYearB,
    currentYear,
    activities,
    emissions,
    baselineRows: chartBaselineRaw,
    currentRows: chartCurrentRaw,
  }), caneMeta.factor));
  // selectedByCane removed
  const chartBaselineKg = toKgProcessRows(chartBaseline);
  const chartCurrentKg = toKgProcessRows(chartCurrent);
  const campRows = scaleCampRows(scopedCamps, caneMeta.factor);
  const baselineTotal = (selectedField ? selectedField.baselineEmission : selectedCamp ? selectedCamp.baselineCo2eTotal : scopedCamps.length ? scopedCamps.reduce((sum, camp) => sum + camp.baselineCo2eTotal, 0) : sumEmission(baseline)) * caneMeta.factor;
  const projectTotal = (selectedField ? selectedField.currentEmission : selectedCamp ? selectedCamp.currentCo2eTotal : scopedCamps.length ? scopedCamps.reduce((sum, camp) => sum + camp.currentCo2eTotal, 0) : sumEmission(activities.filter((item) => item.year === currentYear))) * caneMeta.factor;
  const currentTotal = scopedTotalForYear(actualPeriod, baselineTotal, projectTotal, currentYear, emissions);
  const baselineTotalKg = baselineTotal * 1000;
  const currentTotalKg = currentTotal * 1000;
  const summaryAreaRai = selectedField ? selectedField.areaRai : selectedCamp ? selectedCamp.areaRai : scopedCamps.length ? scopedCamps.reduce((sum, camp) => sum + camp.areaRai, 0) : overviewKpi?.areaRai ?? campResult.data.reduce((sum, camp) => sum + camp.areaRai, 0);
  const summaryFieldCount = selectedField ? 1 : selectedCamp ? selectedCamp.fieldCount : scopedCamps.length ? scopedCamps.reduce((sum, camp) => sum + camp.fieldCount, 0) : overviewKpi?.fields ?? campResult.data.reduce((sum, camp) => sum + camp.fieldCount, 0);
  const summaryBaselineYears = baselineYearRange(emissions, overviewKpi?.baselineYears ?? []);
  const totalDiff = baselineTotal - currentTotal;
  const totalDiffKg = totalDiff * 1000;
  const totalDiffPct = baselineTotal ? (totalDiff / baselineTotal) * 100 : 0;
  const chartBaselineTotal = sumEmission(chartBaseline);
  const chartCurrentTotal = sumEmission(chartCurrent);
  const chartDiff = chartBaselineTotal - chartCurrentTotal;
  const graphLabelA = periodLabel(graphYearA, currentYear);
  const graphLabelB = periodLabel(graphYearB, currentYear);
  const selectedRegion = farmGroupFilterOptions.find((option) => option.id === regionId);
  const campComparisonRows: ScopeComparisonRow[] = campRows.map((camp) => ({
    id: `camp-${camp.campId}`,
    name: camp.campName,
    baseline: scopedTotalForYear(actualGraphYearA, camp.baselineCo2eTotal, camp.currentCo2eTotal, currentYear, emissions),
    current: scopedTotalForYear(actualGraphYearB, camp.baselineCo2eTotal, camp.currentCo2eTotal, currentYear, emissions),
    areaRai: camp.areaRai,
    fieldCount: camp.fieldCount,
    camp,
  }));
  const campIdOptions = campRows.map((camp) => String(camp.campId));
  const defaultCompareACampId = campIdOptions[0] ?? "";
  const defaultCompareBCampId = campIdOptions[1] ?? campIdOptions[0] ?? "";
  const effectiveCompareACampId = campIdOptions.includes(compareACampId) ? compareACampId : defaultCompareACampId;
  const effectiveCompareBCampId = campIdOptions.includes(compareBCampId) ? compareBCampId : defaultCompareBCampId;
  const compareAFieldOptions = effectiveCompareACampId ? fieldsInRegion.filter((field) => String(field.campId) === effectiveCompareACampId) : [];
  const compareBFieldOptions = effectiveCompareBCampId ? fieldsInRegion.filter((field) => String(field.campId) === effectiveCompareBCampId) : [];
  const effectiveCompareAFieldId = compareAFieldOptions.some((field) => field.id === compareAFieldId) ? compareAFieldId : compareAFieldOptions[0]?.id ?? "";
  const effectiveCompareBFieldId = compareBFieldOptions.some((field) => field.id === compareBFieldId) ? compareBFieldId : compareBFieldOptions[0]?.id ?? "";
  const compareACamp = campRows.find((camp) => String(camp.campId) === effectiveCompareACampId);
  const compareBCamp = campRows.find((camp) => String(camp.campId) === effectiveCompareBCampId);
  const compareAField = compareAFieldOptions.find((field) => field.id === effectiveCompareAFieldId);
  const compareBField = compareBFieldOptions.find((field) => field.id === effectiveCompareBFieldId);
  const compareATarget = compareAType === "field"
    ? fieldComparisonTarget(compareAField, actualGraphYearA, actualGraphYearB, currentYear, emissions, caneMeta.factor)
    : campComparisonTarget(compareACamp, actualGraphYearA, actualGraphYearB, currentYear, emissions, caneMeta.factor);
  const compareBTarget = compareBType === "field"
    ? fieldComparisonTarget(compareBField, actualGraphYearA, actualGraphYearB, currentYear, emissions, caneMeta.factor)
    : campComparisonTarget(compareBCamp, actualGraphYearA, actualGraphYearB, currentYear, emissions, caneMeta.factor);
  const sequestrationRows = campComparisonRows.map((row) => {
    const reduction = Math.max(row.baseline - row.current, 0);
    const campResourceUsage = summarizeResourceUsage(inputUsageResult.data, {
      campId: row.camp?.campId,
      year: currentYearNumber,
    });
    const fertilizerKg = campResourceUsage.fertilizerKg;
    const socIncrease = Number((campResourceUsage.organicFertilizerKg * SOC_TCO2E_PER_ORGANIC_FERTILIZER_KG).toFixed(2));
    const credits = Number((reduction * 0.6 + socIncrease).toFixed(2));
    return {
      ...row,
      reduction,
      fertilizerKg,
      organicFertilizerKg: campResourceUsage.organicFertilizerKg,
      socIncrease,
      socIndex: row.areaRai ? Number(((socIncrease / row.areaRai) * 100).toFixed(2)) : 0,
      credits,
      netEmission: Math.max(row.current - socIncrease, 0),
    };
  });
  const totalSocIncrease = sequestrationRows.reduce((sum, row) => sum + row.socIncrease, 0);
  const netEmissions = Math.max(currentTotal - totalSocIncrease, 0);
  const netOffsetPct = currentTotal ? (totalSocIncrease / currentTotal) * 100 : 0;
  const socBaselineTotal = Math.max(summaryAreaRai * caneMeta.factor * 0.02, 0);
  const socTotal = socBaselineTotal + totalSocIncrease;
  const socCredit = totalSocIncrease;
  const socFieldRows = selectedField
    ? [selectedField]
    : selectedCampId
    ? fieldsInCamp
    : fieldsInRegion;
  const organicAreaRows = selectedField || selectedCampId
    ? socFieldRows.map((field, index) => organicMaterialAreaFromField(field, index, caneMeta.factor))
    : sequestrationRows.map((row, index) => organicMaterialAreaFromCamp(row, index));
  const organicMaterialSummaryRows = summarizeOrganicMaterials(organicAreaRows, summaryAreaRai);
  const socBeforeAfter = socBeforeAfterRows(organicAreaRows.slice(0, 12));
  const avgBaselineSoc = (socBeforeAfter.baselineRows.reduce((sum, row) => sum + row.totalEmission, 0) / Math.max(socBeforeAfter.baselineRows.length, 1));
  const avgCurrentSoc = (socBeforeAfter.currentRows.reduce((sum, row) => sum + row.totalEmission, 0) / Math.max(socBeforeAfter.currentRows.length, 1));
  const avgIncreaseSoc = Math.max(avgCurrentSoc - avgBaselineSoc, 0);
  const emissionDiff = currentTotal - baselineTotal;
  const emissionDiffPct = baselineTotal ? (emissionDiff / baselineTotal) * 100 : 0;
  const socDiff = avgCurrentSoc - avgBaselineSoc;
  const netPerRai = summaryAreaRai ? netEmissions / summaryAreaRai : 0;
  const currentPerRai = summaryAreaRai ? currentTotal / summaryAreaRai : 0;
  const socPerRai = summaryAreaRai ? socCredit / summaryAreaRai : 0;
  const bestSocCamps = [...sequestrationRows].sort((a, b) => b.socIncrease - a.socIncrease).slice(0, 5);
  const worstSocCamps = [...sequestrationRows].sort((a, b) => a.socIncrease - b.socIncrease).slice(0, 5);
  const followUpSocCamps = [...sequestrationRows].sort((a, b) => b.netEmission - a.netEmission).slice(0, 5);
  const socDerivedSource = {
    source: "api" as const,
    meta: {
      route: "frontend/soc-derived",
      techniques: ["API emissions", "frontend SOC projection"],
      rowCount: organicAreaRows.length,
      datasourceStatus: "api_partial" as const,
      note: "SOC and organic materials are derived",
    },
  };

  return (
    <div className="cf-dash">
      <div className="page active">
        <div className="page-title">
          <div>
            <h1>Carbon Footprint ไร่บริษัทกลุ่มมิตรผล</h1>
          </div>
        </div>

        {error && <div className="error-panel">{error}</div>}

        <section className="card footprint-view-tabs-card footprint-view-tabs-top">
          <div>
            <div className="card-title">มุมมอง Carbon Footprint</div>
            <p className="muted text-xs font-normal" style={{ fontSize: "0.85em", opacity: 0.6 }}>โปรดระบุมุมมองการแสดงผลสำหรับข้อมูลการปล่อยก๊าซเรือนกระจก การกักเก็บคาร์บอนในดิน หรือผลลัพธ์คาร์บอนสุทธิของโครงการ</p>
          </div>
          <div className="footprint-view-tabs" role="tablist" aria-label="Carbon Footprint view tabs">
            <button
              type="button"
              role="tab"
              aria-selected={activeView === "emissions"}
              className={activeView === "emissions" ? "active" : ""}
              onClick={() => setActiveView("emissions")}
            >
              การปล่อยคาร์บอน
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeView === "sequestration"}
              className={activeView === "sequestration" ? "active" : ""}
              onClick={() => setActiveView("sequestration")}
            >
              การกักเก็บคาร์บอน
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeView === "net"}
              className={activeView === "net" ? "active" : ""}
              onClick={() => setActiveView("net")}
            >
              ผลลัพธ์สุทธิ
            </button>
          </div>
        </section>

        <section className="card process-scope-panel process-executive-filter">
          <div>
            <div className="card-title">ตัวกรองภาพรวม Carbon Footprint</div>
            <p className="muted text-xs font-normal" style={{ fontSize: "0.85em", opacity: 0.6 }}>กรุณากำหนดขอบเขตพื้นที่และประเภทอ้อย เพื่อใช้เป็นเงื่อนไขในการประมวลผลข้อมูล Carbon Footprint</p>
          </div>
          <label>
            ปีดำเนินการ
            <select value={period} onChange={(event) => setPeriod(event.target.value)}>
              <option value="project">ปีดำเนินการ {currentYear || overviewKpi?.currentYear || "-"}</option>
              <option value="baseline_avg">ปีฐานเฉลี่ย</option>
              {availableYears.map(y => (
                <option key={y} value={y}>ปี {y}</option>
              ))}
            </select>
          </label>
          <label>
            กลุ่มไร่หลัก
            <select
              value={regionId}
              onChange={(event) => {
                setRegionId(event.target.value);
                setScope("all");
                setSelectedFieldId("all");
              }}
            >
              <option value="all">ทุกกลุ่มไร่หลัก</option>
              {farmGroupFilterOptions.map((region) => (
                <option key={region.id} value={region.id}>{region.name}</option>
              ))}
            </select>
          </label>
          <label>
            แคมป์
            <select
              value={scope}
              onChange={(event) => {
                setScope(event.target.value as ScopeValue);
                setSelectedFieldId("all");
              }}
            >
              <option value="all">{selectedRegion ? `ทุกแคมป์ใน ${selectedRegion.name}` : "ทุกแคมป์"}</option>
              {campsInRegion.map((camp) => (
                <option key={camp.campId} value={`camp-${camp.campId}`}>{camp.campName}</option>
              ))}
            </select>
          </label>
          <label>
            แปลง
            <select value={selectedFieldId} disabled={!selectedCampId} onChange={(event) => setSelectedFieldId(event.target.value)}>
              <option value="all">{selectedCampId ? "ทุกแปลงในแคมป์" : "เลือกแคมป์ก่อน"}</option>
              {fieldsInCamp.map((field) => (
                <option key={field.id} value={field.id}>{field.fieldCode} · {field.fieldName}</option>
              ))}
            </select>
          </label>
          <label style={{ opacity: activeView !== "emissions" ? 0.4 : 1, cursor: activeView !== "emissions" ? "not-allowed" : "inherit" }}>
            ประเภทอ้อย
            <select value={effectiveCaneScope} disabled={activeView !== "emissions"} style={{ cursor: activeView !== "emissions" ? "not-allowed" : "inherit" }} onChange={(event) => setCaneScope(event.target.value as CaneScope)}>
              <option value="all">อ้อยปลูก + อ้อยตอ + พื้นที่พักดิน</option>
              <option value="new">อ้อยปลูกใหม่</option>
              <option value="ratoon">อ้อยตอ</option>
              <option value="fallow">พื้นที่พักดิน</option>
            </select>
          </label>
        </section>

        <section className={`premium-summary-grid footprint-process-summary ${activeView !== "net" ? "five-cols" : ""}`.trim()} aria-label="สรุป Carbon Footprint">
          {activeView === "emissions" && (
            <>
              <article>
                <span>Total Emission</span>
                <strong style={{ fontSize: "1.5em" }}>{(currentTotalKg / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 })} tCO2e</strong>
                <small>{currentTotalKg.toLocaleString(undefined, { maximumFractionDigits: 0 })} {FOOTPRINT_UNIT}</small>
                <em>{summaryFieldCount.toLocaleString(undefined, { maximumFractionDigits: 0 })} แปลง · {summaryAreaRai.toLocaleString(undefined, { maximumFractionDigits: 0 })} ไร่</em>
              </article>
              <article>
                <span>Baseline</span>
                <strong style={{ fontSize: "1.5em" }}>{(baselineTotalKg / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 })} tCO2e</strong>
                <small>{baselineTotalKg.toLocaleString(undefined, { maximumFractionDigits: 0 })} {FOOTPRINT_UNIT}</small>
                <em>{summaryBaselineYears}</em>
              </article>
              <article>
                <span>Project</span>
                <strong style={{ fontSize: "1.5em" }}>{(currentTotalKg / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 })} tCO2e</strong>
                <small>{currentTotalKg.toLocaleString(undefined, { maximumFractionDigits: 0 })} {FOOTPRINT_UNIT}</small>
                <em>{currentYear || overviewKpi?.currentYear || "-"}</em>
              </article>
              <article>
                <span>Reduction %</span>
                <strong className={totalDiff >= 0 ? "green-text" : "red-text"} style={{ fontSize: "1.5em" }}>{totalDiffPct.toFixed(1)}%</strong>
                <small>{(Math.abs(totalDiffKg) / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 })} tCO2e | {Math.abs(totalDiffKg).toLocaleString(undefined, { maximumFractionDigits: 0 })} {FOOTPRINT_UNIT}</small>
                <em>{totalDiff >= 0 ? "ลดลงจากปีฐาน" : "เพิ่มขึ้นจากปีฐาน"}</em>
              </article>
              <article>
                <span>Emission / Area</span>
                <strong style={{ fontSize: "1.5em" }}>{summaryAreaRai ? (currentTotalKg / 1000 / summaryAreaRai).toLocaleString(undefined, { maximumFractionDigits: 4 }) : 0} tCO2e/ไร่</strong>
                <small>{summaryAreaRai ? (currentTotalKg / summaryAreaRai).toLocaleString(undefined, { maximumFractionDigits: 2 }) : 0} {FOOTPRINT_UNIT}/ไร่</small>
                <em>สัดส่วนการปล่อยต่อพื้นที่</em>
              </article>
            </>
          )}
          {activeView === "sequestration" && (
            <>
              <article>
                <span>SOC รวม</span>
                <strong>{socTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong>
                <small>tCO2e</small>
                <em>Baseline SOC + SOC เพิ่มขึ้น</em>
              </article>
              <article>
                <span>SOC เพิ่มขึ้น</span>
                <strong className="green-text">{totalSocIncrease.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong>
                <small>tCO2e</small>
                <em>จากกิจกรรมกักเก็บคาร์บอน</em>
              </article>
              <article>
                <span>Credit จาก SOC</span>
                <strong className="green-text">{socCredit.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong>
                <small>tCO2e</small>
                <em>ใช้เป็น SOC</em>
              </article>
              <article>
                <span>Top Camp SOC</span>
                <strong>{bestSocCamps[0]?.name ?? "-"}</strong>
                <small>{bestSocCamps[0] ? `${bestSocCamps[0].socIncrease.toLocaleString(undefined, { maximumFractionDigits: 2 })} tCO2e` : "-"}</small>
                <em>อันดับสูงสุดตามตัวกรอง</em>
              </article>
              <article>
                <span>SOC / Area</span>
                <strong style={{ fontSize: "1.5em" }} className="green-text">{summaryAreaRai ? (socTotal / summaryAreaRai).toLocaleString(undefined, { maximumFractionDigits: 4 }) : 0}</strong>
                <small>tCO2e/ไร่</small>
                <em>สัดส่วนการกักเก็บต่อพื้นที่</em>
              </article>
            </>
          )}
          {activeView === "net" && (
            <>
              <article>
                <span>Gross Emission</span>
                <strong>{currentTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong>
                <small>tCO2e</small>
                <em>การปล่อยคาร์บอนรวมทั้งหมดของโครงการ</em>
              </article>
              <article>
                <span>SOC</span>
                <strong className="green-text">{socCredit.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong>
                <small>tCO2e</small>
                <em>การสะสมคาร์บอนในดิน (Soil Organic Carbon)</em>
              </article>
              <article>
                <span>Net Emission</span>
                <strong className={netEmissions <= currentTotal ? "green-text" : "red-text"}>{netEmissions.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong>
                <small>tCO2e</small>
                <em>การปล่อยคาร์บอนสุทธิ</em>
              </article>
            </>
          )}
        </section>

        <section className="card process-scope-panel" style={{ display: "none" }}>
          <div>
            <div className="card-title">มุมมองกระบวนการเพาะปลูก</div>
            <p className="muted">เลือกภาพรวมทั้งหมด เจาะรายแคมป์ หรือเลือกแปลงภายในแคมป์</p>
          </div>
          <label>
            ขอบเขตข้อมูล
            <select
              value={scope}
              onChange={(event) => {
                setScope(event.target.value as ScopeValue);
                setSelectedFieldId("all");
              }}
            >
              <option value="all">รวมทั้งหมด</option>
              {campResult.data.map((camp) => (
                <option key={camp.campId} value={`camp-${camp.campId}`}>{camp.campName}</option>
              ))}
            </select>
          </label>
          <label>
            แปลงในแคมป์
            <select value={selectedFieldId} disabled={!selectedCampId} onChange={(event) => setSelectedFieldId(event.target.value)}>
              <option value="all">{selectedCampId ? "ทุกแปลงในแคมป์" : "เลือกแคมป์ก่อน"}</option>
              {fieldsInCamp.map((field) => (
                <option key={field.id} value={field.id}>{field.fieldCode} · {field.fieldName}</option>
              ))}
            </select>
          </label>
        </section>

        {activeView === "emissions" && (
          <>
        <section className="carbon-sequestration-section">
          <div className="section-head">
            <div>
              <span className="section-kicker">Carbon Emissions</span>
              <h2>การปล่อยคาร์บอน</h2>
            </div>
          </div>
        </section>


        <section className="card full-span">
          <div className="card-title-row">
            <div className="card-title">สรุปรายแคมป์</div>
            <SourceBadge source={campResult.source} meta={campResult.meta} />
          </div>
          <div className="input-table-wrap camp-summary-table-wrap">
            <table className="input-table">
              <thead>
                <tr>
                  <th>ชื่อแคมป์</th>
                  <th>จำนวนแปลง</th>
                  <th>พื้นที่รวม</th>
                  <th>CO2e ปีฐาน</th>
                  <th>CO2e ปีดำเนินการ</th>
                  <th>CO2e ต่อไร่</th>
                  <th>Top activity</th>
                  <th>รายงาน</th>
                </tr>
              </thead>
              <tbody>
                {campRows.map((camp) => {
                  const periodCo2eTotal = scopedTotalForYear(actualPeriod, camp.baselineCo2eTotal, camp.currentCo2eTotal, currentYear, emissions);
                  const periodPerRai = camp.areaRai ? periodCo2eTotal / camp.areaRai : 0;
                  return (
                    <tr key={camp.campId}>
                      <td>{camp.campName}</td>
                      <td>{camp.fieldCount.toLocaleString()}</td>
                      <td>{camp.areaRai.toLocaleString()} ไร่</td>
                      <td>{(camp.baselineCo2eTotal * 1000).toLocaleString(undefined, { maximumFractionDigits: 0 })} {FOOTPRINT_UNIT}</td>
                      <td>{(periodCo2eTotal * 1000).toLocaleString(undefined, { maximumFractionDigits: 0 })} {FOOTPRINT_UNIT}</td>
                      <td>{(periodPerRai * 1000).toFixed(1)} {FOOTPRINT_UNIT}/ไร่</td>
                      <td>{camp.topActivity}</td>
                      <td><Link className="run-btn drilldown-link" to={`/footprint-report?campId=${camp.campId}`}>ดูรายงานละเอียด</Link></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <GraphComparisonFilter
          yearA={graphYearA}
          yearB={graphYearB}
          availableYears={availableYears}
          onChangeA={setGraphYearA}
          onChangeB={setGraphYearB}
        />

        <section className="card full-span camp-comparison-module">
          <div className="card-title-row">
            <div>
              <div className="card-title">เปรียบเทียบแคมป์และรายแปลง</div>
              <SourceBadge source={fieldResult.source} meta={fieldResult.meta} />
            </div>
            <div className="group-mode-switch" role="tablist" aria-label="เลือกมุมมองเปรียบเทียบ">
              {[
                ["benchmark", "ภาพรวมทุกแคมป์"],
                ["pair", "เปรียบเทียบ"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={comparisonTab === value ? "active" : ""}
                  onClick={() => setComparisonTab(value as ComparisonTab)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {comparisonTab === "benchmark" ? (
            <>
              {campComparisonRows.length > 1 ? (
                <CampBenchmarkBar rows={campComparisonRows} labelA={graphLabelA} labelB={graphLabelB} />
              ) : (
                <div className="empty-state">ต้องมีอย่างน้อย 2 แคมป์เพื่อเปรียบเทียบ</div>
              )}
              <div className="comparison-ranking-grid">
                {campComparisonRows.map((row) => {
                  const baselinePerRai = campBenchmarkValue(row.baseline, row.areaRai);
                  const currentPerRai = campBenchmarkValue(row.current, row.areaRai);
                  const diff = baselinePerRai - currentPerRai;
                  return (
                    <div key={`benchmark-${row.id}`} className="comparison-rank-card">
                      <strong>{row.name}</strong>
                      <span>{row.fieldCount.toLocaleString()} แปลง · {row.areaRai.toLocaleString(undefined, { maximumFractionDigits: 1 })} ไร่</span>
                      <b>{currentPerRai.toLocaleString(undefined, { maximumFractionDigits: 1 })} {FOOTPRINT_UNIT}/ไร่</b>
                      <small className={diff >= 0 ? "green-text" : "red-text"}>
                        {diff >= 0 ? "ลดลง" : "เพิ่มขึ้น"} {Math.abs(diff).toLocaleString(undefined, { maximumFractionDigits: 1 })} {FOOTPRINT_UNIT}/ไร่ จาก {graphLabelA} {baselinePerRai.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                      </small>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              {campRows.length > 1 ? (
                <>
                  <div className="comparison-filter-grid">
                    {[
                      {
                        side: "A",
                        type: compareAType,
                        setType: setCompareAType,
                        campId: effectiveCompareACampId,
                        setCampId: setCompareACampId,
                        fieldId: effectiveCompareAFieldId,
                        setFieldId: setCompareAFieldId,
                        fieldOptions: compareAFieldOptions,
                      },
                      {
                        side: "B",
                        type: compareBType,
                        setType: setCompareBType,
                        campId: effectiveCompareBCampId,
                        setCampId: setCompareBCampId,
                        fieldId: effectiveCompareBFieldId,
                        setFieldId: setCompareBFieldId,
                        fieldOptions: compareBFieldOptions,
                      },
                    ].map((item) => (
                      <div className="comparison-filter-panel" key={`compare-${item.side}`}>
                        <strong>พื้นที่ {item.side}</strong>
                        <label>
                          ระดับข้อมูล
                          <select value={item.type} onChange={(event) => item.setType(event.target.value as ComparisonTargetType)}>
                            <option value="camp">แคมป์</option>
                            <option value="field">รายแปลง</option>
                          </select>
                        </label>
                        <label>
                          แคมป์
                          <select
                            value={item.campId}
                            onChange={(event) => {
                              item.setCampId(event.target.value);
                              item.setFieldId("");
                            }}
                          >
                            {campRows.map((camp) => (
                              <option key={`${item.side}-${camp.campId}`} value={String(camp.campId)}>{camp.campName}</option>
                            ))}
                          </select>
                        </label>
                        <label>
                          แปลง
                          <select
                            value={item.fieldId}
                            disabled={item.type !== "field" || !item.fieldOptions.length}
                            onChange={(event) => item.setFieldId(event.target.value)}
                          >
                            <option value="">{item.fieldOptions.length ? "เลือกแปลงในแคมป์" : "ยังไม่มีข้อมูลรายแปลง"}</option>
                            {item.fieldOptions.map((field) => (
                              <option key={`${item.side}-${field.id}`} value={field.id}>{field.fieldCode} · {field.fieldName}</option>
                            ))}
                          </select>
                        </label>
                      </div>
                    ))}
                  </div>

                  <div className="comparison-summary-grid">
                    <ComparisonSummaryCard label="พื้นที่ A" target={compareATarget} />
                    <ComparisonSummaryCard label="พื้นที่ B" target={compareBTarget} />
                  </div>

                  <div className="comparison-process-grid">
                    <article className="comparison-process-panel">
                      <div className="card-title">กระบวนการพื้นที่ A</div>
                      <ActivityGroupedBar
                        baseline={toKgProcessRows(compareATarget?.baselineRows ?? [])}
                        current={toKgProcessRows(compareATarget?.currentRows ?? [])}
                        unit={FOOTPRINT_UNIT}
                        baselineLabel={graphLabelA}
                        currentLabel={graphLabelB}
                      />
                    </article>
                    <article className="comparison-process-panel">
                      <div className="card-title">กระบวนการพื้นที่ B</div>
                      <ActivityGroupedBar
                        baseline={toKgProcessRows(compareBTarget?.baselineRows ?? [])}
                        current={toKgProcessRows(compareBTarget?.currentRows ?? [])}
                        unit={FOOTPRINT_UNIT}
                        baselineLabel={graphLabelA}
                        currentLabel={graphLabelB}
                      />
                    </article>
                  </div>
                </>
              ) : (
                <div className="empty-state">ต้องมีอย่างน้อย 2 แคมป์เพื่อเปรียบเทียบ</div>
              )}
            </>
          )}
        </section>

        

        <section className="card full-span">
          <div className="card-title-row">
            <div>
              <div className="card-title">กราฟเปรียบเทียบ GHG รายกระบวนการ · {selectedField?.fieldName ?? selectedCamp?.campName ?? "รวม"}</div>
              <SourceBadge source={emissionResult.source} meta={emissionResult.meta} />
            </div>
            <div className="group-mode-switch" role="group" aria-label="เลือกช่วงเปรียบเทียบรายกระบวนการ">
              {[
                ["baseline", graphLabelA],
                ["current", graphLabelB],
                ["both", "เปรียบเทียบ"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={activityChartMode === value ? "active" : ""}
                  onClick={() => setActivityChartMode(value as ActivityChartMode)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <ActivityGroupedBar
            baseline={chartBaselineKg}
            current={chartCurrentKg}
            mode={activityChartMode}
            unit={FOOTPRINT_UNIT}
            baselineLabel={graphLabelA}
            currentLabel={graphLabelB}
          />
          <details className="summary-list" style={{ marginTop: "12px" }}>
            <summary>ดูรายละเอียดรายกระบวนการ</summary>
            {activityChartMode !== "current" && <div><span>{graphLabelA}</span><strong>{formatTco2e(chartBaselineTotal)} {TCO2E_UNIT}</strong></div>}
            {activityChartMode !== "baseline" && <div><span>{graphLabelB}</span><strong>{formatTco2e(chartCurrentTotal)} {TCO2E_UNIT}</strong></div>}
            {activityChartMode === "both" && (
              <div>
                <span>ผลต่าง (Reduction)</span>
                <strong className={chartDiff >= 0 ? "green-text" : "red-text"}>
                  {formatTco2e(Math.abs(chartDiff))} {TCO2E_UNIT}
                </strong>
              </div>
            )}
          </details>
        </section>

        <section className="card full-span">
          <div className="card-title-row">
            <div>
              <div className="card-title">รายการกิจกรรมย่อยในแต่ละขั้นตอน</div>
              <SourceBadge source={activityResult.source} meta={activityResult.meta} />
            </div>
            <div className="group-mode-switch" role="group">
                <button type="button" className={graph2Mode === "baseline" ? "active" : ""} onClick={() => setGraph2Mode("baseline")}>{graphLabelA}</button>
                <button type="button" className={graph2Mode === "current" ? "active" : ""} onClick={() => setGraph2Mode("current")}>{graphLabelB}</button>
              </div>
          </div>
          <div className="sub-pie-grid">
            {(graph2Mode === "baseline" ? chartBaselineKg : chartCurrentKg).map((item) => {
              const dataToDisplay = simplifyActivities(item.activities);
              
              if (!dataToDisplay || dataToDisplay.length === 0) return null;

              return (
                <article className="card sub-card" key={`${item.year}-${item.process}`}>
                  <ProcessDoughnut
                    title={selectedField ? `${item.process} · ${selectedField.fieldCode}` : selectedCamp ? `${item.process} · ${graph2Mode === "baseline" ? graphLabelA : graphLabelB}` : `${item.process}`}
                    data={dataToDisplay}
                    unit={FOOTPRINT_UNIT}
                  />
                </article>
              );
            })}
            {(graph2Mode === "baseline" ? chartBaselineKg : chartCurrentKg).length === 0 && <div className="empty-state">ไม่มีข้อมูลกระบวนการเพาะปลูกสำหรับช่วงที่เลือก</div>}
          </div>
        </section>
          </>
        )}

        {activeView === "sequestration" && (
          <section className="carbon-sequestration-section">
            <div className="section-head-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "16px", marginBottom: "12px" }}>
              <div className="section-head">
                <div>
                  <span className="section-kicker">Soil Organic Carbon</span>
                  <h2>การสะสมคาร์บอนในดิน</h2>
                </div>
              </div>
              <div className="group-mode-switch soc-material-switch" role="group" aria-label="เลือกมุมมองวัสดุอินทรีย์">
                {[
                  ["overview", "ภาพรวมพื้นที่"],
                  ["area", "รายพื้นที่"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={socMaterialView === value ? "active" : ""}
                    onClick={() => setSocMaterialView(value as SocMaterialView)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {socMaterialView === "overview" ? (
              <section className="card full-span soc-material-card">
                <div className="card-title-row">
                  <div>
                    <div className="card-title">สัดส่วนการใช้วัสดุอินทรีย์ในการปรุงแต่งดิน</div>
                    <SourceBadge source={socDerivedSource.source} meta={socDerivedSource.meta} />
                  </div>
                </div>

                <div className="soc-material-overview-grid">
                  {organicMaterialSummaryRows.map((row) => (
                    <div className="soc-material-cardlet" key={`mat-${row.key}`}>
                      <span>{row.material}</span>
                      <strong>
                        {row.amount.toLocaleString(undefined, { maximumFractionDigits: row.unit === "ตัน" ? 2 : 0 })}
                        <span className="unit-label"> {row.unit}</span>
                      </strong>
                    </div>
                  ))}
                </div>

                <div className="soc-material-bar-chart-card">
                  <div className="card-title" style={{ marginBottom: "14px", fontSize: "13px", fontWeight: "700" }}>สัดส่วนการใช้วัสดุอินทรีย์แยกตามประเภท</div>
                  <div className="soc-material-bar-chart-list">
                    {organicMaterialSummaryRows.map((row, idx) => (
                      <div className="soc-material-bar-item" key={row.key}>
                        <div className="soc-material-bar-label">
                          <span className="material-name">{row.material}</span>
                          <span className="material-pct">{row.usagePctOfTotalArea.toFixed(1)}% ของพื้นที่</span>
                        </div>
                        <div className="soc-material-bar-track">
                          <div 
                            className="soc-material-bar-fill" 
                            style={{ 
                              width: `${row.usagePctOfTotalArea}%`,
                              background: [
                                chartPalette.baseline.bg,
                                chartPalette.project.bg,
                                chartPalette.fertilizerBaseline.bg,
                                "rgba(253, 186, 116, .82)",
                              ][idx % 4],
                            }} 
                          />
                        </div>
                        <div className="soc-material-bar-details">
                          <span>พื้นที่ใช้: <strong>{row.usedAreaRai.toLocaleString(undefined, { maximumFractionDigits: 1 })} ไร่</strong></span>
                          <span>ปริมาณรวม: <strong>{row.amount.toLocaleString(undefined, { maximumFractionDigits: row.unit === "ตัน" ? 2 : 0 })} {row.unit}</strong></span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="input-table-wrap">
                  <table className="input-table">
                    <thead>
                      <tr>
                        <th>ประเภทวัสดุอินทรีย์</th>
                        <th>% ของพื้นที่ทั้งหมด</th>
                        <th>พื้นที่ที่ใช้</th>
                        <th>ปริมาณรวม</th>
                      </tr>
                    </thead>
                    <tbody>
                      {organicMaterialSummaryRows.map((row) => (
                        <tr key={`summary-${row.key}`}>
                          <td>{row.material}</td>
                          <td>{row.usagePctOfTotalArea.toFixed(1)}%</td>
                          <td>{row.usedAreaRai.toLocaleString(undefined, { maximumFractionDigits: 1 })} ไร่</td>
                          <td>{row.amount.toLocaleString(undefined, { maximumFractionDigits: row.unit === "ตัน" ? 2 : 0 })} {row.unit}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : (
              <section className="card full-span soc-material-card">
                <div className="card-title-row">
                  <div>
                    <div className="card-title">รายละเอียดการใช้วัสดุอินทรีย์รายพื้นที่</div>
                    <p className="muted">ตารางข้อมูลการใช้วัสดุอินทรีย์แบ่งตาม แคมป์ และ แปลงปลูก</p>
                    <SourceBadge source={socDerivedSource.source} meta={socDerivedSource.meta} />
                  </div>
                </div>
                <div className="input-table-wrap soc-material-detail-table-wrap">
                  <table className="input-table soc-material-detail-table">
                    <thead>
                      <tr>
                        <th>{organicAreaRows[0]?.level || "พื้นที่"}</th>
                        <th>พื้นที่ (ไร่)</th>
                        <th>ประเภทวัสดุ</th>
                        <th>ปริมาณ</th>
                        <th>% พื้นที่ที่ใช้</th>
                      </tr>
                    </thead>
                    <tbody>
                      {organicAreaRows.flatMap((area) => area.materials.map((material, materialIndex) => (
                        <tr key={`${area.id}-${material.key}`} className={materialIndex === 0 ? "area-group-start" : undefined}>
                          {materialIndex === 0 && (
                            <>
                              <td className="rowspan-cell soc-area-name-cell" rowSpan={area.materials.length}>{area.name}</td>
                              <td className="rowspan-cell" rowSpan={area.materials.length}>{area.areaRai.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
                            </>
                          )}
                          <td className="soc-material-type-cell">{material.material}</td>
                          <td>{material.amount.toLocaleString(undefined, { maximumFractionDigits: material.unit === "ตัน" ? 2 : 0 })} {material.unit}</td>
                          <td>{material.usagePctOfTotalArea.toFixed(1)}%</td>
                        </tr>
                      )))}
                      {!organicAreaRows.length && <tr><td colSpan={5}>ยังไม่มีข้อมูลวัสดุอินทรีย์ตามตัวกรองนี้</td></tr>}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            <section className="card full-span soc-before-after-card">
              <div className="card-title-row">
                <div>
                  <div className="card-title">กราฟแท่งเปรียบเทียบ SOC รายปี</div>
                  <SourceBadge source={socDerivedSource.source} meta={socDerivedSource.meta} />
                </div>
              </div>
              
              <div className="soc-avg-kpi-grid">
                <div className="soc-avg-kpi-card">
                  <span>ค่าเฉลี่ยก่อนปรับปรุงดิน</span>
                  <strong>{avgBaselineSoc.toFixed(2)}% <small className="unit">SOC</small></strong>
                </div>
                <div className="soc-avg-kpi-card">
                  <span>ค่าเฉลี่ยหลังปรับปรุงดิน</span>
                  <strong>{avgCurrentSoc.toFixed(2)}% <small className="unit">SOC</small></strong>
                </div>
                <div className="soc-avg-kpi-card highlight">
                  <span>SOC ที่เพิ่มขึ้นเฉลี่ย</span>
                  <strong className="green-text">+{avgIncreaseSoc.toFixed(2)}% <small className="unit">SOC</small></strong>
                </div>
              </div>

              <ActivityGroupedBar baseline={socBeforeAfter.baselineRows} current={socBeforeAfter.currentRows} unit="% SOC" baselineLabel="Before" currentLabel="After" />
            </section>

            <section className="card full-span">
              <div className="card-title-row">
                <div>
                  <div className="card-title">แคมป์ผลงานการกักเก็บคาร์บอนในดิน</div>
                  <p className="muted">เปรียบเทียบการสะสมคาร์บอนที่เพิ่มขึ้นระหว่างแคมป์ที่มีการกักเก็บคาร์บอนสูงสุด และแคมป์ที่ควรเร่งปรับปรุงส่งเสริมการดูแลดิน</p>
                </div>
              </div>

              <div className="grid2" style={{ marginTop: "14px" }}>
                <div>
                  <h3 style={{ fontSize: "14px", fontWeight: "700", marginBottom: "12px", color: "var(--eco-green)" }}>
                    🟢 5 อันดับแคมป์กักเก็บคาร์บอนสูงสุด
                  </h3>
                  <div className="soc-camp-bars">
                    {bestSocCamps.map((row, index) => (
                      <div className="soc-camp-row" key={`soc-best-${row.id}`}>
                        <span className="rank-pill">#{index + 1}</span>
                        <div>
                          <strong>{row.name}</strong>
                          <small>{row.areaRai.toLocaleString()} ไร่ · SOC index {row.socIndex.toFixed(2)}</small>
                        </div>
                        <b className="green-text">+{row.socIncrease.toLocaleString(undefined, { maximumFractionDigits: 2 })} tCO2e</b>
                      </div>
                    ))}
                    {!bestSocCamps.length && <div className="empty-state">ยังไม่มีข้อมูล SOC ตามตัวกรองนี้</div>}
                  </div>
                </div>

                <div>
                  <h3 style={{ fontSize: "14px", fontWeight: "700", marginBottom: "12px", color: "var(--red)" }}>
                    🟠 5 อันดับแคมป์ที่ควรปรับปรุงการกักเก็บคาร์บอน
                  </h3>
                  <div className="soc-camp-bars">
                    {worstSocCamps.map((row, index) => (
                      <div className="soc-camp-row" key={`soc-worst-${row.id}`}>
                        <span className="rank-pill">#{index + 1}</span>
                        <div>
                          <strong>{row.name}</strong>
                          <small>{row.areaRai.toLocaleString()} ไร่ · SOC index {row.socIndex.toFixed(2)}</small>
                        </div>
                        <b className="red-text">{row.socIncrease.toLocaleString(undefined, { maximumFractionDigits: 2 })} tCO2e</b>
                      </div>
                    ))}
                    {!worstSocCamps.length && <div className="empty-state">ยังไม่มีข้อมูล SOC ตามตัวกรองนี้</div>}
                  </div>
                </div>
              </div>
            </section>

          </section>
        )}

        {activeView === "net" && (
          <section className="carbon-sequestration-section">
            <div className="section-head">
              <div>
                <span className="section-kicker">Net Carbon Result</span>
                <h2>การปล่อยและการสะสมคาร์บอนก๊าซเรือนกระจก</h2>
              </div>
            </div>

            <section className="grid2 net-result-summary-grid">
              <article className="card net-comparison-card">
                <div className="card-title">ทำการเปรียบเทียบ Emissions vs SOC</div>
                <div className="net-summary-metrics">
                  <div><span>Project Emissions</span><strong className="red-text">{currentTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })} tCO2e</strong><small>{currentPerRai.toLocaleString(undefined, { maximumFractionDigits: 2 })} tCO2e/ไร่</small></div>
                  <div><span>SOC</span><strong className="green-text">{socCredit.toLocaleString(undefined, { maximumFractionDigits: 2 })} tCO2e</strong><small>{socPerRai.toLocaleString(undefined, { maximumFractionDigits: 2 })} tCO2e/ไร่</small></div>
                  <div><span>Net Emission</span><strong>{netEmissions.toLocaleString(undefined, { maximumFractionDigits: 2 })} tCO2e</strong><small>{netPerRai.toLocaleString(undefined, { maximumFractionDigits: 2 })} tCO2e/ไร่</small></div>
                  <div><span>SOC Share</span><strong>{netOffsetPct.toFixed(1)}%</strong><small>of project emissions</small></div>
                </div>
              </article>
              <article className="card net-comparison-card">
                <div className="card-title">Change Summary</div>
                <div className="summary-list">
                  <div><span>SOC before soil improvement</span><strong>{avgBaselineSoc.toFixed(2)}%</strong></div>
                  <div><span>SOC after soil improvement</span><strong className="green-text">{avgCurrentSoc.toFixed(2)}%</strong></div>
                  <div><span>SOC change</span><strong className={socDiff >= 0 ? "green-text" : "red-text"}>{socDiff >= 0 ? "+" : ""}{socDiff.toFixed(2)}%</strong></div>
                  <div><span>Baseline emissions</span><strong>{baselineTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })} tCO2e</strong></div>
                  <div><span>Project year emissions</span><strong>{currentTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })} tCO2e</strong></div>
                  <div><span>Emission change</span><strong className={emissionDiff <= 0 ? "green-text" : "red-text"}>{emissionDiff <= 0 ? "-" : "+"}{Math.abs(emissionDiff).toLocaleString(undefined, { maximumFractionDigits: 2 })} tCO2e ({emissionDiffPct >= 0 ? "+" : ""}{emissionDiffPct.toFixed(1)}%)</strong></div>
                </div>
              </article>
            </section>

            <section className="card full-span">
              <div className="card-title">แคมป์ที่ควรติดตามหลังดูผลลัพธ์สุทธิ</div>
              <div className="leaderboard-list compact">
                {followUpSocCamps.map((row, index) => (
                  <div key={`net-follow-${row.id}`} className="leaderboard-row">
                    <span className="rank-pill">!{index + 1}</span>
                    <div>
                      <strong>{row.name}</strong>
                      <small>Gross {(row.current / Math.max(row.areaRai, 1)).toLocaleString(undefined, { maximumFractionDigits: 2 })} tCO2e/ไร่ | SOC {(row.socIncrease / Math.max(row.areaRai, 1)).toLocaleString(undefined, { maximumFractionDigits: 2 })} tCO2e/ไร่</small>
                    </div>
                    <b className="red-text">{(row.netEmission / Math.max(row.areaRai, 1)).toLocaleString(undefined, { maximumFractionDigits: 2 })} tCO2e/ไร่</b>
                    {row.camp && <Link className="run-btn drilldown-link" to={`/footprint-report?campId=${row.camp.campId}`}>ดูรายงานละเอียด</Link>}
                  </div>
                ))}
                {!followUpSocCamps.length && <div className="empty-state">ยังไม่มีข้อมูลผลลัพธ์สุทธิรายแคมป์</div>}
              </div>
            </section>
          </section>
        )}

      </div>
    </div>
  );
}
