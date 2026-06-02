import React from "react";
import { ProcessInputComparisonBar } from "../components/charts/ProcessInputComparisonBar";
import { ProcessDoughnut } from "../components/charts/ProcessDoughnut";
import { ProcessGroupedBar } from "../components/charts/ProcessGroupedBar";
import { TrendLineChart } from "../components/charts/TrendLineChart";
import { SourceBadge } from "../components/common/SourceBadge";
import { useAsyncData } from "../hooks/useAsyncData";
import { getOverviewKpi, getProcessEmissions, getProcessInputComparisons, getTrend } from "../services/dashboardApi";
import type { OverviewKpi, ProcessEmission, ProcessInputComparison, TrendPoint } from "../types/dashboard";
import "../cf-dashboard.css";

const emptyKpi: OverviewKpi = {
  baselineAvgEmission: 0,
  currentEmission: 0,
  currentYear: "-",
  machineEmission: 0,
  inputEmission: 0,
  fertilizerAmountKg: 0,
  fertilizerEmission: 0,
  yieldTon: 0,
  co2ePerTon: 0,
  farmers: 0,
  fields: 0,
  years: [],
  baselineYears: [],
};

function yearName(year: string) {
  return year === "baseline_avg" ? "ค่าเฉลี่ยปีฐาน" : year;
}

function summarizeProcess(data: ProcessEmission[], currentYear: string) {
  const baseline = new Map(data.filter((item) => item.year === "baseline_avg").map((item) => [item.process, item.emission]));
  const current = new Map(data.filter((item) => item.year === currentYear).map((item) => [item.process, item.emission]));
  return Array.from(new Set([...baseline.keys(), ...current.keys()])).map((process) => {
    const base = baseline.get(process) ?? 0;
    const cur = current.get(process) ?? 0;
    const diff = cur - base;
    return { process, base, cur, diff };
  });
}

