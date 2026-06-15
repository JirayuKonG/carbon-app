import { useMemo, useState, type CSSProperties } from "react";
import { CaneTypeSummaryPanel } from "../components/common/CaneTypeSummaryPanel";
import { TrendLineChart } from "../components/charts/TrendLineChart";
import { spatialProjectPlots, type SpatialProjectPlot } from "../data/spatialProjectPlots";
import { useAsyncData } from "../hooks/useAsyncData";
import { getCaneTypeSummaries, getOverviewKpi, getProcessInputComparisons, getTrend } from "../services/dashboardApi";
import type { CaneTypeSummary, DataResult, OverviewKpi, ProcessInputComparison, TrendPoint } from "../types/dashboard";
import "../cf-dashboard.css";

type OverviewFarmGroup = "all" | "dan-chang" | "isan";

const farmGroupOptions: { value: OverviewFarmGroup; label: string }[] = [
  { value: "all", label: "ทั้งหมด" },
  { value: "dan-chang", label: "ไร่ด่านช้าง" },
  { value: "isan", label: "ไร่อีสาน" },
];

const overviewReductionBands = [-0.08, 0.02, 0.04, 0.07, 0.1, 0.13, 0.16, 0.19, 0.23, 0.28];

const emptyKpi: OverviewKpi = {
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

function sumInputs(data: ProcessInputComparison[]) {
  return data.reduce(
    (sum, item) => ({
      baselineFertilizerKg: sum.baselineFertilizerKg + item.baselineFertilizerKg,
      currentFertilizerKg: sum.currentFertilizerKg + item.currentFertilizerKg,
      baselineFuelLiter: sum.baselineFuelLiter + item.baselineFuelLiter,
      currentFuelLiter: sum.currentFuelLiter + item.currentFuelLiter,
    }),
    { baselineFertilizerKg: 0, currentFertilizerKg: 0, baselineFuelLiter: 0, currentFuelLiter: 0 }
  );
}

function formatNumber(value: number, maximumFractionDigits = 2) {
  return value.toLocaleString(undefined, { maximumFractionDigits });
}

function stableIndex(key: string, modulo: number) {
  let hash = 0;
  for (let index = 0; index < key.length; index += 1) {
    hash = ((hash * 33) + key.charCodeAt(index)) % 1000003;
  }
  return hash % modulo;
}

function projectCarbonForPlot(plot: SpatialProjectPlot) {
  const baseline = plot.projectAreaRai * (0.08 + (plot.sequence % 9) * 0.006);
  const farmShift = plot.farmGroup === "dan-chang" ? 1 : 0;
  const reduction = overviewReductionBands[(stableIndex(`${plot.plotCode}:${plot.campName}`, overviewReductionBands.length) + farmShift) % overviewReductionBands.length];
  return {
    baseline,
    current: baseline * (1 - reduction),
  };
}

function buildGroupedInputs(areaRai: number, group: OverviewFarmGroup): ProcessInputComparison[] {
  const groupFactor = group === "dan-chang" ? 0.96 : 1.04;
  const rows = [
    { process: "การเตรียมดินและปลูก", fertilizer: 8, fuel: 3.4, fertilizerSaving: 0.11, fuelSaving: 0.15 },
    { process: "การใช้ปุ๋ย", fertilizer: 16, fuel: 2.6, fertilizerSaving: 0.14, fuelSaving: 0.13 },
    { process: "การให้น้ำและกำจัดวัชพืช", fertilizer: 22, fuel: 1.6, fertilizerSaving: 0.16, fuelSaving: 0.08 },
    { process: "การเก็บเกี่ยว", fertilizer: 0, fuel: 4.2, fertilizerSaving: 0, fuelSaving: 0.17 },
  ];

  return rows.map((row) => {
    const baselineFertilizerKg = areaRai * row.fertilizer * groupFactor;
    const baselineFuelLiter = areaRai * row.fuel * groupFactor;
    return {
      process: row.process,
      baselineFertilizerKg: Number(baselineFertilizerKg.toFixed(1)),
      currentFertilizerKg: Number((baselineFertilizerKg * (1 - row.fertilizerSaving)).toFixed(1)),
      baselineFuelLiter: Number(baselineFuelLiter.toFixed(1)),
      currentFuelLiter: Number((baselineFuelLiter * (1 - row.fuelSaving)).toFixed(1)),
    };
  });
}

function buildGroupedTrend(currentEmission: number, baselineEmission: number, sourceTrend: TrendPoint[]): TrendPoint[] {
  const baselineYears = sourceTrend.filter((item) => item.isBaseline);
  const projectYears = sourceTrend.filter((item) => !item.isBaseline);
  const baselineSource = baselineYears.length
    ? baselineYears
    : [{ year: "2563/64", isBaseline: true }, { year: "2564/65", isBaseline: true }, { year: "2565/66", isBaseline: true }];
  const projectSource = projectYears.length ? projectYears : [{ year: "2566/67", isBaseline: false }];
  const baselineAverage = Number(baselineEmission.toFixed(2));

  return [
    ...baselineSource.map((item, index) => ({
      year: item.year,
      isBaseline: true,
      baselineAverage,
      emission: Number((baselineEmission * [0.96, 1.03, 1.01, 0.99][index % 4]).toFixed(2)),
    })),
    ...projectSource.map((item, index) => ({
      year: item.year,
      isBaseline: false,
      baselineAverage,
      emission: Number((currentEmission * (1 + index * 0.015)).toFixed(2)),
    })),
  ];
}

function buildGroupedCaneTypes(areaRai: number, currentEmission: number, group: OverviewFarmGroup): CaneTypeSummary[] {
  const shares = group === "dan-chang"
    ? [
      { name: "อ้อยปลูก", percent: 48 },
      { name: "อ้อยตอ", percent: 40 },
      { name: "พื้นที่พักดิน", percent: 12 },
    ]
    : [
      { name: "อ้อยปลูก", percent: 43 },
      { name: "อ้อยตอ", percent: 47 },
      { name: "พื้นที่พักดิน", percent: 10 },
    ];

  return shares.map((item) => ({
    ...item,
    areaRai: Number((areaRai * item.percent / 100).toFixed(1)),
    co2eTotal: Number((currentEmission * item.percent / 100).toFixed(2)),
  }));
}

function buildGroupedOverview(group: OverviewFarmGroup, sourceKpi: OverviewKpi, sourceTrend: TrendPoint[]) {
  const plots = spatialProjectPlots.filter((plot) => plot.farmGroup === group);
  const areaRai = plots.reduce((sum, plot) => sum + plot.projectAreaRai, 0);
  const emissions = plots.map(projectCarbonForPlot);
  const baselineAvgEmission = emissions.reduce((sum, item) => sum + item.baseline, 0);
  const currentEmission = emissions.reduce((sum, item) => sum + item.current, 0);
  const fertilizerAmountKg = areaRai * (group === "dan-chang" ? 38 : 43);
  const fertilizerEmission = fertilizerAmountKg * 0.00245;
  const machineEmission = areaRai * (group === "dan-chang" ? 0.0065 : 0.0074);
  const yieldTon = areaRai * (group === "dan-chang" ? 0.064 : 0.057);
  const kpi: OverviewKpi = {
    ...sourceKpi,
    baselineAvgEmission: Number(baselineAvgEmission.toFixed(2)),
    currentEmission: Number(currentEmission.toFixed(2)),
    machineEmission: Number(machineEmission.toFixed(2)),
    inputEmission: Number((fertilizerEmission + machineEmission).toFixed(2)),
    fertilizerAmountKg: Number(fertilizerAmountKg.toFixed(1)),
    fertilizerEmission: Number(fertilizerEmission.toFixed(2)),
    areaRai: Number(areaRai.toFixed(2)),
    yieldTon: Number(yieldTon.toFixed(1)),
    co2ePerTon: yieldTon ? Number((currentEmission / yieldTon).toFixed(2)) : 0,
    farmers: Math.max(Math.round(plots.length * (group === "dan-chang" ? 0.72 : 0.66)), 1),
    fields: plots.length,
  };

  return {
    kpi,
    inputs: buildGroupedInputs(areaRai, group),
    trend: buildGroupedTrend(kpi.currentEmission, kpi.baselineAvgEmission, sourceTrend),
    caneTypes: buildGroupedCaneTypes(kpi.areaRai, kpi.currentEmission, group),
  };
}

export function CfOverviewPage() {
  const [selectedFarmGroup, setSelectedFarmGroup] = useState<OverviewFarmGroup>("all");
  const kpi = useAsyncData<OverviewKpi>(getOverviewKpi, emptyKpi);
  const trend = useAsyncData<TrendPoint[]>(getTrend, []);
  const inputs = useAsyncData<ProcessInputComparison[]>(getProcessInputComparisons, []);
  const caneTypes = useAsyncData<CaneTypeSummary[]>(getCaneTypeSummaries, []);
  const groupedOverview = useMemo(
    () => selectedFarmGroup === "all" ? null : buildGroupedOverview(selectedFarmGroup, kpi.data, trend.data),
    [kpi.data, selectedFarmGroup, trend.data],
  );
  const overviewKpi = groupedOverview?.kpi ?? kpi.data;
  const overviewInputs = groupedOverview?.inputs ?? inputs.data;
  const overviewTrend = groupedOverview?.trend ?? trend.data;
  const overviewCaneTypes: DataResult<CaneTypeSummary[]> = groupedOverview
    ? { ...caneTypes, data: groupedOverview.caneTypes, source: "mock" }
    : caneTypes;

  const inputTotals = sumInputs(overviewInputs);
  const fertilizerDiff = inputTotals.baselineFertilizerKg - inputTotals.currentFertilizerKg;
  const fuelDiff = inputTotals.baselineFuelLiter - inputTotals.currentFuelLiter;
  const fertilizerRatio = inputTotals.currentFertilizerKg ? inputTotals.baselineFertilizerKg / inputTotals.currentFertilizerKg : 1;
  const fuelRatio = inputTotals.currentFuelLiter ? inputTotals.baselineFuelLiter / inputTotals.currentFuelLiter : 1;
  const n2oProject = overviewKpi.fertilizerEmission;
  const n2oReduction = Math.max(n2oProject * fertilizerRatio - n2oProject, 0);
  const fuelProject = overviewKpi.machineEmission;
  const fuelReduction = Math.max(fuelProject * fuelRatio - fuelProject, 0);
  const socRemoval = Math.max(overviewKpi.baselineAvgEmission - overviewKpi.currentEmission, 0) * 0.35;
  const socBaseline = Math.max(overviewKpi.areaRai * 0.02, 0);
  const socProject = socBaseline + socRemoval;
  const socDiff = socProject - socBaseline;

  const fertilizerDiffPercent = inputTotals.baselineFertilizerKg ? (fertilizerDiff / inputTotals.baselineFertilizerKg) * 100 : 0;
  const fuelDiffPercent = inputTotals.baselineFuelLiter ? (fuelDiff / inputTotals.baselineFuelLiter) * 100 : 0;
  const socDiffPercent = socBaseline ? (socDiff / socBaseline) * 100 : 0;

  const creditTotal = n2oReduction + fuelReduction + socRemoval;
  const creditSources = [
    {
      key: "n2o",
      label: "N2O Reduction",
      description: "เครดิตจากการลดการปล่อยไนตรัสออกไซด์จากปุ๋ย",
      value: n2oReduction,
      color: "#22C55E",
      basis: `ปุ๋ยลดลง ${formatNumber(Math.max(fertilizerDiff, 0), 1)} kg (${fertilizerDiffPercent >= 0 ? "↓" : "↑"}${Math.abs(fertilizerDiffPercent).toFixed(1)}%)`,
    },
    {
      key: "fuel",
      label: "Fuel Reduction",
      description: "เครดิตจากการลดการใช้น้ำมัน/เครื่องจักร",
      value: fuelReduction,
      color: "#5BA4FF",
      basis: `น้ำมันลดลง ${formatNumber(Math.max(fuelDiff, 0), 1)} L (${fuelDiffPercent >= 0 ? "↓" : "↑"}${Math.abs(fuelDiffPercent).toFixed(1)}%)`,
    },
    {
      key: "soc",
      label: "SOC Removal",
      description: "เครดิตจากคาร์บอนที่สะสมเพิ่มในดิน",
      value: socRemoval,
      color: "#A855F7",
      basis: `SOC เพิ่มขึ้น ${formatNumber(socDiff)} tCO2e (↑${socDiffPercent.toFixed(1)}%)`,
    },
  ];

  const creditSourceTotal = creditSources.reduce((sum, item) => sum + item.value, 0);
  
  const baselineYears = overviewTrend.filter((item) => item.isBaseline).map((item) => item.year);
  const lastBaselineYear = baselineYears[baselineYears.length - 1];
  const baselineLabel = baselineYears.length > 1 ? `${baselineYears[0]} - ${lastBaselineYear}` : baselineYears[0] ?? "-";

  return (
    <div className="cf-dash">
      <div className="page active">
        <div className="page-title">
          <div>
            <h1>Carbon Credit Premium T-VER ไร่บริษัทกลุ่มมิตรผล</h1>
          </div>
        </div>

        <section className="card overview-farm-filter-card">
          <div>
            <div className="card-title">กลุ่มไร่หลัก</div>
          </div>
          <div className="footprint-view-tabs overview-farm-toggle" role="tablist" aria-label="ตัวกรองกลุ่มไร่หลัก">
            {farmGroupOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={selectedFarmGroup === option.value ? "active" : ""}
                onClick={() => setSelectedFarmGroup(option.value)}
                role="tab"
                aria-selected={selectedFarmGroup === option.value}
              >
                {option.label}
              </button>
            ))}
          </div>
        </section>

        {(kpi.error || trend.error || inputs.error || caneTypes.error) && (
          <div className="error-panel">
            ไม่สามารถโหลดข้อมูลจริงบางส่วนได้: {kpi.error ?? trend.error ?? inputs.error ?? caneTypes.error}
          </div>
        )}

        <section className="overview-kpi-stack">
          <div className="overview-kpi-row top">
            {[
              ["พื้นที่โครงการ", overviewKpi.areaRai.toLocaleString(), "ไร่", `${overviewKpi.fields.toLocaleString()} แปลง`],
              ["Credit รวม", creditTotal.toFixed(0), "tCO2e", "รวม N2O + น้ำมัน + SOC"],
              ["ปีที่ดำเนินโครงการ", overviewKpi.currentYear, "Project year", `${overviewKpi.currentEmission.toLocaleString()} tCO2e`],
              ["ปีฐาน Baseline", baselineLabel, "Baseline years", `เฉลี่ย ${overviewKpi.baselineAvgEmission.toLocaleString()} tCO2e`],
            ].map(([label, value, unit, delta]) => {
              const displayLabel = label.includes("Credit")
                ? "เครดิตที่คาดว่าจะได้"
                : unit === "Project year"
                ? "Emission ปีดำเนินโครงการ"
                : unit === "Baseline years"
                ? "Emission ปีฐาน Baseline"
                : label;
              const displayDelta = label.includes("Credit")
                ? "คำนวณจากส่วนต่าง emission"
                : unit === "Baseline years"
                ? `เฉลี่ย ${overviewKpi.baselineAvgEmission.toLocaleString()} tCO2e`
                : delta;
              return (
              <article className="kpi" key={displayLabel}>
                <div className="kpi-label">{displayLabel}</div>
                <div className="kpi-val">{value}</div>
                <div className="kpi-unit">{unit}</div>
                <div className="delta good">{displayDelta}</div>
              </article>
              );
            })}
          </div>
        </section>

        <CaneTypeSummaryPanel result={overviewCaneTypes} showSource={false} creditTotal={creditTotal} />

        <section className="card full-span credit-source-card">
          <div className="card-title">แหล่งที่มา Credit</div>
          <div className="credit-source-grid">
            {creditSources.map((source) => {
              const percent = creditSourceTotal ? (source.value / creditSourceTotal) * 100 : 0;
              return (
                <div key={source.key} style={{ "--credit-source-color": source.color } as CSSProperties}>
                  <span>{source.label}</span>
                  <strong>{formatNumber(source.value)}</strong>
                  <small>tCO2e · {percent.toFixed(1)}% ของเครดิตรวม</small>
                  <em>{source.description}</em>
                  <b>{source.basis}</b>
                </div>
              );
            })}
          </div>
          <div className="credit-contribution-breakdown">
            <div className="credit-breakdown-head">
              <span>Contribution Breakdown</span>
            </div>
            <div className="credit-stack-bar" aria-label={`Credit contribution total ${creditSourceTotal.toFixed(2)} tCO2e`}>
              {creditSources.map((source) => {
                const percent = creditSourceTotal ? (source.value / creditSourceTotal) * 100 : 0;
                return (
                  <i
                    key={source.key}
                    title={`${source.label} ${percent.toFixed(1)}%`}
                    style={{
                      "--credit-source-color": source.color,
                      width: `${Math.max(percent, source.value > 0 ? 4 : 0)}%`,
                    } as CSSProperties}
                  />
                );
              })}
            </div>
            <div className="credit-breakdown-list">
              {creditSources.map((source) => {
                const percent = creditSourceTotal ? (source.value / creditSourceTotal) * 100 : 0;
                return (
                  <div key={`row-${source.key}`}>
                    <span><i style={{ "--credit-source-color": source.color } as CSSProperties} />{source.label}</span>
                    <strong>{formatNumber(source.value)} tCO2e</strong>
                    <small>{percent.toFixed(1)}%</small>
                  </div>
                );
              })}
            </div>
            <div className="credit-total-check">
              <span>รวมแหล่งที่มา Credit</span>
              <strong>{formatNumber(creditSourceTotal)} tCO2e</strong>
            </div>
          </div>
        </section>

        <section className="card full-span">
          <div className="card-title">แนวโน้ม Carbon Credit</div>
          <TrendLineChart data={overviewTrend} />
        </section>

        <section className="card full-span">
          <div className="card-title">สรุปการใช้ทรัพยากรหลักของโครงการ</div>
          <div className="mini-stat-grid resource-reduction-grid">
            <div>
              <strong className={fertilizerDiff >= 0 ? "green-text" : "red-text"}>
                {Math.abs(fertilizerDiff).toLocaleString(undefined, { maximumFractionDigits: 1 })}
                {inputTotals.baselineFertilizerKg > 0 && (
                  <span style={{ fontSize: '0.6em', marginLeft: '6px', fontWeight: 'bold', verticalAlign: 'middle' }}>
                    ({fertilizerDiff >= 0 ? "↓" : "↑"} {Math.abs(fertilizerDiffPercent).toFixed(1)}%)
                  </span>
                )}
              </strong>
              <span>kg ปุ๋ย{fertilizerDiff >= 0 ? "ลดลง" : "เพิ่มขึ้น"}</span>
            </div>
            <div>
              <strong className={fuelDiff >= 0 ? "green-text" : "red-text"}>
                {Math.abs(fuelDiff).toLocaleString(undefined, { maximumFractionDigits: 1 })}
                {inputTotals.baselineFuelLiter > 0 && (
                  <span style={{ fontSize: '0.6em', marginLeft: '6px', fontWeight: 'bold', verticalAlign: 'middle' }}>
                    ({fuelDiff >= 0 ? "↓" : "↑"} {Math.abs(fuelDiffPercent).toFixed(1)}%)
                  </span>
                )}
              </strong>
              <span>L น้ำมัน{fuelDiff >= 0 ? "ลดลง" : "เพิ่มขึ้น"}</span>
            </div>
            <div>
              <strong className="green-text">
                {socDiff.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                {socBaseline > 0 && (
                  <span style={{ fontSize: '0.6em', marginLeft: '6px', fontWeight: 'bold', verticalAlign: 'middle' }}>
                    (↑ {socDiffPercent.toFixed(1)}%)
                  </span>
                )}
              </strong>
              <span>tCO2e การสะสมคาร์บอนในดินเพิ่มขึ้น</span>
            </div>
          </div>
          <div className="summary-list resource-raw-list">
            <div><span>น้ำมันปีฐาน</span><strong>{inputTotals.baselineFuelLiter.toLocaleString(undefined, { maximumFractionDigits: 1 })} L</strong></div>
            <div>
              <span>น้ำมันปีโครงการ</span>
              <strong>
                {inputTotals.currentFuelLiter.toLocaleString(undefined, { maximumFractionDigits: 1 })} L
                {fuelDiffPercent > 0 && (
                  <span style={{ color: "var(--eco-green)", fontSize: "0.85em", marginLeft: "6px", fontWeight: "600" }}>
                    (↓{fuelDiffPercent.toFixed(0)}%)
                  </span>
                )}
              </strong>
            </div>
            <div><span>ปุ๋ยปีฐาน</span><strong>{inputTotals.baselineFertilizerKg.toLocaleString(undefined, { maximumFractionDigits: 1 })} kg</strong></div>
            <div>
              <span>ปุ๋ยปีโครงการ</span>
              <strong>
                {inputTotals.currentFertilizerKg.toLocaleString(undefined, { maximumFractionDigits: 1 })} kg
                {fertilizerDiffPercent > 0 && (
                  <span style={{ color: "var(--eco-green)", fontSize: "0.85em", marginLeft: "6px", fontWeight: "600" }}>
                    (↓{fertilizerDiffPercent.toFixed(0)}%)
                  </span>
                )}
              </strong>
            </div>
            <div><span>การสะสมคาร์บอนในดินปีฐาน</span><strong>{socBaseline.toLocaleString(undefined, { maximumFractionDigits: 2 })} tCO2e</strong></div>
            <div>
              <span>การสะสมคาร์บอนในดินปีโครงการ</span>
              <strong>
                {socProject.toLocaleString(undefined, { maximumFractionDigits: 2 })} tCO2e
                {socDiffPercent > 0 && (
                  <span style={{ color: "var(--eco-green)", fontSize: "0.85em", marginLeft: "6px", fontWeight: "600" }}>
                    (↑{socDiffPercent.toFixed(0)}%)
                  </span>
                )}
              </strong>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
