import { Line } from "react-chartjs-2";
import type { TrendPoint } from "../../types/dashboard";
import { chartOptions } from "./ChartRegistry";
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
              borderColor: "#FFB86B",
              backgroundColor: "rgba(255,184,107,.12)",
              pointBackgroundColor: "#FFB86B",
              tension: 0.35,
              spanGaps: true,
              fill: false,
            },
            {
              label: "ค่าเฉลี่ยปีฐาน",
              data: data.map(() => baselineAverage),
              borderColor: "#5BA4FF",
              backgroundColor: "rgba(91,164,255,.08)",
              pointRadius: 0,
              borderDash: [6, 5],
              tension: 0,
              fill: false,
            },
            {
              label: "ปีดำเนินโครงการ",
              data: data.map((item) => (!item.isBaseline ? item.emission : null)),
              borderColor: "#277B27",
              backgroundColor: "rgba(39,123,39,.12)",
              pointBackgroundColor: "#277B27",
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
