import { Line } from "react-chartjs-2";
import type { ProcessInputComparison } from "../../types/dashboard";
import { chartOptions } from "./ChartRegistry";
import "./ChartRegistry";

export function SocCorrelationChart({
  data,
  socValues,
}: {
  data: ProcessInputComparison[];
  socValues: number[];
}) {
  const points = data.map((item, index) => ({
    x: item.currentFertilizerKg,
    y: socValues[index] ?? 0,
  }));

  return (
    <div className="chart-box md">
      <Line
        data={{
          datasets: [
            {
              label: "SOC vs fertilizer",
              data: points,
              parsing: false,
              showLine: false,
              pointRadius: 6,
              pointHoverRadius: 8,
              pointBackgroundColor: "#10A345",
              pointBorderColor: "#0F7A35",
              borderColor: "#10A345",
            },
          ],
        }}
        options={{
          ...chartOptions,
          scales: {
            x: {
              type: "linear",
              title: { display: true, text: "ปุ๋ยเคมีปีดำเนินการ (kg)", color: "#5B728A" },
              ticks: { color: "#5B728A" },
              grid: { color: "rgba(180,200,220,0.25)" },
            },
            y: {
              title: { display: true, text: "SOC index", color: "#5B728A" },
              ticks: { color: "#5B728A" },
              grid: { color: "rgba(180,200,220,0.25)" },
            },
          },
        }}
      />
    </div>
  );
}