export function CfOverviewPage() {
  const kpi = useAsyncData<OverviewKpi>(getOverviewKpi, emptyKpi);
  const trend = useAsyncData<TrendPoint[]>(getTrend, []);
  const process = useAsyncData<ProcessEmission[]>(getProcessEmissions, []);
  const inputs = useAsyncData<ProcessInputComparison[]>(getProcessInputComparisons, []);
  const [selectedYear, setSelectedYear] = React.useState("baseline_avg");

  React.useEffect(() => {
    if (kpi.data.currentYear !== "-" && selectedYear === "baseline_avg") return;
    if (kpi.data.currentYear !== "-" && !process.data.some((item) => item.year === selectedYear)) {
      setSelectedYear(kpi.data.currentYear);
    }
  }, [kpi.data.currentYear, process.data, selectedYear]);

  const yearOptions = Array.from(new Set(["baseline_avg", ...process.data.map((item) => item.year)])).filter(Boolean);
  const selectedPie = process.data
    .filter((item) => item.year === selectedYear)
    .map((item) => ({ name: item.process, emission: item.emission }));
  const diff = kpi.data.baselineAvgEmission - kpi.data.currentEmission;
  const diffPct = kpi.data.baselineAvgEmission ? (diff / kpi.data.baselineAvgEmission) * 100 : 0;
  const processSummary = summarizeProcess(process.data, kpi.data.currentYear);
  const rankedProcessSummary = [...processSummary].sort((a, b) => b.cur - a.cur);
  const topProcess = rankedProcessSummary[0];
  const lowProcess = rankedProcessSummary[rankedProcessSummary.length - 1];

  return (
    <div className="cf-dash">
      <div className="page active">
        <div className="page-title">
          <div>
            <p className="eyebrow">01 · Overview</p>
            <h1>ภาพรวม Carbon Footprint ทั้งหมด</h1>
          </div>
          <SourceBadge source={kpi.source} meta={kpi.meta} loading={kpi.loading} />
        </div>

        {(kpi.error || trend.error || process.error || inputs.error) && (
          <div className="error-panel">
            ไม่สามารถโหลดข้อมูลจริงบางส่วนได้: {kpi.error ?? trend.error ?? process.error ?? inputs.error}
          </div>
        )}

        <section className="kpi-grid">
          {[
            ["Carbon รวม", kpi.data.currentEmission.toFixed(0), "tCO2e", `${diff >= 0 ? "ลดลง" : "เพิ่มขึ้น"} ${Math.abs(diffPct).toFixed(1)}% vs baseline`],
            ["Machine / Fuel", kpi.data.machineEmission.toFixed(1), "tCO2e", "จากข้อมูลกิจกรรมจริง"],
            ["จำนวนแปลงทั้งหมด", kpi.data.fields.toLocaleString(), "แปลง", "แปลงที่ร่วมโครงการ"],
            ["ปุ๋ยรวม", kpi.data.fertilizerAmountKg.toLocaleString(), "kg", `${kpi.data.fertilizerEmission.toFixed(1)} tCO2e จากปุ๋ย`],
            ["เทียบปีฐาน", Math.abs(diff).toFixed(0), "tCO2e", `${diff >= 0 ? "ลดลง" : "เพิ่มขึ้น"} ${Math.abs(diffPct).toFixed(1)}%`],
          ].map(([label, value, unit, delta]) => (
            <article className="kpi" key={label}>
              <div className="kpi-label">{label}</div>
              <div className="kpi-val">{value}</div>
              <div className="kpi-unit">{unit}</div>
              <div className={`delta ${diff >= 0 ? "good" : "bad"}`}>{delta}</div>
            </article>
          ))}
        </section>

        <section className="compare-row">
          <div className="compare-col">
            <div className="compare-label">ค่าเฉลี่ยปีฐาน</div>
            <div className="compare-val accent">{kpi.data.baselineAvgEmission.toFixed(0)}</div>
            <div className="compare-sub">tCO2e เฉลี่ยจากปีก่อนหน้า</div>
            <span className="compare-badge badge-blue">Baseline avg</span>
          </div>
          <div className="compare-divider" />
          <div className="compare-col">
            <div className="compare-label">ปีดำเนินโครงการ {kpi.data.currentYear}</div>
            <div className="compare-val green">{kpi.data.currentEmission.toFixed(0)}</div>
            <div className="compare-sub">tCO2e จากข้อมูลจริง</div>
            <span className="compare-badge badge-green">Project year</span>
          </div>
          <div className="compare-divider" />
          <div className="compare-col">
            <div className="compare-label">ผลต่างสุทธิ</div>
            <div className={`compare-val ${diff >= 0 ? "green" : "red"}`}>{Math.abs(diff).toFixed(0)}</div>
            <div className="compare-sub">tCO2e เทียบปีฐาน</div>
            <span className={`compare-badge ${diff >= 0 ? "badge-green" : "badge-red"}`}>
              {diff >= 0 ? "ลดลง" : "เพิ่มขึ้น"}
            </span>
          </div>
        </section>

        <section className="card full-span">
          <div className="card-title">Trend ตลอดระยะเวลาดำเนินการ · ปีฐานรายปีเทียบปีดำเนินโครงการ</div>
          <TrendLineChart data={trend.data} />
        </section>

        <section className="grid2">
          <article className="card">
            <div className="card-title">สรุปการใช้ทรัพยากรหลักของโครงการ</div>
            <div className="mini-stat-grid wide">
              <div><strong>{inputs.data.reduce((sum, item) => sum + item.currentFuelLiter, 0).toLocaleString()}</strong><span>ลิตรน้ำมันรวม</span></div>
              <div><strong>{kpi.data.fertilizerAmountKg.toLocaleString()}</strong><span>kg ปุ๋ยรวม</span></div>
              <div><strong>{kpi.data.fields.toLocaleString()}</strong><span>แปลงร่วมโครงการ</span></div>
              <div><strong>{Math.abs(diffPct).toFixed(1)}%</strong><span>{diff >= 0 ? "ลดลงจากปีฐาน" : "เพิ่มขึ้นจากปีฐาน"}</span></div>
            </div>
            <div className="summary-list">
              <div><span>น้ำมันเทียบปีฐาน</span><strong className="green-text">{inputs.data.reduce((sum, item) => sum + item.baselineFuelLiter - item.currentFuelLiter, 0).toLocaleString()} L ลดลง</strong></div>
              <div><span>ปุ๋ยเทียบปีฐาน</span><strong className="green-text">{inputs.data.reduce((sum, item) => sum + item.baselineFertilizerKg - item.currentFertilizerKg, 0).toLocaleString()} kg ลดลง</strong></div>
              <div><span>กระบวนการที่ปล่อยสูงสุด</span><strong>{topProcess ? `${topProcess.process} (${topProcess.cur.toFixed(0)} tCO2e)` : "-"}</strong></div>
              <div><span>กระบวนการที่ปล่อยต่ำสุด</span><strong>{lowProcess ? `${lowProcess.process} (${lowProcess.cur.toFixed(0)} tCO2e)` : "-"}</strong></div>
            </div>
          </article>

          <article className="card">
            <div className="card-title">ข้อมูลสรุปที่ควรพร้อมสำหรับ Dashboard หลัก</div>
            <div className="summary-list">
              <div><span>ขอบเขต</span><strong>กระบวนการเพาะปลูกอ้อย 4 ขั้นตอน</strong></div>
              <div><span>ตัวชี้วัดหลัก</span><strong>Carbon รวม, น้ำมัน, ปุ๋ย, แปลง, ผลต่างปีฐาน</strong></div>
              <div><span>แหล่งข้อมูลที่รอเชื่อมจริง</span><strong>กิจกรรม, แปลง, พื้นที่, EF/GWP, ผลคำนวณ</strong></div>
              <div><span>สถานะตอนนี้</span><strong>ใช้ mock data เพื่อดูหน้าตา dashboard</strong></div>
            </div>
          </article>
        </section>

        <section className="grid2">
          <article className="card">
            <div className="card-title">สัดส่วน 4 ขั้นตอนกระบวนการเพาะปลูก · {yearName(selectedYear)}</div>
            <div className="year-tabs">
              {yearOptions.map((year) => (
                <button className={`ytab ${year === selectedYear ? "active" : ""}`} key={year} onClick={() => setSelectedYear(year)}>
                  {yearName(year)}
                </button>
              ))}
            </div>
            <ProcessDoughnut data={selectedPie} />
          </article>
          <article className="card">
            <div className="card-title">Grouped Bar · เปรียบเทียบ 4 ขั้นตอน</div>
            <ProcessGroupedBar data={process.data} />
            <div className="summary-list ranked-list">
              {rankedProcessSummary.map((item, index) => (
                <div key={item.process} className={index === 0 ? "rank-top" : index === rankedProcessSummary.length - 1 ? "rank-low" : ""}>
                  <span>
                    <b className="rank-pill">{index + 1}</b>
                    {item.process}
                    {index === 0 && <em>ปล่อยมากสุด</em>}
                    {index === rankedProcessSummary.length - 1 && <em>ปล่อยน้อยสุด</em>}
                  </span>
                  <strong className={item.diff <= 0 ? "green-text" : "red-text"}>
                    {item.cur.toFixed(2)} tCO2e · {item.diff <= 0 ? "ลดลง" : "เพิ่มขึ้น"} {Math.abs(item.diff).toFixed(2)}
                  </strong>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="card full-span">
          <div className="card-title">เทียบสัดส่วนการใช้ปุ๋ยและน้ำมันรวม · ปีฐาน vs ปีดำเนินการ</div>
          <ProcessInputComparisonBar data={inputs.data} mode="total" />
        </section>

      </div>
    </div>
  );
}
