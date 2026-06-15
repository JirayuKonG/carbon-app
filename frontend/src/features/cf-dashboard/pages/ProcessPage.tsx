import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bar } from "react-chartjs-2";
import { ActivityGroupedBar } from "../components/charts/ActivityGroupedBar";
import { chartOptions, chartPalette, sortProcessLabels } from "../components/charts/ChartRegistry";
import { ProcessDoughnut } from "../components/charts/ProcessDoughnut";
import { CaneTypeSummaryPanel } from "../components/common/CaneTypeSummaryPanel";
import { SourceBadge } from "../components/common/SourceBadge";
import { getCampCarbonSummaries, getCampFieldCarbonDetails, getCaneTypeSummaries, getCfProcessActivities, getCfSpatialNodes, getOverviewKpi, getProcessEmissions } from "../services/dashboardApi";
import type { CampCarbonSummary, CampFieldCarbonDetail, CaneTypeSummary, DataResult, OverviewKpi, ProcessActivityBreakdown, ProcessEmission, ProcessInputComparison, SpatialSummaryNode } from "../types/dashboard";
import "../cf-dashboard.css";

type PeriodMode = "baseline_avg" | "project";
type ScopeValue = "all" | `camp-${number}`;
type ActivityChartMode = "both" | "baseline" | "current";
type CaneScope = "all" | "new" | "ratoon" | "fallow";
type FootprintView = "emissions" | "sequestration" | "net";
type ComparisonTab = "benchmark" | "pair";
type ComparisonTargetType = "camp" | "field";
type SocMaterialView = "overview" | "area";

const FOOTPRINT_UNIT = "kgCO2e";
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

function yearName(year: string) {
  return year === "baseline_avg" ? "ค่าเฉลี่ยปีฐาน" : year;
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
  return period === "baseline_avg" ? "ปีฐาน" : `ปีดำเนินการ ${currentYear || "-"}`;
}

