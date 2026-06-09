import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ActivityGroupedBar } from "../components/charts/ActivityGroupedBar";
import { NetZeroProgressBar } from "../components/charts/NetZeroProgressBar";
import { sortProcessLabels } from "../components/charts/ChartRegistry";
import { ProcessDoughnut } from "../components/charts/ProcessDoughnut";
import { SocCorrelationChart } from "../components/charts/SocCorrelationChart";
import { CaneTypeSummaryPanel } from "../components/common/CaneTypeSummaryPanel";
import { getCampCarbonSummaries, getCampFieldCarbonDetails, getCaneTypeSummaries, getCfProcessActivities, getCfSpatialNodes, getOverviewKpi, getProcessEmissions } from "../services/dashboardApi";
import type { ActivityValue, CampCarbonSummary, CampFieldCarbonDetail, CaneTypeSummary, DataResult, OverviewKpi, ProcessActivityBreakdown, ProcessEmission, ProcessInputComparison, SpatialSummaryNode } from "../types/dashboard";
import "../cf-dashboard.css";

type PeriodMode = "baseline_avg" | "project";
type ScopeValue = "all" | `camp-${number}`;
type DonutMode = "camp" | "activity" | "field";
type CaneScope = "all" | "new" | "ratoon";
type FootprintView = "emissions" | "sequestration";

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
            {row.diff <= 0 ? "ลดลง" : "เพิ่มขึ้น"} {Math.abs(row.diff).toFixed(2)} tCO2e
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

