import { Bar } from "react-chartjs-2";
import type { ProcessActivityBreakdown } from "../../types/dashboard";
import { chartOptions } from "./ChartRegistry";
import "./ChartRegistry";

export function ActivityGroupedBar({
  baseline,
  current,
}: {
  baseline: ProcessActivityBreakdown[];
  current: ProcessActivityBreakdown[];
}) {
  const labels = Array.from(new Set([...baseline, ...current].map((item) => item.process)));
  const baselineMap = new Map(baseline.map((item) => [item.process, item.totalEmission]));
  const currentMap = new Map(current.map((item) => [item.process, item.totalEmission]));
  return (
    <div className="chart-box md">
      <Bar
        data={{
          labels,
          datasets: [
            {
              label: "Baseline avg",
              data: labels.map((label) => baselineMap.get(label) ?? 0),
              backgroundColor: "rgba(255,184,107,.72)",
              borderColor: "#FFB86B",
              borderWidth: 1,
            },
            {
              label: "Project year",
              data: labels.map((label) => currentMap.get(label) ?? 0),
              backgroundColor: "rgba(39,123,39,.72)",
              borderColor: "#277B27",
              borderWidth: 1,
            },
          ],
        }}
        options={chartOptions}
      />
    </div>
  );
}