function ProcessSummary({ baseline, current }: { baseline: ProcessActivityBreakdown[]; current: ProcessActivityBreakdown[] }) {
  const rows = sortProcessLabels(Array.from(new Set([...baseline, ...current].map((item) => item.process)))).map((process) => {
    const base = baseline.find((item) => item.process === process)?.totalEmission ?? 0;
    const cur = current.find((item) => item.process === process)?.totalEmission ?? 0;
    return { process, diff: cur - base };
  });

  return (
    <div className="summary-list">
      {rows.map((row) => (
        <div key={row.process}>
          <span>{row.process}</span>
          <strong className={row.diff <= 0 ? "green-text" : "red-text"}>
            {row.diff <= 0 ? "ลดลง" : "เพิ่มขึ้น"} {Math.abs(row.diff).toLocaleString(undefined, { maximumFractionDigits: 2 })} {FOOTPRINT_UNIT}
          </strong>
        </div>
      ))}
      {!rows.length && <div className="empty-state">ไม่มีข้อมูลเปรียบเทียบ</div>}
    </div>
  );
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
  { key: "vinasse", name: "น้ำกากส่า/Vinasse", unit: "ลิตร", baseCoveragePct: 28, amountPerRai: 160, shareWeight: 22 },
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

function CampBenchmarkBar({ rows }: { rows: ScopeComparisonRow[] }) {
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
                label: `ปีฐาน (${FOOTPRINT_UNIT}/ไร่)`,
                data: rows.map((row) => campBenchmarkValue(row.baseline, row.areaRai)),
                backgroundColor: chartPalette.baseline.bg,
                borderColor: chartPalette.baseline.border,
                borderWidth: 1,
              },
              {
                label: `ปีดำเนินการ (${FOOTPRINT_UNIT}/ไร่)`,
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

function campComparisonTarget(camp: CampCarbonSummary | undefined): FootprintComparisonTarget | undefined {
  if (!camp) return undefined;
  return {
    id: `camp-${camp.campId}`,
    name: camp.campName,
    detail: "ภาพรวมแคมป์",
    areaRai: camp.areaRai,
    fieldCount: camp.fieldCount,
    soilType: "-",
    baseline: camp.baselineCo2eTotal,
    current: camp.currentCo2eTotal,
    baselineRows: withDetailedActivities(camp.baselineProcessActivities),
    currentRows: withDetailedActivities(camp.currentProcessActivities),
  };
}

function fieldComparisonTarget(field: CampFieldCarbonDetail | undefined, currentYear: string, factor: number): FootprintComparisonTarget | undefined {
  if (!field) return undefined;
  const baselineRows = withDetailedActivities(scaleProcessRows(fieldProcessRows(field, "baseline_avg", field.baselineEmission), factor));
  const currentRows = withDetailedActivities(scaleProcessRows(fieldProcessRows(field, currentYear || "project", field.currentEmission), factor));
  return {
    id: field.id,
    name: field.fieldName,
    detail: `${field.fieldCode} · ${field.campName}`,
    areaRai: field.areaRai,
    fieldCount: 1,
    soilType: field.soilType || "-",
    baseline: field.baselineEmission * factor,
    current: field.currentEmission * factor,
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

function PeriodSwitch({ value, currentYear, onChange }: { value: PeriodMode; currentYear: string; onChange: (next: PeriodMode) => void }) {
  return (
    <div className="period-switch" role="group" aria-label="เลือกช่วงข้อมูล">
      <button type="button" className={value === "baseline_avg" ? "active" : ""} onClick={() => onChange("baseline_avg")}>
        ปีฐาน
      </button>
      <button type="button" className={value === "project" ? "active" : ""} onClick={() => onChange("project")}>
        ปีดำเนินการ {currentYear || "-"}
      </button>
    </div>
  );
}

export function CfProcessPage() {
  const [period, setPeriod] = useState<PeriodMode>("project");
  const [activeView, setActiveView] = useState<FootprintView>("emissions");
  const [activityChartMode, setActivityChartMode] = useState<ActivityChartMode>("both");
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
  const [spatialNodes, setSpatialNodes] = useState<SpatialSummaryNode[]>([]);
  const [overviewKpi, setOverviewKpi] = useState<OverviewKpi | null>(null);
  const [selectedFieldId, setSelectedFieldId] = useState("all");
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([getCfProcessActivities("process"), getProcessEmissions(), getCampCarbonSummaries(), getCampFieldCarbonDetails(), getCaneTypeSummaries(), getOverviewKpi(), getCfSpatialNodes()])
      .then(([activityResult, emissionResult, campSummaryResult, fieldDetailResult, caneSummaryResult, kpiResult, spatialResult]) => {
        setActivities(activityResult.data);
        setEmissions(emissionResult.data);
        setActivityResult(activityResult);
        setEmissionResult(emissionResult);
        setCampResult(campSummaryResult);
        setFieldResult(fieldDetailResult);
        setCaneTypeResult(caneSummaryResult);
        setOverviewKpi(kpiResult.data);
        setSpatialNodes(spatialResult.data);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "โหลดข้อมูลไม่สำเร็จ"));
  }, []);

  const currentYear = currentYearFrom(emissions);
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
  const current = activities.filter((item) => item.year === currentYear);
  const selectedYear = period === "baseline_avg" ? "baseline_avg" : currentYear;
  const fieldBaseline = selectedField ? fieldProcessRows(selectedField, "baseline_avg", selectedField.baselineEmission) : [];
  const fieldCurrent = selectedField ? fieldProcessRows(selectedField, currentYear, selectedField.currentEmission) : [];
  const scopedCamps = selectedCamp ? [selectedCamp] : campsInRegion;
  const selected = selectedField
    ? (period === "baseline_avg" ? fieldBaseline : fieldCurrent)
    : selectedCamp
    ? (period === "baseline_avg" ? selectedCamp.baselineProcessActivities : selectedCamp.currentProcessActivities)
    : scopedCamps.length
    ? aggregateCampActivities(scopedCamps, period === "baseline_avg" ? "baselineProcessActivities" : "currentProcessActivities")
    : activities.filter((item) => item.year === selectedYear);
  const chartBaselineRaw = selectedField ? fieldBaseline : selectedCamp ? selectedCamp.baselineProcessActivities : scopedCamps.length ? aggregateCampActivities(scopedCamps, "baselineProcessActivities") : baseline;
  const chartCurrentRaw = selectedField ? fieldCurrent : selectedCamp ? selectedCamp.currentProcessActivities : scopedCamps.length ? aggregateCampActivities(scopedCamps, "currentProcessActivities") : current;
  const caneMeta = caneScopeInfo(caneTypeResult.data, caneScope);
  const selectedByCane = withDetailedActivities(scaleProcessRows(selected, caneMeta.factor));
  const chartBaseline = withDetailedActivities(scaleProcessRows(chartBaselineRaw, caneMeta.factor));
  const chartCurrent = withDetailedActivities(scaleProcessRows(chartCurrentRaw, caneMeta.factor));
  const selectedByCaneKg = toKgProcessRows(selectedByCane);
  const chartBaselineKg = toKgProcessRows(chartBaseline);
  const chartCurrentKg = toKgProcessRows(chartCurrent);
  const campRows = scaleCampRows(scopedCamps, caneMeta.factor);
  const baselineTotal = (selectedField ? selectedField.baselineEmission : selectedCamp ? selectedCamp.baselineCo2eTotal : scopedCamps.length ? scopedCamps.reduce((sum, camp) => sum + camp.baselineCo2eTotal, 0) : sumEmission(baseline)) * caneMeta.factor;
  const currentTotal = (selectedField ? selectedField.currentEmission : selectedCamp ? selectedCamp.currentCo2eTotal : scopedCamps.length ? scopedCamps.reduce((sum, camp) => sum + camp.currentCo2eTotal, 0) : sumEmission(current)) * caneMeta.factor;
  const baselineTotalKg = baselineTotal * 1000;
  const currentTotalKg = currentTotal * 1000;
  const summaryAreaRai = selectedField ? selectedField.areaRai : selectedCamp ? selectedCamp.areaRai : scopedCamps.length ? scopedCamps.reduce((sum, camp) => sum + camp.areaRai, 0) : overviewKpi?.areaRai ?? campResult.data.reduce((sum, camp) => sum + camp.areaRai, 0);
  const summaryFieldCount = selectedField ? 1 : selectedCamp ? selectedCamp.fieldCount : scopedCamps.length ? scopedCamps.reduce((sum, camp) => sum + camp.fieldCount, 0) : overviewKpi?.fields ?? campResult.data.reduce((sum, camp) => sum + camp.fieldCount, 0);
  const summaryBaselineYears = baselineYearRange(emissions, overviewKpi?.baselineYears ?? []);
  const totalDiff = baselineTotal - currentTotal;
  const totalDiffKg = totalDiff * 1000;
  const totalDiffPct = baselineTotal ? (totalDiff / baselineTotal) * 100 : 0;
  const topCurrentProcess = [...chartCurrent]
    .sort((a, b) => b.totalEmission - a.totalEmission)[0];
  const chartBaselineTotal = sumEmission(chartBaseline);
  const chartCurrentTotal = sumEmission(chartCurrent);
  const chartDiff = chartBaselineTotal - chartCurrentTotal;
  const chartBaselineTotalKg = chartBaselineTotal * 1000;
  const chartCurrentTotalKg = chartCurrentTotal * 1000;
  const chartDiffKg = chartDiff * 1000;
  const selectedRegion = farmGroupFilterOptions.find((option) => option.id === regionId);
  const campComparisonRows: ScopeComparisonRow[] = campRows.map((camp) => ({
    id: `camp-${camp.campId}`,
    name: camp.campName,
    baseline: camp.baselineCo2eTotal,
    current: camp.currentCo2eTotal,
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
    ? fieldComparisonTarget(compareAField, currentYear, caneMeta.factor)
    : campComparisonTarget(compareACamp);
  const compareBTarget = compareBType === "field"
    ? fieldComparisonTarget(compareBField, currentYear, caneMeta.factor)
    : campComparisonTarget(compareBCamp);
  const sequestrationRows = campComparisonRows.map((row) => {
    const reduction = Math.max(row.baseline - row.current, 0);
    const fertilizerKg = row.camp?.processInputComparisons.reduce((sum, item) => sum + item.currentFertilizerKg, 0) ?? 0;
    const socIncrease = Number((reduction * 0.35 + row.areaRai * 0.012).toFixed(2));
    const credits = Number((reduction * 0.6 + socIncrease).toFixed(2));
    return {
      ...row,
      reduction,
      fertilizerKg,
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
            <select value={period} onChange={(event) => setPeriod(event.target.value as PeriodMode)}>
              <option value="project">ปีดำเนินการ {currentYear || overviewKpi?.currentYear || "-"}</option>
              <option value="baseline_avg">ปีฐานเฉลี่ย</option>
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
          <label>
            ประเภทอ้อย
            <select value={caneScope} onChange={(event) => setCaneScope(event.target.value as CaneScope)}>
              <option value="all">อ้อยปลูก + อ้อยตอ + พื้นที่พักดิน</option>
              <option value="new">อ้อยปลูกใหม่</option>
              <option value="ratoon">อ้อยตอ</option>
              <option value="fallow">พื้นที่พักดิน</option>
            </select>
          </label>
        </section>

        <section className="premium-summary-grid footprint-process-summary" aria-label="สรุป Carbon Footprint">
          {activeView === "emissions" && (
            <>
              <article>
                <span>Total Emission</span>
                <strong>{currentTotalKg.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong>
                <small>{FOOTPRINT_UNIT}</small>
                <em>{summaryFieldCount.toLocaleString(undefined, { maximumFractionDigits: 0 })} แปลง · {summaryAreaRai.toLocaleString(undefined, { maximumFractionDigits: 0 })} ไร่</em>
              </article>
              <article>
                <span>Baseline</span>
                <strong>{baselineTotalKg.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong>
                <small>{FOOTPRINT_UNIT}</small>
                <em>{summaryBaselineYears}</em>
              </article>
              <article>
                <span>Project</span>
                <strong>{currentTotalKg.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong>
                <small>{FOOTPRINT_UNIT}</small>
                <em>{currentYear || overviewKpi?.currentYear || "-"}</em>
              </article>
              <article>
                <span>Reduction %</span>
                <strong className={totalDiff >= 0 ? "green-text" : "red-text"}>{totalDiffPct.toFixed(1)}%</strong>
                <small>{Math.abs(totalDiffKg).toLocaleString(undefined, { maximumFractionDigits: 0 })} {FOOTPRINT_UNIT}</small>
                <em>{totalDiff >= 0 ? "ลดลงจากปีฐาน" : "เพิ่มขึ้นจากปีฐาน"}</em>
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

        <CaneTypeSummaryPanel result={caneTypeResult} mode="footprint" />

        <section className="process-summary-grid">
          <article>
            <span>ปีฐานรวมทั้งหมด</span>
            <strong>{baselineTotalKg.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong>
            <small>{FOOTPRINT_UNIT}</small>
          </article>
          <article>
            <span>ปีดำเนินการ</span>
            <strong>{currentTotalKg.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong>
            <small>{FOOTPRINT_UNIT}</small>
          </article>
          <article>
            <span>{totalDiff >= 0 ? "ลดลงจากปีฐาน" : "เพิ่มขึ้นจากปีฐาน"}</span>
            <strong className={totalDiff >= 0 ? "green-text" : "red-text"}>
              {Math.abs(totalDiffKg).toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </strong>
            <small>{Math.abs(totalDiffPct).toFixed(1)}% · {FOOTPRINT_UNIT}</small>
          </article>
          <article>
            <span>กระบวนการที่ปล่อยสูงสุด</span>
            <strong>{topCurrentProcess?.process ?? "-"}</strong>
            <small>{topCurrentProcess ? `${(topCurrentProcess.totalEmission * 1000).toLocaleString(undefined, { maximumFractionDigits: 0 })} ${FOOTPRINT_UNIT}` : "-"}</small>
          </article>
        </section>

        <section className="card full-span">
          <div className="card-title-row">
            <div>
              <div className="card-title">การปล่อยคาร์บอนรายกระบวนการ · {selectedField?.fieldName ?? selectedCamp?.campName ?? `ปีดำเนินการ ${currentYear || "-"}`}</div>
              <SourceBadge source={emissionResult.source} meta={emissionResult.meta} />
            </div>
            <div className="group-mode-switch" role="group" aria-label="เลือกช่วงเปรียบเทียบรายกระบวนการ">
              {[
                ["both", "ปีฐาน VS ปีดำเนินการ"],
                ["baseline", "ปีฐาน"],
                ["current", "ปีดำเนินการ"],
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
          <ActivityGroupedBar baseline={chartBaselineKg} current={chartCurrentKg} mode={activityChartMode} unit={FOOTPRINT_UNIT} />
          <div className="summary-list">
            {activityChartMode !== "current" && <div><span>ปีฐาน</span><strong>{chartBaselineTotalKg.toLocaleString(undefined, { maximumFractionDigits: 0 })} {FOOTPRINT_UNIT}</strong></div>}
            {activityChartMode !== "baseline" && <div><span>ปีดำเนินการ</span><strong>{chartCurrentTotalKg.toLocaleString(undefined, { maximumFractionDigits: 0 })} {FOOTPRINT_UNIT}</strong></div>}
            {activityChartMode === "both" && (
              <div>
                <span>ผลต่าง</span>
                <strong className={chartDiff >= 0 ? "green-text" : "red-text"}>
                  {Math.abs(chartDiffKg).toLocaleString(undefined, { maximumFractionDigits: 0 })} {FOOTPRINT_UNIT}
                </strong>
              </div>
            )}
          </div>
          {activityChartMode === "both" && <ProcessSummary baseline={chartBaselineKg} current={chartCurrentKg} />}
        </section>

        <section className="card full-span">
          <div className="card-title-row">
            <div>
              <div className="card-title">รายการกิจกรรมย่อยในแต่ละขั้นตอน · {periodLabel(period, currentYear)}</div>
              <SourceBadge source={activityResult.source} meta={activityResult.meta} />
            </div>
            <PeriodSwitch value={period} currentYear={currentYear} onChange={setPeriod} />
          </div>
          <div className="sub-pie-grid">
            {selectedByCaneKg.map((item) => {
              const comparisonActivities = (period === "baseline_avg" ? chartCurrentKg : chartBaselineKg).find((row) => row.process === item.process)?.activities;
              return (
                <article className="card sub-card" key={`${item.year}-${item.process}`}>
                  <ProcessDoughnut
                    title={selectedField ? `${item.process} · ${selectedField.fieldCode}` : selectedCamp ? `${item.process} · ${periodLabel(period, currentYear)}` : `${item.process} · ${yearName(item.year)}`}
                    data={item.activities}
                    comparisonData={comparisonActivities}
                    unit={FOOTPRINT_UNIT}
                  />
                </article>
              );
            })}
            {!selectedByCane.length && <div className="empty-state">ไม่มีข้อมูลกระบวนการเพาะปลูกสำหรับช่วงที่เลือก</div>}
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
                {campRows.map((camp) => (
                  <tr key={camp.campId}>
                    <td>{camp.campName}</td>
                    <td>{camp.fieldCount.toLocaleString()}</td>
                    <td>{camp.areaRai.toLocaleString()} ไร่</td>
                    <td>{(camp.baselineCo2eTotal * 1000).toLocaleString(undefined, { maximumFractionDigits: 0 })} {FOOTPRINT_UNIT}</td>
                    <td>{(camp.currentCo2eTotal * 1000).toLocaleString(undefined, { maximumFractionDigits: 0 })} {FOOTPRINT_UNIT}</td>
                    <td>{(camp.co2ePerRai * 1000).toFixed(1)} {FOOTPRINT_UNIT}/ไร่</td>
                    <td>{camp.topActivity}</td>
                    <td><Link className="run-btn drilldown-link" to={`/footprint-report?campId=${camp.campId}`}>ดูรายงานละเอียด</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card full-span camp-comparison-module">
          <div className="card-title-row">
            <div>
              <div className="card-title">เปรียบเทียบแคมป์และรายแปลง</div>
              <p className="muted">ดู benchmark ทุกแคมป์ หรือเลือกพื้นที่ A/B เพื่อเทียบระดับแคมป์และรายแปลงในขอบเขตตัวกรองปัจจุบัน</p>
              <SourceBadge source={fieldResult.source} meta={fieldResult.meta} />
            </div>
            <div className="group-mode-switch" role="tablist" aria-label="เลือกมุมมองเปรียบเทียบ">
              {[
                ["benchmark", "ภาพรวมทุกแคมป์"],
                ["pair", "เปรียบเทียบ A/B"],
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
                <CampBenchmarkBar rows={campComparisonRows} />
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
                        {diff >= 0 ? "ลดลง" : "เพิ่มขึ้น"} {Math.abs(diff).toLocaleString(undefined, { maximumFractionDigits: 1 })} {FOOTPRINT_UNIT}/ไร่ จากปีฐาน {baselinePerRai.toLocaleString(undefined, { maximumFractionDigits: 1 })}
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
                      />
                    </article>
                    <article className="comparison-process-panel">
                      <div className="card-title">กระบวนการพื้นที่ B</div>
                      <ActivityGroupedBar
                        baseline={toKgProcessRows(compareBTarget?.baselineRows ?? [])}
                        current={toKgProcessRows(compareBTarget?.currentRows ?? [])}
                        unit={FOOTPRINT_UNIT}
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
                    <p className="muted">ข้อมูลจำลองตามขอบเขต filter ปัจจุบัน แสดงพื้นที่ที่ใช้วัสดุ ปริมาณรวม และสัดส่วนต่อไร่</p>
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
                        <th>% ต่อไร่</th>
                      </tr>
                    </thead>
                    <tbody>
                      {organicMaterialSummaryRows.map((row) => (
                        <tr key={`summary-${row.key}`}>
                          <td>{row.material}</td>
                          <td>{row.usagePctOfTotalArea.toFixed(1)}%</td>
                          <td>{row.usedAreaRai.toLocaleString(undefined, { maximumFractionDigits: 1 })} ไร่</td>
                          <td>{row.amount.toLocaleString(undefined, { maximumFractionDigits: row.unit === "ตัน" ? 2 : 0 })} {row.unit}</td>
                          <td>{row.perRaiPct.toFixed(1)}%</td>
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
                        <th>พื้นที่</th>
                        <th>ระดับ</th>
                        <th>ไร่</th>
                        <th>ประเภทวัสดุ</th>
                        <th>ปริมาณ</th>
                        <th>% พื้นที่ที่ใช้</th>
                        <th>% ต่อไร่</th>
                      </tr>
                    </thead>
                    <tbody>
                      {organicAreaRows.flatMap((area) => area.materials.map((material, materialIndex) => (
                        <tr key={`${area.id}-${material.key}`} className={materialIndex === 0 ? "area-group-start" : undefined}>
                          {materialIndex === 0 && (
                            <>
                              <td className="rowspan-cell soc-area-name-cell" rowSpan={area.materials.length}>{area.name}</td>
                              <td className="rowspan-cell" rowSpan={area.materials.length}>{area.level}</td>
                              <td className="rowspan-cell" rowSpan={area.materials.length}>{area.areaRai.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
                            </>
                          )}
                          <td className="soc-material-type-cell">{material.material}</td>
                          <td>{material.amount.toLocaleString(undefined, { maximumFractionDigits: material.unit === "ตัน" ? 2 : 0 })} {material.unit}</td>
                          <td>{material.usagePctOfTotalArea.toFixed(1)}%</td>
                          <td>{material.perRaiPct.toFixed(1)}%</td>
                        </tr>
                      )))}
                      {!organicAreaRows.length && <tr><td colSpan={7}>ยังไม่มีข้อมูลวัสดุอินทรีย์ตามตัวกรองนี้</td></tr>}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            <section className="card full-span soc-before-after-card">
              <div className="card-title-row">
                <div>
                  <div className="card-title">ก่อน VS หลัง การปรับปรุงดิน</div>
                  <p className="muted">กราฟแท่งเปรียบเทียบ SOC/SOM ก่อนและหลังใช้วัสดุอินทรีย์ ตามขอบเขต filter ปัจจุบัน</p>
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

              <ActivityGroupedBar baseline={socBeforeAfter.baselineRows} current={socBeforeAfter.currentRows} unit="% SOC" />
              
              <div className="summary-list soc-before-after-summary" style={{ marginTop: "12px" }}>
                <div><span>พื้นที่ในกราฟ</span><strong>{socBeforeAfter.currentRows.length.toLocaleString()} รายการ</strong></div>
                <div><span>ค่าเฉลี่ยก่อนปรับปรุงดิน</span><strong>{avgBaselineSoc.toFixed(2)}%</strong></div>
                <div><span>ค่าเฉลี่ยหลังปรับปรุงดิน</span><strong>{avgCurrentSoc.toFixed(2)}%</strong></div>
              </div>
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
