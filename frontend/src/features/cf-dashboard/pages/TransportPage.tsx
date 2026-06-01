import { useEffect, useMemo, useState } from "react";
import { ActivityGroupedBar } from "../components/charts/ActivityGroupedBar";
import { ProcessDoughnut } from "../components/charts/ProcessDoughnut";
import { getCfProcessActivities, getTransportEmissions } from "../services/dashboardApi";
import type { ProcessActivityBreakdown, ProcessEmission } from "../types/dashboard";
import "../cf-dashboard.css";

function yearName(year: string) {
  return year === "baseline_avg" ? "ค่าเฉลี่ยปีฐาน" : year;
}

function currentYearFrom(data: ProcessEmission[]) {
  return data.filter((item) => !item.isBaseline).map((item) => item.year).sort().at(-1) ?? "";
}

export function CfTransportPage() {
  const [year, setYear] = useState("baseline_avg");
  const [activities, setActivities] = useState<ProcessActivityBreakdown[]>([]);
  const [emissions, setEmissions] = useState<ProcessEmission[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([getCfProcessActivities("transport"), getTransportEmissions()])
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
            <p className="eyebrow">03 · Transport</p>
            <h1>สรุปกระบวนการขนส่งเข้าโรงงาน</h1>
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
            <div className="card-title">วงกลมขนส่งทั้งหมด · {yearName(year)}</div>
            <ProcessDoughnut data={selectedPie} />
          </article>
          <article className="card">
            <div className="card-title">แผนภูมิแท่ง · ค่าเฉลี่ยปีฐาน vs ปีดำเนินโครงการ</div>
            <ActivityGroupedBar baseline={baseline} current={current} />
            <div className="summary-list">
              {Array.from(new Set([...baseline, ...current].map((item) => item.process))).map((process) => {
                const base = baseline.find((item) => item.process === process)?.totalEmission ?? 0;
                const cur = current.find((item) => item.process === process)?.totalEmission ?? 0;
                const diff = cur - base;
                return (
                  <div key={process}>
                    <span>{process}</span>
                    <strong className={diff <= 0 ? "green-text" : "red-text"}>
                      {diff <= 0 ? "ลดลง" : "เพิ่มขึ้น"} {Math.abs(diff).toFixed(2)} tCO2e
                    </strong>
                  </div>
                );
              })}
              {!baseline.length && !current.length && <div className="empty-state">ไม่มีข้อมูลขนส่งสำหรับเปรียบเทียบ</div>}
            </div>
          </article>
        </section>

        <section className="sub-pie-grid">
          {selected.map((item) => (
            <article className="card sub-card" key={item.process}>
              <ProcessDoughnut title={`${item.process} · ${yearName(year)}`} data={item.activities} />
            </article>
          ))}
          {!selected.length && <div className="empty-state">ไม่มีข้อมูลขนส่งสำหรับปีที่เลือก</div>}
        </section>
      </div>
    </div>
  );
}
