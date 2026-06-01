import React from "react";
import { ProcessDoughnut } from "../components/charts/ProcessDoughnut";
import { ProcessGroupedBar } from "../components/charts/ProcessGroupedBar";
import { TrendLineChart } from "../components/charts/TrendLineChart";
import { SourceBadge } from "../components/common/SourceBadge";
import { ThailandMap } from "../components/map/ThailandMap";
import { useAsyncData } from "../hooks/useAsyncData";
import { getOverviewKpi, getProcessEmissions, getProvinceMap, getTrend } from "../services/dashboardApi";
import type { OverviewKpi, ProcessEmission, SpatialSummaryNode, TrendPoint } from "../types/dashboard";
import "../cf-dashboard.css";

const emptyKpi: OverviewKpi = {
  baselineAvgEmission: 0,
  currentEmission: 0,
  currentYear: "-",
  machineEmission: 0,
  inputEmission: 0,
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
  const spatial = useAsyncData<SpatialSummaryNode[]>(getProvinceMap, []);
  const [selectedYear, setSelectedYear] = React.useState("baseline_avg");
  const [selectedMapNode, setSelectedMapNode] = React.useState("thailand");

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

        {(kpi.error || trend.error || process.error || spatial.error) && (
          <div className="error-panel">
            ไม่สามารถโหลดข้อมูลจริงบางส่วนได้: {kpi.error ?? trend.error ?? process.error ?? spatial.error}
          </div>
        )}

        <section className="kpi-grid">
          {[
            ["Carbon รวม", kpi.data.currentEmission.toFixed(0), "tCO2e", `${diff >= 0 ? "ลดลง" : "เพิ่มขึ้น"} ${Math.abs(diffPct).toFixed(1)}% vs baseline`],
            ["Machine / Fuel", kpi.data.machineEmission.toFixed(1), "tCO2e", "จากข้อมูลกิจกรรมจริง"],
            ["Input CO2e", kpi.data.inputEmission.toFixed(1), "tCO2e", "ปุ๋ย / สารเคมี / input"],
            ["CO2e ต่อไร่", kpi.data.co2ePerTon.toFixed(3), "tCO2e/ไร่", `ปีดำเนินการ ${kpi.data.currentYear}`],
            ["เกษตรกร / แปลง", `${kpi.data.farmers} / ${kpi.data.fields}`, "ราย / แปลง", "พร้อม drill-down"],
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
            <div className="card-title">สัดส่วน 5 ขั้นตอน · {yearName(selectedYear)}</div>
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
            <div className="card-title">Grouped Bar · เปรียบเทียบ 5 ขั้นตอน</div>
            <ProcessGroupedBar data={process.data} />
            <div className="summary-list">
              {processSummary.map((item) => (
                <div key={item.process}>
                  <span>{item.process}</span>
                  <strong className={item.diff <= 0 ? "green-text" : "red-text"}>
                    {item.diff <= 0 ? "ลดลง" : "เพิ่มขึ้น"} {Math.abs(item.diff).toFixed(2)} tCO2e
                  </strong>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="card map-card wide-map">
          <div className="card-title">Thailand Map · พื้นที่ที่ปล่อยคาร์บอนเพิ่มขึ้น/ลดลง</div>
          <ThailandMap nodes={spatial.data} selectedId={selectedMapNode} onSelect={setSelectedMapNode} />
        </section>
      </div>
    </div>
  );
}
