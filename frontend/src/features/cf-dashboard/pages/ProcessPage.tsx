import { useEffect, useMemo, useState } from "react";
import { ActivityGroupedBar } from "../components/charts/ActivityGroupedBar";
import { ProcessDoughnut } from "../components/charts/ProcessDoughnut";
import { getCfProcessActivities, getProcessEmissions } from "../services/dashboardApi";
import type { ProcessActivityBreakdown, ProcessEmission } from "../types/dashboard";
import "../cf-dashboard.css";

function yearName(year: string) {
  return year === "baseline_avg" ? "ค่าเฉลี่ยปีฐาน" : year;
}

function currentYearFrom(data: ProcessEmission[]) {
  return data.filter((item) => !item.isBaseline).map((item) => item.year).sort().at(-1) ?? "";
}

function ProcessSummary({ baseline, current }: { baseline: ProcessActivityBreakdown[]; current: ProcessActivityBreakdown[] }) {
  const rows = Array.from(new Set([...baseline, ...current].map((item) => item.process))).map((process) => {
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

export function CfProcessPage() {
  const [year, setYear] = useState("baseline_avg");
  const [activities, setActivities] = useState<ProcessActivityBreakdown[]>([]);
  const [emissions, setEmissions] = useState<ProcessEmission[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([getCfProcessActivities("process"), getProcessEmissions()])
      .then(([activityResult, emissionResult]) => {
        setActivities(activityResult.data);
        setEmissions(emissionResult.data);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "โหลดข้อมูลไม่สำเร็จ"));
  }, []);

  const currentYear = currentYearFrom(emissions);
  const years = useMemo(() => Array.from(new Set(activities.map((item) => item.year))).sort((a, b) => {
    if (a === "baseline_avg") return -1;
    if (b === "baseline_avg") return 1;
    return a.localeCompare(b);
  }), [activities]);
  const selected = activities.filter((item) => item.year === year);
  const baseline = activities.filter((item) => item.year === "baseline_avg");
  const current = activities.filter((item) => item.year === currentYear);
  const selectedPie = selected.map((item) => ({ name: item.process, emission: item.totalEmission }));

  return (
    <div className="cf-dash">
      <div className="page active">
        <div className="page-title">
          <div>
            <p className="eyebrow">02 · Process</p>
            <h1>สรุปกระบวนการเพาะปลูก</h1>
          </div>
          <div className="year-tabs">
            {(years.length ? years : ["baseline_avg", currentYear].filter(Boolean)).map((item) => (
              <button key={item} className={`ytab ${year === item ? "active" : ""}`} onClick={() => setYear(item)}>
                {yearName(item)}
              </button>
            ))}
          </div>
        </div>

        {error && <div className="error-panel">{error}</div>}

        <section className="grid2">
          <article className="card">
            <div className="card-title">วงกลมกระบวนการทั้งหมด · {yearName(year)}</div>
            <ProcessDoughnut data={selectedPie} />
          </article>
          <article className="card">
            <div className="card-title">Grouped Bar · ปีฐาน vs ปีดำเนินโครงการ</div>
            <ActivityGroupedBar baseline={baseline} current={current} />
            <ProcessSummary baseline={baseline} current={current} />
          </article>
        </section>

        <section className="sub-pie-grid">
          {selected.map((item) => (
            <article className="card sub-card" key={item.process}>
              <ProcessDoughnut title={`${item.process} · ${yearName(year)}`} data={item.activities} />
            </article>
          ))}
          {!selected.length && <div className="empty-state">ไม่มีข้อมูลกระบวนการเพาะปลูกสำหรับปีที่เลือก</div>}
        </section>
      </div>
    </div>
  );
}
