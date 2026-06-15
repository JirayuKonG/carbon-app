import { Bar } from "react-chartjs-2";
import type { ProcessActivityBreakdown } from "../../types/dashboard";
import { chartOptions, chartPalette, sortProcessLabels } from "./ChartRegistry";
import "./ChartRegistry";

function wrapGroupedBarLabel(label: string, maxChars = 14, maxRows = 3) {
  const normalized = label.replace(/\s+/g, " ").trim();
  if (!normalized) return [label];
  const words = normalized.split(" ");
  const rows: string[] = [];
  let current = "";

  words.forEach((word) => {
    if (!current) {
      current = word;
      return;
    }
    if (`${current} ${word}`.length <= maxChars) {
      current = `${current} ${word}`;
      return;
    }
    rows.push(current);
    current = word;
  });
  if (current) rows.push(current);

  const splitRows = rows.flatMap((row) => {
    if (row.length <= maxChars) return [row];
    const chunks: string[] = [];
    for (let index = 0; index < row.length; index += maxChars) {
      chunks.push(row.slice(index, index + maxChars));
    }
    return chunks;
  });

  if (splitRows.length <= maxRows) return splitRows;
  return [...splitRows.slice(0, maxRows - 1), `${splitRows.slice(maxRows - 1).join("").slice(0, maxChars - 3)}...`];
}

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
  const chartLabels = labels.map((label) => wrapGroupedBarLabel(label));
  const maxLabelRows = Math.max(...chartLabels.map((label) => label.length), 1);
  const needsScroll = labels.length > 8;
  const chartHeight = Math.max(340, 292 + maxLabelRows * 28);
  const chartWidth = needsScroll ? Math.max(980, labels.length * 92) : "100%";
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
  const groupedBarOptions = {
    ...chartOptions,
    maintainAspectRatio: false,
    layout: {
      padding: {
        bottom: maxLabelRows * 10,
      },
    },
    scales: {
      ...chartOptions.scales,
      x: {
        ...chartOptions.scales.x,
        ticks: {
          ...chartOptions.scales.x.ticks,
          autoSkip: false,
          font: { size: needsScroll ? 11 : 12 },
          padding: 10,
        },
      },
    },
    datasets: {
      bar: {
        categoryPercentage: needsScroll ? 0.72 : 0.8,
        barPercentage: needsScroll ? 0.86 : 0.82,
      },
    },
  };

  return (
    <div className={`chart-box md activity-grouped-chart${needsScroll ? " is-scrollable" : ""}`} style={{ height: chartHeight }}>
      <div className="activity-grouped-canvas" style={{ width: chartWidth, height: chartHeight - 24 }}>
        <Bar
          data={{
            labels: chartLabels,
            datasets,
          }}
          options={groupedBarOptions}
        />
      </div>
    </div>
  );
}
