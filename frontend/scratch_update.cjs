
const fs = require("fs");
const path = "c:/Project_Tesis/carbon-app/frontend/src/features/cf-dashboard/pages/ProcessPage.tsx";
let content = fs.readFileSync(path, "utf-8");

// 1. Title change
content = content.replace("<h1>Carbon Footprint ไร่บริษัทกลุ่มมิตรผล</h1>", "<h1>GHG ตามประเภทอ้อย ไร่บริษัทกลุ่มมิตรผล</h1>");

// 2. PeriodMode
content = content.replace("type PeriodMode = \"baseline_avg\" | \"project\";", "type PeriodMode = string;");
content = content.replace(
  "function periodLabel(period: PeriodMode, currentYear: string) {\n  return period === \"baseline_avg\" ? \"ปีฐาน\" : `ปีดำเนินการ ${currentYear || \"-\"}`;\n}",
  `function periodLabel(period: string, currentYear: string) {
  if (period === "baseline_avg") return "ปีฐานเฉลี่ย";
  if (period === "project" || period === currentYear) return \`ปีดำเนินการ \${currentYear || "-"}\`;
  return \`ปี \${period}\`;
}`
);

// 3. PeriodSwitch -> GraphComparisonFilter
const periodSwitchRegex = /function PeriodSwitch[\s\S]*?return \([\s\S]*?<\/div>\s*\);\s*\}/;
const newGraphFilter = `function GraphComparisonFilter({ 
  yearA, yearB, availableYears, onChangeA, onChangeB 
}: { 
  yearA: string; yearB: string; availableYears: string[]; onChangeA: (v: string) => void; onChangeB: (v: string) => void; 
}) {
  return (
    <div className="card graph-comparison-filter" style={{ padding: "1rem", marginBottom: "1.5rem", display: "flex", gap: "1rem", alignItems: "center" }}>
      <strong>ตัวกรองกราฟเปรียบเทียบ:</strong>
      <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        ปี A:
        <select value={yearA} onChange={e => onChangeA(e.target.value)} className="form-select">
          <option value="baseline_avg">ปีฐานเฉลี่ย</option>
          {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </label>
      <span style={{ fontWeight: "bold" }}>VS</span>
      <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        ปี B:
        <select value={yearB} onChange={e => onChangeB(e.target.value)} className="form-select">
          <option value="project">ปีดำเนินการ</option>
          <option value="baseline_avg">ปีฐานเฉลี่ย</option>
          {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </label>
    </div>
  );
}`;
content = content.replace(periodSwitchRegex, newGraphFilter);

// 4. States
content = content.replace(
  "const [period, setPeriod] = useState<PeriodMode>(\"project\");\n  const [activeView, setActiveView] = useState<FootprintView>(\"emissions\");\n  const [activityChartMode, setActivityChartMode] = useState<ActivityChartMode>(\"both\");\n  const [comparisonTab, setComparisonTab] = useState<ComparisonTab>(\"benchmark\");",
  `const [period, setPeriod] = useState<string>("project");
  const [activeView, setActiveView] = useState<FootprintView>("emissions");
  const [activityChartMode, setActivityChartMode] = useState<ActivityChartMode>("both");
  const [graphYearA, setGraphYearA] = useState<string>("baseline_avg");
  const [graphYearB, setGraphYearB] = useState<string>("project");
  const [graph2Mode, setGraph2Mode] = useState<"single" | "compare">("compare");
  const [comparisonTab, setComparisonTab] = useState<ComparisonTab>("benchmark");`
);

// 5. Variables
content = content.replace(
  "const currentYear = currentYearFrom(emissions);\n  const selectedCampId = scope === \"all\" ? undefined : Number(scope.replace(\"camp-\", \"\"));",
  `const currentYear = currentYearFrom(emissions);
  const availableYears = Array.from(new Set(activities.map(a => a.year).filter(y => y !== "baseline_avg"))).sort();
  const actualPeriod = period === "project" ? currentYear : period;
  const actualGraphYearA = graphYearA === "project" ? currentYear : graphYearA;
  const actualGraphYearB = graphYearB === "project" ? currentYear : graphYearB;
  const selectedCampId = scope === "all" ? undefined : Number(scope.replace("camp-", ""));`
);

content = content.replace(
  "const baseline = activities.filter((item) => item.year === \"baseline_avg\");\n  const current = activities.filter((item) => item.year === currentYear);\n  const selectedYear = period === \"baseline_avg\" ? \"baseline_avg\" : currentYear;",
  `const baseline = activities.filter((item) => item.year === "baseline_avg");
  const current = activities.filter((item) => item.year === actualPeriod);
  const selectedYear = actualPeriod;`
);

content = content.replace(
  "const chartBaselineRaw = selectedField ? fieldBaseline : selectedCamp ? selectedCamp.baselineProcessActivities : scopedCamps.length ? aggregateCampActivities(scopedCamps, \"baselineProcessActivities\") : baseline;\n  const chartCurrentRaw = selectedField ? fieldCurrent : selectedCamp ? selectedCamp.currentProcessActivities : scopedCamps.length ? aggregateCampActivities(scopedCamps, \"currentProcessActivities\") : current;",
  `const graphBaseline = activities.filter(item => item.year === actualGraphYearA);
  const graphCurrent = activities.filter(item => item.year === actualGraphYearB);
  const chartBaselineRaw = selectedField ? fieldBaseline : selectedCamp ? selectedCamp.baselineProcessActivities : scopedCamps.length ? aggregateCampActivities(scopedCamps, "baselineProcessActivities") : graphBaseline;
  const chartCurrentRaw = selectedField ? fieldCurrent : selectedCamp ? selectedCamp.currentProcessActivities : scopedCamps.length ? aggregateCampActivities(scopedCamps, "currentProcessActivities") : graphCurrent;`
);

// 6. Global dropdown
const globalSelectOld = `<label>
            ปีดำเนินการ
            <select value={period} onChange={(event) => setPeriod(event.target.value as PeriodMode)}>
              <option value="project">ปีดำเนินการ {currentYear || overviewKpi?.currentYear || "-"}</option>
              <option value="baseline_avg">ปีฐานเฉลี่ย</option>
            </select>
          </label>`;
const globalSelectNew = `<label>
            ปีดำเนินการ
            <select value={period} onChange={(event) => setPeriod(event.target.value)}>
              <option value="project">ปีดำเนินการ {currentYear || overviewKpi?.currentYear || "-"}</option>
              <option value="baseline_avg">ปีฐานเฉลี่ย</option>
              {availableYears.map(y => (
                <option key={y} value={y}>ปี {y}</option>
              ))}
            </select>
          </label>`;
content = content.replace(globalSelectOld, globalSelectNew);

// 7. KPIs
const kpisOld = `<article>
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
              </article>`;

const kpisNew = `<article>
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
              </article>`;
content = content.replace(kpisOld, kpisNew);

fs.writeFileSync(path, content, "utf-8");
console.log("Replaced chunks 1 to 7");
