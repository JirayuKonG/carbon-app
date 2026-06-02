import { Line } from "react-chartjs-2";
import type { TrendPoint } from "../../types/dashboard";
import { chartOptions, chartPalette } from "./ChartRegistry";
import "./ChartRegistry";

export function TrendLineChart({ data }: { data: TrendPoint[] }) {
  const baselineAverage = data.find((item) => typeof item.baselineAverage === "number")?.baselineAverage ?? 0;
  return (
    <div className="chart-box">
      <Line
        data={{
          labels: data.map((item) => item.year),
          datasets: [
            {
              label: "ปีฐานรายปี",
              data: data.map((item) => (item.isBaseline ? item.emission : null)),
              borderColor: chartPalette.trendBaseline,
              backgroundColor: "rgba(175,191,255,.16)",
              pointBackgroundColor: chartPalette.trendBaseline,
              tension: 0.35,
              spanGaps: true,
              fill: false,
            },
            {
              label: "ค่าเฉลี่ยปีฐาน",
              data: data.map(() => baselineAverage),
              borderColor: chartPalette.trendAverage,
              backgroundColor: "rgba(206,147,216,.10)",
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
