import { CaneTypeSummaryPanel } from "../components/common/CaneTypeSummaryPanel";
import { TrendLineChart } from "../components/charts/TrendLineChart";
import { useAsyncData } from "../hooks/useAsyncData";
import { getCaneTypeSummaries, getOverviewKpi, getProcessInputComparisons, getTrend } from "../services/dashboardApi";
import type { CaneTypeSummary, OverviewKpi, ProcessInputComparison, TrendPoint } from "../types/dashboard";
import "../cf-dashboard.css";

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
    { baselineFertilizerKg: 0, currentFertilizerKg: 0, baselineFuelLiter: 0, currentFuelLiter: 0 },
  );
}

export function CfOverviewPage() {
  const kpi = useAsyncData<OverviewKpi>(getOverviewKpi, emptyKpi);
  const trend = useAsyncData<TrendPoint[]>(getTrend, []);
  const inputs = useAsyncData<ProcessInputComparison[]>(getProcessInputComparisons, []);
  const caneTypes = useAsyncData<CaneTypeSummary[]>(getCaneTypeSummaries, []);
  const inputTotals = sumInputs(inputs.data);
  const fertilizerDiff = inputTotals.baselineFertilizerKg - inputTotals.currentFertilizerKg;
  const fuelDiff = inputTotals.baselineFuelLiter - inputTotals.currentFuelLiter;
  const fertilizerRatio = inputTotals.currentFertilizerKg ? inputTotals.baselineFertilizerKg / inputTotals.currentFertilizerKg : 1;
  const fuelRatio = inputTotals.currentFuelLiter ? inputTotals.baselineFuelLiter / inputTotals.currentFuelLiter : 1;
  const n2oProject = kpi.data.fertilizerEmission;
  const n2oReduction = Math.max(n2oProject * fertilizerRatio - n2oProject, 0);
  const fuelProject = kpi.data.machineEmission;
  const fuelReduction = Math.max(fuelProject * fuelRatio - fuelProject, 0);
  const socRemoval = Math.max(kpi.data.baselineAvgEmission - kpi.data.currentEmission, 0) * 0.35;
  const socBaseline = Math.max(kpi.data.areaRai * 0.02, 0);
  const socProject = socBaseline + socRemoval;
  const socDiff = socProject - socBaseline;
  const creditTotal = n2oReduction + fuelReduction + socRemoval;
  const baselineYears = trend.data.filter((item) => item.isBaseline).map((item) => item.year);
  const baselineLabel = baselineYears.length > 1 ? `${baselineYears[0]} - ${baselineYears.at(-1)}` : baselineYears[0] ?? "-";

  return (
    <div className="cf-dash">
      <div className="page active">
        <div className="page-title">
          <div>
            <h1>Carbon Credit Premium T-VER ไร่บริษัทกลุ่มมิตรผล</h1>
          </div>
        </div>

        {(kpi.error || trend.error || inputs.error || caneTypes.error) && (
          <div className="error-panel">
            ไม่สามารถโหลดข้อมูลจริงบางส่วนได้: {kpi.error ?? trend.error ?? inputs.error ?? caneTypes.error}
          </div>
        )}

        <section className="overview-kpi-stack">
          <div className="overview-kpi-row top">
            {[
              ["พื้นที่โครงการ", kpi.data.areaRai.toLocaleString(), "ไร่", `${kpi.data.fields.toLocaleString()} แปลง`],
              ["Credit รวม", creditTotal.toFixed(0), "tCO2e", "รวม N2O + น้ำมัน + SOC"],
              ["ปีที่ดำเนินโครงการ", kpi.data.currentYear, "Project year", `${kpi.data.currentEmission.toLocaleString()} tCO2e`],
              ["ปีฐาน Baseline", baselineLabel, "Baseline years", `เฉลี่ย ${kpi.data.baselineAvgEmission.toLocaleString()} tCO2e`],
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
                ? `เฉลี่ย ${kpi.data.baselineAvgEmission.toLocaleString()} tCO2e`
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

        <CaneTypeSummaryPanel result={caneTypes} showSource={false} creditTotal={creditTotal} />

        <section className="card full-span credit-source-card">
          <div className="card-title">แหล่งที่มา Credit</div>
          <div className="credit-source-grid">
            <div>
              <span>การลดไนตรัสออกไซด์ (N2O)</span>
              <strong>{n2oReduction.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong>
              <small>tCO2e</small>
            </div>
            <div>
              <span>การใช้น้ำมัน</span>
              <strong>{fuelReduction.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong>
              <small>tCO2e</small>
            </div>
            <div>
              <span>การสะสมคาร์บอนในดิน (SOC)</span>
              <strong>{socRemoval.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong>
              <small>tCO2e</small>
            </div>
          </div>
        </section>

        <section className="card full-span">
          <div className="card-title">แนวโน้ม Carbon Credit</div>
          <TrendLineChart data={trend.data} />
        </section>

        <section className="card full-span">
          <div className="card-title">สรุปการใช้ทรัพยากรหลักของโครงการ</div>
          <div className="mini-stat-grid resource-reduction-grid">
            <div>
              <strong className={fertilizerDiff >= 0 ? "green-text" : "red-text"}>
                {Math.abs(fertilizerDiff).toLocaleString(undefined, { maximumFractionDigits: 1 })}
              </strong>
              <span>kg ปุ๋ย{fertilizerDiff >= 0 ? "ลดลง" : "เพิ่มขึ้น"}</span>
            </div>
            <div>
              <strong className={fuelDiff >= 0 ? "green-text" : "red-text"}>
                {Math.abs(fuelDiff).toLocaleString(undefined, { maximumFractionDigits: 1 })}
              </strong>
              <span>L น้ำมัน{fuelDiff >= 0 ? "ลดลง" : "เพิ่มขึ้น"}</span>
            </div>
            <div>
              <strong className="green-text">
                {socDiff.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </strong>
              <span>tCO2e การสะสมคาร์บอนในดินเพิ่มขึ้น</span>
            </div>
          </div>
          <div className="summary-list resource-raw-list">
            <div><span>น้ำมันปีฐาน</span><strong>{inputTotals.baselineFuelLiter.toLocaleString(undefined, { maximumFractionDigits: 1 })} L</strong></div>
            <div><span>น้ำมันปีโครงการ</span><strong>{inputTotals.currentFuelLiter.toLocaleString(undefined, { maximumFractionDigits: 1 })} L</strong></div>
            <div><span>ปุ๋ยปีฐาน</span><strong>{inputTotals.baselineFertilizerKg.toLocaleString(undefined, { maximumFractionDigits: 1 })} kg</strong></div>
            <div><span>ปุ๋ยปีโครงการ</span><strong>{inputTotals.currentFertilizerKg.toLocaleString(undefined, { maximumFractionDigits: 1 })} kg</strong></div>
            <div><span>การสะสมคาร์บอนในดินปีฐาน</span><strong>{socBaseline.toLocaleString(undefined, { maximumFractionDigits: 2 })} tCO2e</strong></div>
            <div><span>การสะสมคาร์บอนในดินปีโครงการ</span><strong>{socProject.toLocaleString(undefined, { maximumFractionDigits: 2 })} tCO2e</strong></div>
          </div>
        </section>

      </div>
    </div>
  );
}