function processEmissionValues(rows: ProcessActivityBreakdown[]): ActivityValue[] {
  return sortProcessLabels(rows.map((row) => row.process)).map((process) => {
    const emission = rows.find((row) => row.process === process)?.totalEmission ?? 0;
    return { name: process, emission: Number(emission.toFixed(2)) };
  });
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
  const keyword = scope === "new" ? "ปลูก" : "ตอ";
  const fallbackLabel = scope === "new" ? "อ้อยปลูกใหม่" : "อ้อยตอ";
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

function comparisonRowsToActivities(rows: ScopeComparisonRow[], year: string, key: "baseline" | "current"): ProcessActivityBreakdown[] {
  return rows.map((row) => ({
    year,
    process: row.name,
    totalEmission: key === "baseline" ? row.baseline : row.current,
    activities: [{ name: row.name, emission: key === "baseline" ? row.baseline : row.current }],
  }));
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
  const [donutMode, setDonutMode] = useState<DonutMode>("camp");
  const [caneScope, setCaneScope] = useState<CaneScope>("all");
  const [scope, setScope] = useState<ScopeValue>("all");
  const [regionId, setRegionId] = useState("all");
  const [activities, setActivities] = useState<ProcessActivityBreakdown[]>([]);
  const [emissions, setEmissions] = useState<ProcessEmission[]>([]);
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
  const rootNode = spatialNodes.find((node) => !node.parentId);
  const regionOptions = spatialNodes.filter((node) => node.level === "region" && (!rootNode || node.parentId === rootNode.id));
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
  const caneMeta = caneScopeInfo(caneTypeResult.data, "all");
  const selectedByCane = scaleProcessRows(selected, caneMeta.factor);
  const chartBaseline = scaleProcessRows(chartBaselineRaw, caneMeta.factor);
  const chartCurrent = scaleProcessRows(chartCurrentRaw, caneMeta.factor);
  const campRows = scaleCampRows(scopedCamps, caneMeta.factor);
  const baselineTotal = (selectedField ? selectedField.baselineEmission : selectedCamp ? selectedCamp.baselineCo2eTotal : scopedCamps.length ? scopedCamps.reduce((sum, camp) => sum + camp.baselineCo2eTotal, 0) : sumEmission(baseline)) * caneMeta.factor;
  const currentTotal = (selectedField ? selectedField.currentEmission : selectedCamp ? selectedCamp.currentCo2eTotal : scopedCamps.length ? scopedCamps.reduce((sum, camp) => sum + camp.currentCo2eTotal, 0) : sumEmission(current)) * caneMeta.factor;
  const summaryAreaRai = selectedField ? selectedField.areaRai : selectedCamp ? selectedCamp.areaRai : scopedCamps.length ? scopedCamps.reduce((sum, camp) => sum + camp.areaRai, 0) : overviewKpi?.areaRai ?? campResult.data.reduce((sum, camp) => sum + camp.areaRai, 0);
  const summaryFieldCount = selectedField ? 1 : selectedCamp ? selectedCamp.fieldCount : scopedCamps.length ? scopedCamps.reduce((sum, camp) => sum + camp.fieldCount, 0) : overviewKpi?.fields ?? campResult.data.reduce((sum, camp) => sum + camp.fieldCount, 0);
  const summaryBaselineYears = baselineYearRange(emissions, overviewKpi?.baselineYears ?? []);
  const totalDiff = baselineTotal - currentTotal;
  const totalDiffPct = baselineTotal ? (totalDiff / baselineTotal) * 100 : 0;
  const topCurrentProcess = [...chartCurrent]
    .sort((a, b) => b.totalEmission - a.totalEmission)[0];
  const currentScopeRows = chartCurrent;
  const groupDonutData: ActivityValue[] = donutMode === "camp"
    ? selectedField
      ? [{ name: selectedField.campName, emission: Number((selectedField.currentEmission * caneMeta.factor).toFixed(2)) }]
      : selectedCamp
      ? [{ name: selectedCamp.campName, emission: Number((selectedCamp.currentCo2eTotal * caneMeta.factor).toFixed(2)) }]
      : scopedCamps.map((camp) => ({ name: camp.campName, emission: Number((camp.currentCo2eTotal * caneMeta.factor).toFixed(2)) }))
    : donutMode === "field"
    ? selectedField
      ? [{ name: selectedField.fieldName, emission: Number((selectedField.currentEmission * caneMeta.factor).toFixed(2)) }]
      : (selectedCampId ? fieldsInCamp : fieldsInRegion).map((field) => ({ name: field.fieldName, emission: Number((field.co2eTotal * caneMeta.factor).toFixed(2)) }))
    : processEmissionValues(currentScopeRows);
  const chartBaselineTotal = sumEmission(chartBaseline);
  const chartCurrentTotal = sumEmission(chartCurrent);
  const chartDiff = chartBaselineTotal - chartCurrentTotal;
  const selectedRegion = regionOptions.find((node) => node.id === regionId);
  const regionComparisonRows: ScopeComparisonRow[] = regionOptions.map((region) => {
    const regionFields = fieldResult.data.filter((field) => nodeIsWithin(spatialNodes, field.parentId, region.id) || nodeIsWithin(spatialNodes, field.id, region.id));
    const regionCampIds = new Set(regionFields.map((field) => field.campId));
    const regionCamps = campResult.data.filter((camp) => regionCampIds.has(camp.campId));
    return {
      id: region.id,
      name: region.name,
      baseline: regionCamps.reduce((sum, camp) => sum + camp.baselineCo2eTotal, 0),
      current: regionCamps.reduce((sum, camp) => sum + camp.currentCo2eTotal, 0),
      areaRai: regionCamps.reduce((sum, camp) => sum + camp.areaRai, 0),
      fieldCount: regionCamps.reduce((sum, camp) => sum + camp.fieldCount, 0),
    };
  }).filter((row) => row.fieldCount > 0);
  const campComparisonRows: ScopeComparisonRow[] = campRows.map((camp) => ({
    id: `camp-${camp.campId}`,
    name: camp.campName,
    baseline: camp.baselineCo2eTotal,
    current: camp.currentCo2eTotal,
    areaRai: camp.areaRai,
    fieldCount: camp.fieldCount,
    camp,
  }));
  const comparisonRows = selectedCamp ? campComparisonRows : regionId === "all" ? regionComparisonRows : campComparisonRows;
  const comparisonBaseline = comparisonRowsToActivities(comparisonRows, "baseline_avg", "baseline");
  const comparisonCurrent = comparisonRowsToActivities(comparisonRows, currentYear || "project", "current");
  const topEmitters = [...campComparisonRows].sort((a, b) => b.current - a.current).slice(0, 5);
  const bestReducers = [...campComparisonRows].sort((a, b) => (b.baseline - b.current) - (a.baseline - a.current)).slice(0, 5);
  const bottomReducers = [...campComparisonRows].sort((a, b) => (a.baseline - a.current) - (b.baseline - b.current)).slice(0, 5);
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
      netEmission: Math.max(row.current - credits, 0),
    };
  });
  const totalSocIncrease = sequestrationRows.reduce((sum, row) => sum + row.socIncrease, 0);
  const totalCredits = sequestrationRows.reduce((sum, row) => sum + row.credits, 0);
  const netEmissions = Math.max(currentTotal - totalCredits, 0);
  const netOffsetPct = currentTotal ? (totalCredits / currentTotal) * 100 : 0;
  const bestSocCamps = [...sequestrationRows].sort((a, b) => b.socIncrease - a.socIncrease).slice(0, 5);
  const followUpSocCamps = [...sequestrationRows].sort((a, b) => b.netEmission - a.netEmission).slice(0, 5);
  const socChartMax = Math.max(...sequestrationRows.map((row) => row.socIncrease), 1);
  const socCorrelationData: ProcessInputComparison[] = sequestrationRows.map((row) => ({
    process: row.name,
    baselineFertilizerKg: 0,
    currentFertilizerKg: row.fertilizerKg,
    baselineFuelLiter: 0,
    currentFuelLiter: 0,
  }));
  const socCorrelationValues = sequestrationRows.map((row) => row.socIndex);
  const bestSocInsight = bestSocCamps[0];
  const fertilizerInsight = [...sequestrationRows].filter((row) => row.socIncrease > 0).sort((a, b) => a.fertilizerKg - b.fertilizerKg)[0];

  return (
    <div className="cf-dash">
      <div className="page active">
        <div className="page-title">
          <div>
            <h1>Carbon Footprint ไร่บริษัทกลุ่มมิตรผล</h1>
          </div>
        </div>

        {error && <div className="error-panel">{error}</div>}

        <section className="premium-summary-grid footprint-process-summary" aria-label="สรุป Carbon Footprint">
          <article>
            <span>พื้นที่โครงการ</span>
            <strong>{summaryAreaRai.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong>
            <small>ไร่</small>
            <em>{summaryFieldCount.toLocaleString(undefined, { maximumFractionDigits: 0 })} แปลง</em>
          </article>
          <article>
            <span>Carbon Footprint รวม</span>
            <strong>{currentTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong>
            <small>tCO2e</small>
            <em>รวม N2O + น้ำมัน + SOC</em>
          </article>
          <article>
            <span>ปีที่ดำเนินโครงการ</span>
            <strong>{currentYear || overviewKpi?.currentYear || "-"}</strong>
            <small>Project year</small>
            <em>{currentTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })} tCO2e</em>
          </article>
          <article>
            <span>ปีฐาน Baseline</span>
            <strong>{summaryBaselineYears}</strong>
            <small>Baseline years</small>
            <em>เฉลี่ย {baselineTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })} tCO2e</em>
          </article>
        </section>

        <section className="card process-scope-panel process-executive-filter">
          <div>
            <div className="card-title">ตัวกรองภาพรวม Carbon Footprint</div>
            <p className="muted">หน้านี้ใช้ดูภาพรวมระดับผู้บริหาร เลือกเฉพาะปีดำเนินการ ภาค/โซน และศูนย์ส่งเสริมฯ</p>
          </div>
          <label>
            ปีดำเนินการ
            <select value={period} onChange={(event) => setPeriod(event.target.value as PeriodMode)}>
              <option value="project">ปีดำเนินการ {currentYear || overviewKpi?.currentYear || "-"}</option>
              <option value="baseline_avg">ปีฐานเฉลี่ย</option>
            </select>
          </label>
          <label>
            ภาค/โซน
            <select
              value={regionId}
              onChange={(event) => {
                setRegionId(event.target.value);
                setScope("all");
                setSelectedFieldId("all");
              }}
            >
              <option value="all">ทุกภาค/โซน</option>
              {regionOptions.map((region) => (
                <option key={region.id} value={region.id}>{region.name}</option>
              ))}
            </select>
          </label>
          <label>
            ศูนย์ส่งเสริมฯ (แคมป์)
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

        <section className="card cane-scope-card" style={{ display: "none" }}>
          <div>
            <div className="card-title">ประเภทอ้อยที่ใช้วิเคราะห์</div>
            <p className="muted">{caneMeta.detail}</p>
          </div>
          <div className="cane-scope-switch" role="group" aria-label="เลือกประเภทอ้อย">
            {[
              ["all", "รวมทั้งหมด"],
              ["new", "อ้อยปลูกใหม่"],
              ["ratoon", "อ้อยตอ"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={caneScope === value ? "active" : ""}
                onClick={() => setCaneScope(value as CaneScope)}
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        <section className="card footprint-view-tabs-card">
          <div>
            <div className="card-title">เลือกมุมมองข้อมูล</div>
            <p className="muted">สลับระหว่างภาพรวมการปล่อยคาร์บอน และภาพรวมการกักเก็บ/ชดเชยด้วย SOC & Credits</p>
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
              การกักเก็บ / SOC & Credits
            </button>
          </div>
        </section>

        {activeView === "emissions" && (
          <>
        <CaneTypeSummaryPanel result={caneTypeResult} showSource={false} mode="footprint" />

        <section className="process-summary-grid">
          <article>
            <span>ปีฐานรวมทั้งหมด</span>
            <strong>{baselineTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong>
            <small>tCO2e</small>
          </article>
          <article>
            <span>ปีดำเนินการ</span>
            <strong>{currentTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong>
            <small>tCO2e</small>
          </article>
          <article>
            <span>{totalDiff >= 0 ? "ลดลงจากปีฐาน" : "เพิ่มขึ้นจากปีฐาน"}</span>
            <strong className={totalDiff >= 0 ? "green-text" : "red-text"}>
              {Math.abs(totalDiff).toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </strong>
            <small>{Math.abs(totalDiffPct).toFixed(1)}% · tCO2e</small>
          </article>
          <article>
            <span>กระบวนการที่ปล่อยสูงสุด</span>
            <strong>{topCurrentProcess?.process ?? "-"}</strong>
            <small>{topCurrentProcess ? `${topCurrentProcess.totalEmission.toLocaleString(undefined, { maximumFractionDigits: 2 })} tCO2e` : "-"}</small>
          </article>
        </section>

        <section className="grid2">
          <article className="card">
            <div className="card-title-row">
              <div className="card-title">CO2e ตามกลุ่ม · {selectedField?.fieldName ?? selectedCamp?.campName ?? `ปีดำเนินการ ${currentYear || "-"}`}</div>
              <div className="group-mode-switch" role="group" aria-label="เลือกกลุ่มข้อมูลโดนัท">
                {[
                  ["camp", "ตามแคมป์"],
                  ["activity", "ตามกิจกรรม"],
                  ["field", "ตามแปลง"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={donutMode === value ? "active" : ""}
                    onClick={() => setDonutMode(value as DonutMode)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <ProcessDoughnut data={groupDonutData} />
          </article>
          <article className="card">
            <div className="card-title">Grouped Bar · ปีฐาน vs ปีดำเนินการตาม{selectedCamp ? "กระบวนการของแคมป์" : regionId === "all" ? "รายภาค" : "รายแคมป์"}</div>
            <ActivityGroupedBar baseline={selectedCamp ? chartBaseline : comparisonBaseline} current={selectedCamp ? chartCurrent : comparisonCurrent} />
            {selectedField ? (
              <div className="summary-list">
                <div><span>ปีฐาน</span><strong>{chartBaselineTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })} tCO2e</strong></div>
                <div><span>ปีดำเนินการ</span><strong>{chartCurrentTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })} tCO2e</strong></div>
                <div>
                  <span>ผลต่าง</span>
                  <strong className={chartDiff >= 0 ? "green-text" : "red-text"}>
                    {Math.abs(chartDiff).toFixed(2)} tCO2e
                  </strong>
                </div>
              </div>
            ) : selectedCamp ? (
              <div className="summary-list">
                <div><span>ปีฐาน</span><strong>{chartBaselineTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })} tCO2e</strong></div>
                <div><span>ปีดำเนินการ</span><strong>{chartCurrentTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })} tCO2e</strong></div>
                <div>
                  <span>ผลต่าง</span>
                  <strong className={chartDiff >= 0 ? "green-text" : "red-text"}>
                    {Math.abs(chartDiff).toFixed(2)} tCO2e
                  </strong>
                </div>
              </div>
            ) : (
              <ProcessSummary baseline={chartBaseline} current={chartCurrent} />
            )}
          </article>
        </section>

        <section className="card full-span">
          <div className="card-title-row">
            <div className="card-title">รายการกิจกรรมย่อยในแต่ละขั้นตอน · {periodLabel(period, currentYear)}</div>
            <PeriodSwitch value={period} currentYear={currentYear} onChange={setPeriod} />
          </div>
          <div className="sub-pie-grid">
            {selectedByCane.map((item) => {
              const comparisonActivities = (period === "baseline_avg" ? chartCurrent : chartBaseline).find((row) => row.process === item.process)?.activities;
              return (
                <article className="card sub-card" key={`${item.year}-${item.process}`}>
                  <ProcessDoughnut
                    title={selectedField ? `${item.process} · ${selectedField.fieldCode}` : selectedCamp ? `${item.process} · ${periodLabel(period, currentYear)}` : `${item.process} · ${yearName(item.year)}`}
                    data={item.activities}
                    comparisonData={comparisonActivities}
                  />
                </article>
              );
            })}
            {!selectedByCane.length && <div className="empty-state">ไม่มีข้อมูลกระบวนการเพาะปลูกสำหรับช่วงที่เลือก</div>}
          </div>
        </section>

        <section className="grid2 process-leaderboard-grid">
          <article className="card">
            <div className="card-title">Leaderboard · Top 5 แคมป์ปล่อยคาร์บอนสูงสุด</div>
            <div className="leaderboard-list">
              {topEmitters.map((row, index) => (
                <div key={`top-${row.id}`} className="leaderboard-row">
                  <span className="rank-pill">#{index + 1}</span>
                  <div>
                    <strong>{row.name}</strong>
                    <small>{row.fieldCount.toLocaleString()} แปลง · {row.areaRai.toLocaleString()} ไร่</small>
                  </div>
                  <b className="red-text">{row.current.toLocaleString(undefined, { maximumFractionDigits: 2 })} tCO2e</b>
                  {row.camp && <Link className="run-btn drilldown-link" to={`/footprint-report?campId=${row.camp.campId}`}>ดูรายงานละเอียด</Link>}
                </div>
              ))}
              {!topEmitters.length && <div className="empty-state">ยังไม่มีข้อมูลแคมป์ในเงื่อนไขนี้</div>}
            </div>
          </article>
          <article className="card">
            <div className="card-title">Leaderboard · Top 5 ลดคาร์บอน / SOC ดีที่สุด</div>
            <div className="leaderboard-list">
              {bestReducers.map((row, index) => {
                const reduction = row.baseline - row.current;
                const soc = Math.max(reduction, 0) * 0.35;
                return (
                  <div key={`best-${row.id}`} className="leaderboard-row">
                    <span className="rank-pill">#{index + 1}</span>
                    <div>
                      <strong>{row.name}</strong>
                      <small>SOC โดยประมาณ {soc.toLocaleString(undefined, { maximumFractionDigits: 2 })} tCO2e</small>
                    </div>
                    <b className={reduction >= 0 ? "green-text" : "red-text"}>{reduction.toLocaleString(undefined, { maximumFractionDigits: 2 })} tCO2e</b>
                    {row.camp && <Link className="run-btn drilldown-link" to={`/footprint-report?campId=${row.camp.campId}`}>ดูรายงานละเอียด</Link>}
                  </div>
                );
              })}
              {!bestReducers.length && <div className="empty-state">ยังไม่มีข้อมูลแคมป์ในเงื่อนไขนี้</div>}
            </div>
          </article>
        </section>

        <section className="card full-span">
          <div className="card-title">Bottom 5 · แคมป์ที่ควรติดตามเพิ่มเติม</div>
          <div className="leaderboard-list compact">
            {bottomReducers.map((row, index) => {
              const reduction = row.baseline - row.current;
              return (
                <div key={`bottom-${row.id}`} className="leaderboard-row">
                  <span className="rank-pill">#{index + 1}</span>
                  <div>
                    <strong>{row.name}</strong>
                    <small>Baseline {row.baseline.toLocaleString(undefined, { maximumFractionDigits: 2 })} · Project {row.current.toLocaleString(undefined, { maximumFractionDigits: 2 })} tCO2e</small>
                  </div>
                  <b className={reduction >= 0 ? "green-text" : "red-text"}>{reduction.toLocaleString(undefined, { maximumFractionDigits: 2 })} tCO2e</b>
                  {row.camp && <Link className="run-btn drilldown-link" to={`/footprint-report?campId=${row.camp.campId}`}>ดูรายงานละเอียด</Link>}
                </div>
              );
            })}
          </div>
        </section>

        <section className="card full-span">
          <div className="card-title">สรุปรายแคมป์</div>
          <div className="input-table-wrap">
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
                    <td>{camp.baselineCo2eTotal.toLocaleString()} tCO2e</td>
                    <td>{camp.currentCo2eTotal.toLocaleString()} tCO2e</td>
                    <td>{camp.co2ePerRai.toFixed(3)} tCO2e/ไร่</td>
                    <td>{camp.topActivity}</td>
                    <td><Link className="run-btn drilldown-link" to={`/footprint-report?campId=${camp.campId}`}>ดูรายงานละเอียด</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
          </>
        )}

        {activeView === "sequestration" && (
        <section className="carbon-sequestration-section">
          <div className="section-head">
            <div>
              <span className="section-kicker">Carbon Sequestration / SOC & Credits</span>
              <h2>กักเก็บคืนได้เท่าไหร่ และหลังหักเครดิตแล้วสุทธิเป็นอย่างไร</h2>
              <p className="muted">โซนนี้คำนวณจากแคมป์ที่อยู่ในตัวกรองปัจจุบัน เพื่อดู SOC, Carbon Credits และแคมป์ที่ควรขยายผลหรือติดตามต่อ</p>
            </div>
          </div>

          <section className="process-summary-grid sequestration-kpi-grid">
            <article>
              <span>SOC เพิ่มขึ้นโดยประมาณ</span>
              <strong>{totalSocIncrease.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong>
              <small>tCO2e</small>
              <em>จากการลดการปล่อยและพื้นที่แคมป์</em>
            </article>
            <article>
              <span>Carbon Credits ประมาณการ</span>
              <strong>{totalCredits.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong>
              <small>tCO2e</small>
              <em>{netOffsetPct.toFixed(1)}% ของ emissions ปัจจุบัน</em>
            </article>
            <article>
              <span>Net Emissions หลังหักเครดิต</span>
              <strong className={netEmissions <= currentTotal ? "green-text" : "red-text"}>{netEmissions.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong>
              <small>tCO2e</small>
              <em>Emissions - Credits/SOC</em>
            </article>
            <article>
              <span>แคมป์ SOC ดีที่สุด</span>
              <strong>{bestSocInsight?.name ?? "-"}</strong>
              <small>{bestSocInsight ? `${bestSocInsight.socIncrease.toLocaleString(undefined, { maximumFractionDigits: 2 })} tCO2e` : "-"}</small>
              <em>เหมาะสำหรับขยายผลเป็นแนวทาง</em>
            </article>
          </section>

          <section className="grid2">
            <article className="card">
              <div className="card-title">Net Zero Progress · Emissions vs Credits</div>
              <NetZeroProgressBar emissions={currentTotal} credits={totalCredits} />
              <div className="summary-list">
                <div><span>ปล่อยคาร์บอน</span><strong className="red-text">{currentTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })} tCO2e</strong></div>
                <div><span>ชดเชย/กักเก็บคืน</span><strong className="green-text">{totalCredits.toLocaleString(undefined, { maximumFractionDigits: 2 })} tCO2e</strong></div>
                <div><span>คงเหลือสุทธิ</span><strong>{netEmissions.toLocaleString(undefined, { maximumFractionDigits: 2 })} tCO2e</strong></div>
              </div>
            </article>
            <article className="card">
              <div className="card-title">Correlation · ปุ๋ยเคมี vs SOC</div>
              <SocCorrelationChart data={socCorrelationData} socValues={socCorrelationValues} />
              <p className="muted insight-copy">
                {fertilizerInsight
                  ? `Insight: ${fertilizerInsight.name} มีค่า SOC เพิ่มขึ้น ${fertilizerInsight.socIncrease.toLocaleString(undefined, { maximumFractionDigits: 2 })} tCO2e ในกลุ่มที่ใช้ปุ๋ยเคมีต่ำกว่าแคมป์อื่น ควรใช้เป็นตัวอย่างสำหรับปรับแนวทางลดปุ๋ยเคมีและเพิ่มอินทรียวัตถุ`
                  : "Insight: ยังไม่มีข้อมูลเพียงพอสำหรับวิเคราะห์ความสัมพันธ์ระหว่างปุ๋ยเคมีกับ SOC"}
              </p>
            </article>
          </section>

          <section className="grid2">
            <article className="card">
              <div className="card-title">SOC by Camp · แคมป์ที่กักเก็บได้ดี</div>
              <div className="soc-camp-bars">
                {bestSocCamps.map((row) => (
                  <div className="soc-camp-row" key={`soc-${row.id}`}>
                    <div>
                      <strong>{row.name}</strong>
                      <small>{row.areaRai.toLocaleString()} ไร่ · SOC index {row.socIndex.toFixed(2)}</small>
                    </div>
                    <div className="soc-bar-track" aria-label={`${row.name} SOC ${row.socIncrease} tCO2e`}>
                      <span style={{ width: `${Math.max((row.socIncrease / socChartMax) * 100, 4)}%` }} />
                    </div>
                    <b>{row.socIncrease.toLocaleString(undefined, { maximumFractionDigits: 2 })} tCO2e</b>
                  </div>
                ))}
                {!bestSocCamps.length && <div className="empty-state">ยังไม่มีข้อมูล SOC ตามตัวกรองนี้</div>}
              </div>
            </article>
            <article className="card">
              <div className="card-title">แคมป์ที่ควรขยายผล / ติดตามต่อ</div>
              <div className="leaderboard-list compact">
                {bestSocCamps.map((row, index) => (
                  <div key={`expand-${row.id}`} className="leaderboard-row">
                    <span className="rank-pill">#{index + 1}</span>
                    <div>
                      <strong>{row.name}</strong>
                      <small>Credits {row.credits.toLocaleString(undefined, { maximumFractionDigits: 2 })} tCO2e · SOC {row.socIncrease.toLocaleString(undefined, { maximumFractionDigits: 2 })}</small>
                    </div>
                    <b className="green-text">ขยายผล</b>
                    {row.camp && <Link className="run-btn drilldown-link" to={`/footprint-report?campId=${row.camp.campId}`}>ดูรายงานละเอียด</Link>}
                  </div>
                ))}
                {followUpSocCamps.map((row, index) => (
                  <div key={`follow-${row.id}`} className="leaderboard-row">
                    <span className="rank-pill">!{index + 1}</span>
                    <div>
                      <strong>{row.name}</strong>
                      <small>Net emissions {row.netEmission.toLocaleString(undefined, { maximumFractionDigits: 2 })} tCO2e หลังหักเครดิต</small>
                    </div>
                    <b className="red-text">ติดตาม</b>
                    {row.camp && <Link className="run-btn drilldown-link" to={`/footprint-report?campId=${row.camp.campId}`}>ดูรายงานละเอียด</Link>}
                  </div>
                ))}
              </div>
            </article>
          </section>
        </section>
        )}

      </div>
    </div>
  );
}
