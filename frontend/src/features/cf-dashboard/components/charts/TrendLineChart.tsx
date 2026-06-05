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
              label: "ปริมาณรายปี",
              data: data.map((item) => item.emission),
              borderColor: data.map((item) => (item.isBaseline ? chartPalette.baseline.border : chartPalette.project.border)),
              backgroundColor: data.map((item) => (item.isBaseline ? chartPalette.baseline.bg : chartPalette.project.bg)),
              borderWidth: 1,
              borderRadius: 6,
            },
            {
              type: "line" as const,
              label: "แนวโน้มรายปี",
              data: data.map((item) => item.emission),
              borderColor: chartPalette.trendProject,
              backgroundColor: "rgba(246,153,136,.16)",
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
            {
              label: "ปีดำเนินโครงการ",
              data: data.map((item) => (!item.isBaseline ? item.emission : null)),
              borderColor: chartPalette.trendProject,
              backgroundColor: "rgba(246,153,136,.16)",
              pointBackgroundColor: chartPalette.trendProject,
              pointRadius: 5,
              tension: 0.35,
              spanGaps: true,
              fill: false,
            },
          ],
        }}
        options={chartOptions}
      />
    </div>
  );
}
