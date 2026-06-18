import { useState, type CSSProperties } from "react";
import { CaneTypeSummaryPanel } from "../components/common/CaneTypeSummaryPanel";
import { DatasourceStatusToggle, useDatasourceStatusVisible } from "../components/common/DatasourceStatusToggle";
import { SourceBadge } from "../components/common/SourceBadge";
import { TrendLineChart } from "../components/charts/TrendLineChart";
import { useAsyncData } from "../hooks/useAsyncData";
import { getCaneTypeSummaries, getInputUsageSummary, getOverviewKpi, getProcessInputComparisons, getTrend } from "../services/dashboardApi";
import { get } from "@/lib/api";
import type { CaneTypeSummary, DataResult, InputUsageSummaryResponse, OverviewKpi, ProcessInputComparison, TrendPoint } from "../types/dashboard";
import { emptyInputUsageSummary, summarizeResourceUsage } from "../utils/resourceUsage";
import "../cf-dashboard.css";

type OverviewFarmGroup = "all" | "dan-chang" | "isan";

const farmGroupOptions: { value: OverviewFarmGroup; label: string }[] = [
  { value: "all", label: "ทั้งหมด" },
  { value: "dan-chang", label: "ไร่ด่านช้าง" },
  { value: "isan", label: "ไร่อีสาน" },
];

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

