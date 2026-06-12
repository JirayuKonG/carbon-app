import { Bar } from "react-chartjs-2";
import type { ProcessActivityBreakdown } from "../../types/dashboard";
import { chartOptions, chartPalette, sortProcessLabels } from "./ChartRegistry";
import "./ChartRegistry";

export function ActivityGroupedBar({
  baseline,
  current,
  mode = "both",
  unit = "tCO2e",
}: {
  baseline: ProcessActivityBreakdown[];
  current: ProcessActivityBreakdown[];
  mode?: "both" | "baseline" | "current";
  unit?: string;
}) {
  const labels = sortProcessLabels(Array.from(new Set([...baseline, ...current].map((item) => item.process))));
  const baselineMap = new Map(baseline.map((item) => [item.process, item.totalEmission]));
  const currentMap = new Map(current.map((item) => [item.process, item.totalEmission]));
  const datasets = [
    mode !== "current"
      ? {
        label: `Baseline avg (${unit})`,
        data: labels.map((label) => baselineMap.get(label) ?? 0),
        backgroundColor: chartPalette.baseline.bg,
        borderColor: chartPalette.baseline.border,
        borderWidth: 1,
      }
      : undefined,
    mode !== "baseline"
      ? {
        label: `Project year (${unit})`,
        data: labels.map((label) => currentMap.get(label) ?? 0),
        backgroundColor: chartPalette.project.bg,
        borderColor: chartPalette.project.border,
        borderWidth: 1,
      }
      : undefined,
  ].filter((item): item is NonNullable<typeof item> => Boolean(item));

  return (
    <div className="chart-box md">
      <Bar
        data={{
          labels,
          datasets,
        }}
        options={chartOptions}
      />
    </div>
  );
}
