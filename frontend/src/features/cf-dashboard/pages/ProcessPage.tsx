import { useEffect, useState } from "react";
import { ActivityGroupedBar } from "../components/charts/ActivityGroupedBar";
import { sortProcessLabels } from "../components/charts/ChartRegistry";
import { ProcessInputComparisonBar } from "../components/charts/ProcessInputComparisonBar";
import { ProcessDoughnut } from "../components/charts/ProcessDoughnut";
import { CaneTypeSummaryPanel } from "../components/common/CaneTypeSummaryPanel";
import { getCampCarbonSummaries, getCampFieldCarbonDetails, getCaneTypeSummaries, getCfProcessActivities, getOverviewKpi, getProcessEmissions, getProcessInputComparisons } from "../services/dashboardApi";
import type { ActivityValue, CampCarbonSummary, CampFieldCarbonDetail, CaneTypeSummary, DataResult, OverviewKpi, ProcessActivityBreakdown, ProcessEmission, ProcessInputComparison } from "../types/dashboard";
import "../cf-dashboard.css";

type PeriodMode = "baseline_avg" | "project";
type ScopeValue = "all" | `camp-${number}`;
type DonutMode = "camp" | "activity" | "field";
type CaneScope = "all" | "new" | "ratoon";

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

function aggregateActivityValues(rows: ProcessActivityBreakdown[]): ActivityValue[] {
  const values = new Map<string, number>();
  rows.forEach((row) => {
    const activities = row.activities.length ? row.activities : [{ name: row.process, emission: row.totalEmission }];
    activities.forEach((activity) => {
      values.set(activity.name, (values.get(activity.name) ?? 0) + activity.emission);
    });
  });
  return Array.from(values.entries())
    .map(([name, emission]) => ({ name, emission: Number(emission.toFixed(2)) }))
    .sort((a, b) => b.emission - a.emission);
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

function scaleInputsForField(data: ProcessInputComparison[], field?: CampFieldCarbonDetail): ProcessInputComparison[] {
  if (!field) return data;
  const baselineFactor = field.baselineEmission / 896;
  const currentFactor = field.currentEmission / 723;
  return data.map((item) => ({
    process: item.process,
    baselineFertilizerKg: Number((item.baselineFertilizerKg * baselineFactor).toFixed(1)),
    currentFertilizerKg: Number((item.currentFertilizerKg * currentFactor).toFixed(1)),
    baselineFuelLiter: Number((item.baselineFuelLiter * baselineFactor).toFixed(1)),
    currentFuelLiter: Number((item.currentFuelLiter * currentFactor).toFixed(1)),
  }));
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
  const [donutMode, setDonutMode] = useState<DonutMode>("camp");
  const [caneScope, setCaneScope] = useState<CaneScope>("all");
  const [scope, setScope] = useState<ScopeValue>("all");
  const [activities, setActivities] = useState<ProcessActivityBreakdown[]>([]);
  const [emissions, setEmissions] = useState<ProcessEmission[]>([]);
  const [inputs, setInputs] = useState<ProcessInputComparison[]>([]);
  const [campResult, setCampResult] = useState<DataResult<CampCarbonSummary[]>>({ data: [], source: "mock" });
  const [fieldResult, setFieldResult] = useState<DataResult<CampFieldCarbonDetail[]>>({ data: [], source: "mock" });
  const [caneTypeResult, setCaneTypeResult] = useState<DataResult<CaneTypeSummary[]>>({ data: [], source: "mock" });
  const [overviewKpi, setOverviewKpi] = useState<OverviewKpi | null>(null);
  const [selectedFieldId, setSelectedFieldId] = useState("all");
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([getCfProcessActivities("process"), getProcessEmissions(), getProcessInputComparisons(), getCampCarbonSummaries(), getCampFieldCarbonDetails(), getCaneTypeSummaries(), getOverviewKpi()])
      .then(([activityResult, emissionResult, inputResult, campSummaryResult, fieldDetailResult, caneSummaryResult, kpiResult]) => {
        setActivities(activityResult.data);
        setEmissions(emissionResult.data);
        setInputs(inputResult.data);
        setCampResult(campSummaryResult);
        setFieldResult(fieldDetailResult);
        setCaneTypeResult(caneSummaryResult);
        setOverviewKpi(kpiResult.data);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "โหลดข้อมูลไม่สำเร็จ"));
  }, []);

  const currentYear = currentYearFrom(emissions);
  const selectedCampId = scope === "all" ? undefined : Number(scope.replace("camp-", ""));
  const selectedCamp = selectedCampId ? campResult.data.find((camp) => camp.campId === selectedCampId) : undefined;
  const fieldsInCamp = selectedCampId ? fieldResult.data.filter((field) => field.campId === selectedCampId) : [];
  const selectedField = selectedFieldId === "all" ? undefined : fieldResult.data.find((field) => field.id === selectedFieldId);
  const baseline = activities.filter((item) => item.year === "baseline_avg");
  const current = activities.filter((item) => item.year === currentYear);
  const selectedYear = period === "baseline_avg" ? "baseline_avg" : currentYear;
  const fieldBaseline = selectedField ? fieldProcessRows(selectedField, "baseline_avg", selectedField.baselineEmission) : [];
  const fieldCurrent = selectedField ? fieldProcessRows(selectedField, currentYear, selectedField.currentEmission) : [];
  const selected = selectedField
    ? (period === "baseline_avg" ? fieldBaseline : fieldCurrent)
    : selectedCamp
    ? (period === "baseline_avg" ? selectedCamp.baselineProcessActivities : selectedCamp.currentProcessActivities)
    : activities.filter((item) => item.year === selectedYear);
  const chartBaselineRaw = selectedField ? fieldBaseline : selectedCamp ? selectedCamp.baselineProcessActivities : baseline;
  const chartCurrentRaw = selectedField ? fieldCurrent : selectedCamp ? selectedCamp.currentProcessActivities : current;
  const caneMeta = caneScopeInfo(caneTypeResult.data, caneScope);
  const selectedByCane = scaleProcessRows(selected, caneMeta.factor);
  const chartBaseline = scaleProcessRows(chartBaselineRaw, caneMeta.factor);
  const chartCurrent = scaleProcessRows(chartCurrentRaw, caneMeta.factor);
  const campRows = selectedCamp ? [selectedCamp] : campResult.data;
  const baselineTotal = (selectedField ? selectedField.baselineEmission : selectedCamp ? selectedCamp.baselineCo2eTotal : sumEmission(baseline)) * caneMeta.factor;
  const currentTotal = (selectedField ? selectedField.currentEmission : selectedCamp ? selectedCamp.currentCo2eTotal : sumEmission(current)) * caneMeta.factor;
  const summaryAreaRai = selectedField ? selectedField.areaRai : selectedCamp ? selectedCamp.areaRai : overviewKpi?.areaRai ?? campResult.data.reduce((sum, camp) => sum + camp.areaRai, 0);
  const summaryFieldCount = selectedField ? 1 : selectedCamp ? selectedCamp.fieldCount : overviewKpi?.fields ?? campResult.data.reduce((sum, camp) => sum + camp.fieldCount, 0);
  const summaryBaselineYears = baselineYearRange(emissions, overviewKpi?.baselineYears ?? []);
  const totalDiff = baselineTotal - currentTotal;
  const totalDiffPct = baselineTotal ? (totalDiff / baselineTotal) * 100 : 0;
  const topCurrentProcess = [...chartCurrent]
    .sort((a, b) => b.totalEmission - a.totalEmission)[0];
  const processInputData = scaleInputRows(selectedField ? scaleInputsForField(inputs, selectedField) : selectedCamp ? selectedCamp.processInputComparisons : inputs, caneMeta.factor);
  const currentScopeRows = chartCurrent;
  const groupDonutData: ActivityValue[] = donutMode === "camp"
    ? selectedField
      ? [{ name: selectedField.campName, emission: Number((selectedField.currentEmission * caneMeta.factor).toFixed(2)) }]
      : selectedCamp
      ? [{ name: selectedCamp.campName, emission: Number((selectedCamp.currentCo2eTotal * caneMeta.factor).toFixed(2)) }]
      : campResult.data.map((camp) => ({ name: camp.campName, emission: Number((camp.currentCo2eTotal * caneMeta.factor).toFixed(2)) }))
    : donutMode === "field"
    ? selectedField
      ? [{ name: selectedField.fieldName, emission: Number((selectedField.currentEmission * caneMeta.factor).toFixed(2)) }]
      : (selectedCampId ? fieldsInCamp : fieldResult.data).map((field) => ({ name: field.fieldName, emission: Number((field.co2eTotal * caneMeta.factor).toFixed(2)) }))
    : aggregateActivityValues(currentScopeRows);

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

        <section className="card process-scope-panel">
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

        <section className="card cane-scope-card">
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

        <CaneTypeSummaryPanel result={caneTypeResult} showSource={false} />

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
            <div className="card-title">Grouped Bar · ปีฐาน vs ปีดำเนินโครงการ</div>
            {selectedField ? (
              <ActivityGroupedBar baseline={chartBaseline} current={chartCurrent} />
            ) : selectedCamp ? (
              <ActivityGroupedBar baseline={chartBaseline} current={chartCurrent} />
            ) : (
              <ActivityGroupedBar baseline={chartBaseline} current={chartCurrent} />
            )}
            {selectedField ? (
              <div className="summary-list">
                <div><span>ปีฐาน</span><strong>{selectedField.baselineEmission.toLocaleString()} tCO2e</strong></div>
                <div><span>ปีดำเนินการ</span><strong>{selectedField.currentEmission.toLocaleString()} tCO2e</strong></div>
                <div>
                  <span>ผลต่าง</span>
                  <strong className={selectedField.currentEmission <= selectedField.baselineEmission ? "green-text" : "red-text"}>
                    {Math.abs(selectedField.currentEmission - selectedField.baselineEmission).toFixed(2)} tCO2e
                  </strong>
                </div>
              </div>
            ) : selectedCamp ? (
              <div className="summary-list">
                <div><span>ปีฐาน</span><strong>{selectedCamp.baselineCo2eTotal.toLocaleString()} tCO2e</strong></div>
                <div><span>ปีดำเนินการ</span><strong>{selectedCamp.currentCo2eTotal.toLocaleString()} tCO2e</strong></div>
                <div>
                  <span>ผลต่าง</span>
                  <strong className={selectedCamp.currentCo2eTotal <= selectedCamp.baselineCo2eTotal ? "green-text" : "red-text"}>
                    {Math.abs(selectedCamp.currentCo2eTotal - selectedCamp.baselineCo2eTotal).toFixed(2)} tCO2e
                  </strong>
                </div>
              </div>
            ) : (
              <ProcessSummary baseline={baseline} current={current} />
            )}
          </article>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card full-span">
          <div className="card-title">ปุ๋ยและน้ำมันรายขั้นตอน · ค่าเฉลี่ยปีฐาน vs ปีดำเนินโครงการ</div>
          <ProcessInputComparisonBar data={processInputData} />
        </section>

        {false && !selectedCamp && (
          <section className="card full-span">
            <div className="card-title">ปุ๋ยและน้ำมันรายขั้นตอน · ค่าเฉลี่ยปีฐาน vs ปีดำเนินโครงการ</div>
            <ProcessInputComparisonBar data={inputs} />
          </section>
        )}

        <section className="card full-span">
          <div className="card-title-row">
            <div className="card-title">รายการกิจกรรมย่อยในแต่ละขั้นตอน · {periodLabel(period, currentYear)}</div>
            <PeriodSwitch value={period} currentYear={currentYear} onChange={setPeriod} />
          </div>
          <div className="sub-pie-grid">
            {selectedByCane.map((item) => (
              <article className="card sub-card" key={`${item.year}-${item.process}`}>
                <ProcessDoughnut title={selectedField ? `${item.process} · ${selectedField.fieldCode}` : selectedCamp ? `${item.process} · ${periodLabel(period, currentYear)}` : `${item.process} · ${yearName(item.year)}`} data={item.activities} />
              </article>
            ))}
            {!selectedByCane.length && <div className="empty-state">ไม่มีข้อมูลกระบวนการเพาะปลูกสำหรับช่วงที่เลือก</div>}
          </div>
        </section>
      </div>
    </div>
  );
}
