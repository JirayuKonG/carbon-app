import { useEffect, useState } from "react";
import { ActivityGroupedBar } from "../components/charts/ActivityGroupedBar";
import { sortProcessLabels } from "../components/charts/ChartRegistry";
import { ProcessInputComparisonBar } from "../components/charts/ProcessInputComparisonBar";
import { ProcessDoughnut } from "../components/charts/ProcessDoughnut";
import { SourceBadge } from "../components/common/SourceBadge";
import { getCampCarbonSummaries, getCfProcessActivities, getProcessEmissions, getProcessInputComparisons } from "../services/dashboardApi";
import type { ActivityValue, CampCarbonSummary, DataResult, ProcessActivityBreakdown, ProcessEmission, ProcessInputComparison } from "../types/dashboard";
import "../cf-dashboard.css";

type PeriodMode = "baseline_avg" | "project";
type ScopeValue = "all" | `camp-${number}`;

function yearName(year: string) {
  return year === "baseline_avg" ? "ค่าเฉลี่ยปีฐาน" : year;
}

function currentYearFrom(data: ProcessEmission[]) {
  const years = data.filter((item) => !item.isBaseline).map((item) => item.year).sort();
  return years[years.length - 1] ?? "";
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
  const [scope, setScope] = useState<ScopeValue>("all");
  const [activities, setActivities] = useState<ProcessActivityBreakdown[]>([]);
  const [emissions, setEmissions] = useState<ProcessEmission[]>([]);
  const [inputs, setInputs] = useState<ProcessInputComparison[]>([]);
  const [campResult, setCampResult] = useState<DataResult<CampCarbonSummary[]>>({ data: [], source: "mock" });
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([getCfProcessActivities("process"), getProcessEmissions(), getProcessInputComparisons(), getCampCarbonSummaries()])
      .then(([activityResult, emissionResult, inputResult, campSummaryResult]) => {
        setActivities(activityResult.data);
        setEmissions(emissionResult.data);
        setInputs(inputResult.data);
        setCampResult(campSummaryResult);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "โหลดข้อมูลไม่สำเร็จ"));
  }, []);

  const currentYear = currentYearFrom(emissions);
  const selectedCampId = scope === "all" ? undefined : Number(scope.replace("camp-", ""));
  const selectedCamp = selectedCampId ? campResult.data.find((camp) => camp.campId === selectedCampId) : undefined;
  const baseline = activities.filter((item) => item.year === "baseline_avg");
  const current = activities.filter((item) => item.year === currentYear);
  const selectedYear = period === "baseline_avg" ? "baseline_avg" : currentYear;
  const selected = selectedCamp
    ? (period === "baseline_avg" ? selectedCamp.baselineProcessActivities : selectedCamp.currentProcessActivities)
    : activities.filter((item) => item.year === selectedYear);
  const selectedPie: ActivityValue[] = selectedCamp
    ? (period === "baseline_avg" ? selectedCamp.baselineActivityBreakdown : selectedCamp.currentActivityBreakdown)
    : selected.map((item) => ({ name: item.process, emission: item.totalEmission }));
  const campRows = selectedCamp ? [selectedCamp] : campResult.data;
  const baselineTotal = selectedCamp ? selectedCamp.baselineCo2eTotal : sumEmission(baseline);
  const currentTotal = selectedCamp ? selectedCamp.currentCo2eTotal : sumEmission(current);
  const totalDiff = baselineTotal - currentTotal;
  const totalDiffPct = baselineTotal ? (totalDiff / baselineTotal) * 100 : 0;
  const topCurrentProcess = [...(selectedCamp ? selectedCamp.currentProcessActivities : current)]
    .sort((a, b) => b.totalEmission - a.totalEmission)[0];
  const processInputData = selectedCamp ? selectedCamp.processInputComparisons : inputs;

  return (
    <div className="cf-dash">
      <div className="page active">
        <div className="page-title">
          <div>
            <p className="eyebrow">02 · Process</p>
            <h1>สรุปกระบวนการเพาะปลูก</h1>
          </div>
          <SourceBadge source={campResult.source} meta={campResult.meta} />
        </div>

        {error && <div className="error-panel">{error}</div>}

        <section className="card process-scope-panel">
          <div>
            <div className="card-title">มุมมองกระบวนการเพาะปลูก</div>
            <p className="muted">เลือกภาพรวมทั้งหมด หรือเจาะรายแคมป์จากรายการเดียวกัน</p>
          </div>
          <label>
            ขอบเขตข้อมูล
            <select value={scope} onChange={(event) => setScope(event.target.value as ScopeValue)}>
              <option value="all">รวมทั้งหมด</option>
              {campResult.data.map((camp) => (
                <option key={camp.campId} value={`camp-${camp.campId}`}>{camp.campName}</option>
              ))}
            </select>
          </label>
        </section>

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
              <div className="card-title">วงกลมกระบวนการทั้งหมด · {selectedCamp?.campName ?? periodLabel(period, currentYear)}</div>
              <PeriodSwitch value={period} currentYear={currentYear} onChange={setPeriod} />
            </div>
            <ProcessDoughnut data={selectedPie} />
          </article>
          <article className="card">
            <div className="card-title">Grouped Bar · ปีฐาน vs ปีดำเนินโครงการ</div>
            {selectedCamp ? (
              <ActivityGroupedBar baseline={selectedCamp.baselineProcessActivities} current={selectedCamp.currentProcessActivities} />
            ) : (
              <ActivityGroupedBar baseline={baseline} current={current} />
            )}
            {selectedCamp ? (
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
            {selected.map((item) => (
              <article className="card sub-card" key={`${item.year}-${item.process}`}>
                <ProcessDoughnut title={selectedCamp ? `${item.process} · ${periodLabel(period, currentYear)}` : `${item.process} · ${yearName(item.year)}`} data={item.activities} />
              </article>
            ))}
            {!selected.length && <div className="empty-state">ไม่มีข้อมูลกระบวนการเพาะปลูกสำหรับช่วงที่เลือก</div>}
          </div>
        </section>
      </div>
    </div>
  );
}
