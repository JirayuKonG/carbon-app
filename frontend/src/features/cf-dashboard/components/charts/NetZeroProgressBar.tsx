import { Bar } from "react-chartjs-2";
import { chartOptions } from "./ChartRegistry";
import "./ChartRegistry";

export function NetZeroProgressBar({
  emissions,
  credits,
}: {
  emissions: number;
  credits: number;
}) {
  return (
    <div className="chart-box md">
      <Bar
        data={{
          labels: ["Carbon balance"],
          datasets: [
            {
              label: "Emissions",
              data: [emissions],
              backgroundColor: "rgba(220, 38, 38, .78)",
              borderColor: "#DC2626",
              borderWidth: 1,
            },
            {
              label: "Credits",
              data: [credits],
              backgroundColor: "rgba(16, 163, 69, .78)",
              borderColor: "#10A345",
              borderWidth: 1,
            },
          ],
        }}
        options={chartOptions}
      />
    </div>
  );
}