export function CfOverviewPage() {
  const [selectedFarmGroup, setSelectedFarmGroup] = useState<OverviewFarmGroup>("all");
  const datasourceStatusVisible = useDatasourceStatusVisible();
  const overviewFilter = selectedFarmGroup === "all"
    ? undefined
    : { level: "region" as const, id: selectedFarmGroup };
  const kpi = useAsyncData<OverviewKpi>(() => getOverviewKpi(overviewFilter), emptyKpi, [selectedFarmGroup]);
  const trend = useAsyncData<TrendPoint[]>(() => getTrend(overviewFilter), [], [selectedFarmGroup]);
  const inputs = useAsyncData<ProcessInputComparison[]>(() => getProcessInputComparisons(overviewFilter), [], [selectedFarmGroup]);
  const caneTypes = useAsyncData<CaneTypeSummary[]>(() => getCaneTypeSummaries(overviewFilter), [], [selectedFarmGroup]);
  const inputUsage = useAsyncData<InputUsageSummaryResponse>(getInputUsageSummary, emptyInputUsageSummary);

  // Priority 2: ดึง SOC summary จริงจาก carbon-soc/summary API
  const socSummary = useAsyncData<{ socTotalTco2e: number; fnfixTotalTn: number; landCount: number; missingInputCount: number }>(
    async () => {
      const res = await get<{ socTotalTco2e: number; fnfixTotalTn: number; landCount: number; missingInputCount: number }>("/carbon-soc/summary");
      return {
        data: res,
        source: "api",
        meta: {
          route: "/carbon-soc/summary",
          techniques: ["Prisma", "PostgreSQL"],
          rowCount: 1,
          datasourceStatus: "api_real",
        },
      };
    },
    { socTotalTco2e: 0, fnfixTotalTn: 0, landCount: 0, missingInputCount: 0 },
  );
  const overviewKpi = kpi.data;
  const overviewInputs = inputs.data;
  const overviewTrend = trend.data;
  const overviewCaneTypes: DataResult<CaneTypeSummary[]> = caneTypes;
  const overviewKpiSource: DataResult<OverviewKpi> = kpi;
  const overviewTrendSource = trend;
  const overviewResourceSource = inputs;
  const kpiSocTco2e = overviewKpi.socRemovalTco2e ?? 0;
  const realSocTco2e = kpiSocTco2e > 0 ? kpiSocTco2e : socSummary.data.socTotalTco2e ?? 0;
  const hasSocData = realSocTco2e > 0;

  const inputTotals = sumInputs(overviewInputs);
  const physicalResourceUsage = summarizeResourceUsage(inputUsage.data);
  const fertilizerDiff = inputTotals.baselineFertilizerKg - inputTotals.currentFertilizerKg;
  const fuelDiff = inputTotals.baselineFuelLiter - inputTotals.currentFuelLiter;
  const fertilizerRatio = inputTotals.currentFertilizerKg ? inputTotals.baselineFertilizerKg / inputTotals.currentFertilizerKg : 1;
  const fuelRatio = inputTotals.currentFuelLiter ? inputTotals.baselineFuelLiter / inputTotals.currentFuelLiter : 1;
  const n2oProject = overviewKpi.fertilizerEmission;
  const n2oReduction = Math.max(n2oProject * fertilizerRatio - n2oProject, 0);
  const fuelProject = overviewKpi.machineEmission;
  const fuelReduction = Math.max(fuelProject * fuelRatio - fuelProject, 0);

  // Priority 2: ใช้ SOC จริงจาก carbon-soc/summary ถ้ามีข้อมูล
  // fallback: (baseline - current) * 0.35 ถ้ายังไม่มีข้อมูลจริง
  const socProxyRemoval = Math.max(overviewKpi.baselineAvgEmission - overviewKpi.currentEmission, 0) * 0.35;
  const socRemoval = hasSocData ? realSocTco2e : socProxyRemoval;
  const socBaseline = Math.max(overviewKpi.areaRai * 0.02, socRemoval * 0.6);
  const socProject = socBaseline + socRemoval;
  const socDiff = socProject - socBaseline;

  const fertilizerDiffPercent = inputTotals.baselineFertilizerKg ? (fertilizerDiff / inputTotals.baselineFertilizerKg) * 100 : 0;
  const fuelDiffPercent = inputTotals.baselineFuelLiter ? (fuelDiff / inputTotals.baselineFuelLiter) * 100 : 0;
  const socDiffPercent = socBaseline ? (socDiff / socBaseline) * 100 : 0;

  const persistedCreditTotal = overviewKpi.creditTotalTco2e ?? 0;
  const hasPersistedCredit = persistedCreditTotal > 0;
  const derivedCreditTotal = n2oReduction + fuelReduction + socRemoval;
  const creditTotal = hasPersistedCredit ? persistedCreditTotal : derivedCreditTotal;
  const componentBase = Math.max(n2oReduction, 0) + Math.max(fuelReduction, 0) + Math.max(socRemoval, 0);
  const persistedOnlyCredit = hasPersistedCredit && componentBase <= 0;
  const scalePersistedComponent = (value: number) => (
    hasPersistedCredit && componentBase > 0
      ? persistedCreditTotal * (Math.max(value, 0) / componentBase)
      : value
  );
  const displayN2oReduction = persistedOnlyCredit ? persistedCreditTotal : scalePersistedComponent(n2oReduction);
  const displayFuelReduction = scalePersistedComponent(fuelReduction);
  const displaySocRemoval = scalePersistedComponent(socRemoval);
  const creditSources = [
    {
      key: "n2o",
      label: persistedOnlyCredit ? "Credit Candidate" : "N2O Reduction",
      description: persistedOnlyCredit
        ? "ผล Carbon Credit ที่บันทึกไว้ในระบบ"
        : hasPersistedCredit ? "สัดส่วนจากผล Credit Candidate ที่บันทึกแล้ว" : "เครดิตจากการลดการปล่อยไนตรัสออกไซด์จากปุ๋ย",
      value: displayN2oReduction,
      color: "#22C55E",
      basis: persistedOnlyCredit
        ? `บันทึกแล้ว ${overviewKpi.creditCalculatedRows ?? 0} row`
        : `ปุ๋ยลดลง ${formatNumber(Math.max(fertilizerDiff, 0), 1)} kg (${fertilizerDiffPercent >= 0 ? "↓" : "↑"}${Math.abs(fertilizerDiffPercent).toFixed(1)}%)`,
    },
    {
      key: "fuel",
      label: "Fuel Reduction",
      description: hasPersistedCredit ? "สัดส่วนจากผล Credit Candidate ที่บันทึกแล้ว" : "เครดิตจากการลดการใช้น้ำมัน/เครื่องจักร",
      value: displayFuelReduction,
      color: "#5BA4FF",
      basis: `น้ำมันลดลง ${formatNumber(Math.max(fuelDiff, 0), 1)} L (${fuelDiffPercent >= 0 ? "↓" : "↑"}${Math.abs(fuelDiffPercent).toFixed(1)}%)`,
    },
    {
      key: "soc",
      label: "SOC Removal",
      description: hasSocData
        ? `ค่า SOC จริงจากข้อมูลรายแปลง (${socSummary.data.landCount || overviewKpi.fields} แปลง)`
        : "เครดิตจากคาร์บอนที่สะสมเพิ่มในดิน (ประมาณการ)",
      value: displaySocRemoval,
      color: "#A855F7",
      basis: hasSocData
        ? `SOC รวม ${formatNumber(realSocTco2e)} tCO2e/ปี`
        : `SOC เพิ่มขึ้น ${formatNumber(socDiff)} tCO2e (↑${socDiffPercent.toFixed(1)}%) [ประมาณการ]`,
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
          <DatasourceStatusToggle />
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

        {(kpi.error || trend.error || inputs.error || caneTypes.error || inputUsage.error) && (
          <div className="error-panel">
            ไม่สามารถโหลดข้อมูลจริงบางส่วนได้: {kpi.error ?? trend.error ?? inputs.error ?? caneTypes.error ?? inputUsage.error}
          </div>
        )}

        <section className="overview-kpi-stack">
          {datasourceStatusVisible && (
            <div className="card-title-row datasource-inline-row">
              <div className="card-title">Datasource status</div>
              <SourceBadge source={overviewKpiSource.source} meta={overviewKpiSource.meta} loading={kpi.loading} />
            </div>
          )}
          <div className="overview-kpi-row top">
            {[
              ["พื้นที่โครงการ", overviewKpi.areaRai.toLocaleString(), "ไร่", `${overviewKpi.fields.toLocaleString()} แปลง`],
              ["Credit รวม", creditTotal.toFixed(0), "tCO2e", hasPersistedCredit ? "ผล Credit Candidate ที่บันทึกแล้ว" : "รวม N2O + น้ำมัน + SOC"],
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
                ? hasPersistedCredit
                  ? `บันทึกแล้ว ${overviewKpi.creditCalculatedRows ?? 0} row`
                  : "คำนวณจากส่วนต่าง emission"
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

        <CaneTypeSummaryPanel result={overviewCaneTypes} creditTotal={creditTotal} />

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
          <div className="card-title-row">
            <div className="card-title">แนวโน้ม Carbon Credit</div>
            <SourceBadge source={overviewTrendSource.source} meta={overviewTrendSource.meta} loading={overviewTrendSource.loading} />
          </div>
          <TrendLineChart data={overviewTrend} />
        </section>

        <section className="card full-span">
          <div className="card-title-row">
            <div className="card-title">สรุปการใช้ทรัพยากรหลักของโครงการ</div>
            <SourceBadge source={overviewResourceSource.source} meta={overviewResourceSource.meta} loading={overviewResourceSource.loading} />
          </div>
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
          <div className="mini-stat-grid resource-reduction-grid" style={{ marginTop: 14 }}>
            <div>
              <strong>{physicalResourceUsage.fertilizerKg.toLocaleString(undefined, { maximumFractionDigits: 1 })}</strong>
              <span>kg ปุ๋ยจากกิจกรรมจริง</span>
            </div>
            <div>
              <strong>{physicalResourceUsage.fuelLiter.toLocaleString(undefined, { maximumFractionDigits: 1 })}</strong>
              <span>L น้ำมันจากกิจกรรมจริง</span>
            </div>
            <div>
              <strong className={physicalResourceUsage.warningCount ? "red-text" : "green-text"}>{physicalResourceUsage.warningCount.toLocaleString()}</strong>
              <span>Data Quality warnings</span>
            </div>
          </div>
          <div className="summary-list resource-raw-list">
            <div><span>Resource Consumption source</span><strong><SourceBadge source={inputUsage.source} meta={inputUsage.meta} loading={inputUsage.loading} /></strong></div>
            <div><span>Prepared quantity rows</span><strong>{physicalResourceUsage.sourcePreparedCount.toLocaleString()} / {physicalResourceUsage.recordCount.toLocaleString()}</strong></div>
            {physicalResourceUsage.liquidFertilizerLiter > 0 && (
              <div><span>Liquid fertilizer</span><strong>{physicalResourceUsage.liquidFertilizerLiter.toLocaleString(undefined, { maximumFractionDigits: 1 })} L</strong></div>
            )}
            <div><span>ปุ๋ยเคมี</span><strong>{physicalResourceUsage.chemicalFertilizerKg.toLocaleString(undefined, { maximumFractionDigits: 1 })} kg</strong></div>
            <div><span>ปุ๋ยอินทรีย์</span><strong>{physicalResourceUsage.organicFertilizerKg.toLocaleString(undefined, { maximumFractionDigits: 1 })} kg</strong></div>
          </div>
        </section>

      </div>
    </div>
  );
}
