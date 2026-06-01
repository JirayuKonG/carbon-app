import { Bar } from "react-chartjs-2";
import type { ProcessEmission } from "../../types/dashboard";
import { chartOptions } from "./ChartRegistry";
import "./ChartRegistry";

export function ProcessGroupedBar({ data }: { data: ProcessEmission[] }) {
  const labels = Array.from(new Set(data.map((item) => item.process)));
  const baselineAvgRows = data.filter((item) => item.year === "baseline_avg");
  const currentYear = data.filter((item) => !item.isBaseline).map((item) => item.year).sort().at(-1);
  const baselineMap = new Map(baselineAvgRows.map((item) => [item.process, item.emission]));
  const currentMap = new Map(data.filter((item) => item.year === currentYear).map((item) => [item.process, item.emission]));

  return (
    <div className="chart-box md">
      <Bar
        data={{
          labels,
          datasets: [
            {
              label: "Baseline avg",
              data: labels.map((process) => baselineMap.get(process) ?? 0),
              backgroundColor: "rgba(255,184,107,.72)",
              borderColor: "#FFB86B",
              borderWidth: 1,
            },
            {
              label: currentYear ?? "Project year",
              data: labels.map((process) => currentMap.get(process) ?? 0),
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
