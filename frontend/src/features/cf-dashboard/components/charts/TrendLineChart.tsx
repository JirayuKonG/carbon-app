import { Chart } from "react-chartjs-2";
import type { TrendPoint } from "../../types/dashboard";
import { chartOptions, chartPalette } from "./ChartRegistry";
import "./ChartRegistry";

export function TrendLineChart({ data }: { data: TrendPoint[] }) {
  const baselineAverage = data.find((item) => typeof item.baselineAverage === "number")?.baselineAverage ?? 0;
  return (
    <div className="chart-box">
      <Chart
        type="bar"
        data={{
          labels: data.map((item) => item.year),
          datasets: [
            {
              type: "bar" as const,
              label: "ปีฐาน Baseline",
              data: data.map((item) => (item.isBaseline ? item.emission : null)),
              borderColor: chartPalette.baseline.border,
              backgroundColor: chartPalette.baseline.bg,
              borderWidth: 1,
              borderRadius: 6,
            },
            {
              type: "bar" as const,
              label: "ปีดำเนินโครงการ",
              data: data.map((item) => (!item.isBaseline ? item.emission : null)),
              borderColor: chartPalette.project.border,
              backgroundColor: chartPalette.project.bg,
              borderWidth: 1,
              borderRadius: 6,
            },
            {
              type: "line" as const,
              label: "แนวโน้มรายปี",
              data: data.map((item) => item.emission),
              borderColor: "#EA580C",
              backgroundColor: "rgba(234, 88, 12, .12)",
              pointBackgroundColor: data.map((item) => (item.isBaseline ? chartPalette.trendBaseline : chartPalette.trendProject)),
              tension: 0.35,
              fill: false,
            },
            {
              type: "line" as const,
              label: "ค่าเฉลี่ยปีฐาน",
              data: data.map(() => baselineAverage),
              borderColor: chartPalette.trendAverage,
              backgroundColor: "rgba(22,163,74,.12)",
              pointRadius: 0,
              borderDash: [6, 5],
              tension: 0,
              fill: false,
            },
          ],
        }}
        options={chartOptions}
      />
    </div>
  );
}
