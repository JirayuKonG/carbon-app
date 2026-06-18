import { Bar } from "react-chartjs-2";
import type { ProcessActivityBreakdown } from "../../types/dashboard";
import { chartOptions, chartPalette, sortProcessLabels } from "./ChartRegistry";
import "./ChartRegistry";

function isProcessStepLabel(label: string) {
  return /^\d+\.\s/.test(label.trim());
}

function splitProcessCodePrefix(label: string) {
  const match = label.match(/^(\d+\s*-\s*\[[^\]]+\])\s+(.+)$/);
  if (!match) return undefined;
  return { code: match[1], name: match[2] };
}

function tokenizeLabelName(label: string) {
  const normalized = label.replace(/\s+/g, " ").trim();
  if (!normalized) return [];

  const hasThai = /[\u0E00-\u0E7F]/.test(normalized);
  const segmenter = hasThai && typeof Intl !== "undefined" && "Segmenter" in Intl
    ? new (Intl as any).Segmenter("th", { granularity: "word" })
    : undefined;

  if (segmenter) {
    return Array.from(segmenter.segment(normalized))
      .map((item: any) => String(item.segment).trim())
      .filter(Boolean);
  }

  return normalized.includes(" ") ? normalized.split(" ") : [normalized];
}

function wrapLabelName(label: string, maxChars: number, maxRows: number) {
  const tokens = tokenizeLabelName(label);
  const hasThai = /[\u0E00-\u0E7F]/.test(label);
  const rows: string[] = [];
  let current = "";

  tokens.forEach((token) => {
    const separator = current && !hasThai ? " " : "";
    const next = `${current}${separator}${token}`;
    if (!current || next.length <= maxChars) {
      current = next;
      return;
    }
    rows.push(current);
    current = token;
  });
  if (current) rows.push(current);

  if (!rows.length) return [label];
  if (rows.length <= maxRows) return rows;
  const lastRow = rows.slice(maxRows - 1).join(hasThai ? "" : " ");
  return [...rows.slice(0, maxRows - 1), lastRow];
}

function wrapGroupedBarLabel(label: string, maxChars = 14, maxRows = 3): string | string[] {
  const normalized = label.replace(/\s+/g, " ").trim();
  if (!normalized) return label;
  if (isProcessStepLabel(normalized)) return normalized;
  const processPrefix = splitProcessCodePrefix(normalized);
  if (processPrefix) {
    return [
      processPrefix.code,
      ...wrapLabelName(processPrefix.name, Math.max(maxChars + 4, 18), maxRows - 1),
    ];
  }

  return wrapLabelName(normalized, maxChars, maxRows);
}

const differencePlugin = {
  id: "differencePlugin",
  afterDatasetsDraw(chart: any) {
    if (chart.config.data.datasets.length !== 2) return;
    const ctx = chart.ctx;
    const metaA = chart.getDatasetMeta(0);
    const metaB = chart.getDatasetMeta(1);
    if (metaA.hidden || metaB.hidden) return;

    chart.data.labels.forEach((_: any, i: number) => {
      const barA = metaA.data[i];
      const barB = metaB.data[i];
      if (!barA || !barB) return;

      const valA = chart.data.datasets[0].data[i] as number;
      const valB = chart.data.datasets[1].data[i] as number;
      if (valA === 0 && valB === 0) return;

      const diff = valB - valA;
      const diffPercent = valA > 0 ? (diff / valA) * 100 : 0;
      const isUp = diff > 0;
      const sign = isUp ? "+" : "";

      const textVal = `${isUp ? "เพิ่ม" : "ลด"} ${Math.abs(diff).toLocaleString(undefined, { maximumFractionDigits: 1 })}`;
      const textPct = `(${sign}${diffPercent.toFixed(1)}%)`;

      const y = Math.min(barA.y, barB.y) - 6;
      const x = (barA.x + barB.x) / 2;

      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillStyle = isUp ? "#DC2626" : "#059669";
      
      ctx.font = "bold 11px Inter, sans-serif";
      ctx.fillText(textVal, x, y - 12);
      
      ctx.font = "10px Inter, sans-serif";
      ctx.fillText(textPct, x, y);
      
      ctx.restore();
    });
  },
};

export function ActivityGroupedBar({
  baseline,
  current,
  mode = "both",
  unit = "tCO2e",
  baselineLabel = "Baseline avg",
  currentLabel = "Project year",
}: {
  baseline: ProcessActivityBreakdown[];
  current: ProcessActivityBreakdown[];
  mode?: "both" | "baseline" | "current";
  unit?: string;
  baselineLabel?: string;
  currentLabel?: string;
}) {
  const labels = sortProcessLabels(Array.from(new Set([...baseline, ...current].map((item) => item.process))));
  const chartLabels = labels.map((label) => wrapGroupedBarLabel(label));
  const maxLabelRows = Math.max(...chartLabels.map((label) => Array.isArray(label) ? label.length : 1), 1);
  const hasProcessSteps = labels.some(isProcessStepLabel);
  const hasLongSingleLineLabel = chartLabels.some((label) => !Array.isArray(label) && label.length > 16);
  const needsScroll = labels.length > 8 || hasLongSingleLineLabel;
  const chartHeight = Math.max(340, 292 + maxLabelRows * 28);
  const chartWidth = needsScroll
    ? Math.max(hasProcessSteps ? 1120 : 980, labels.length * (hasProcessSteps ? 260 : 92))
    : "100%";
  const baselineMap = new Map(baseline.map((item) => [item.process, item.totalEmission]));
  const currentMap = new Map(current.map((item) => [item.process, item.totalEmission]));
  const datasets = [
    mode !== "current"
      ? {
        label: `${baselineLabel} (${unit})`,
        data: labels.map((label) => baselineMap.get(label) ?? 0),
        backgroundColor: chartPalette.baseline.bg,
        borderColor: chartPalette.baseline.border,
        borderWidth: 1,
      }
      : undefined,
    mode !== "baseline"
      ? {
        label: `${currentLabel} (${unit})`,
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
        top: mode === "both" ? 40 : 10,
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
      y: {
        ...chartOptions.scales.y,
        grace: "20%",
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
          plugins={mode === "both" ? [differencePlugin] : []}
        />
      </div>
    </div>
  );
}
