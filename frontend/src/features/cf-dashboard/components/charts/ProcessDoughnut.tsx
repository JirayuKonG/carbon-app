import { Bar, Doughnut } from "react-chartjs-2";
import type { TooltipItem } from "chart.js";
import type { ActivityValue } from "../../types/dashboard";
import { chartColors, chartOptions, chartPalette } from "./ChartRegistry";
import "./ChartRegistry";

export function ProcessDoughnut({
  title,
  data,
  comparisonData,
  unit = "tCO2e",
  variant = "doughnut",
}: {
  title?: string;
  data: ActivityValue[];
  comparisonData?: ActivityValue[];
  unit?: string;
  variant?: "doughnut" | "bar" | "comparisonBar";
}) {
  const total = data.reduce((sum, item) => sum + item.emission, 0);
  const totalLabel = total.toLocaleString(undefined, { maximumFractionDigits: 2 });
  const comparisonTotal = (comparisonData ?? []).reduce((sum, item) => sum + item.emission, 0);
  const comparisonDiff = comparisonTotal - total;
  const comparisonDiffPct = total ? (comparisonDiff / total) * 100 : 0;
  const comparisonMap = new Map((comparisonData ?? []).map((item) => [item.name, item.emission]));
  const comparisonLabels = Array.from(new Set([...data.map((item) => item.name), ...(comparisonData ?? []).map((item) => item.name)]));
  const growthFor = (name: string, value: number) => {
    const previous = comparisonMap.get(name);
    if (previous === undefined || previous === 0) return undefined;
    return ((value - previous) / previous) * 100;
  };
  const isBar = variant === "bar";
  const isComparisonBar = variant === "comparisonBar";
  const barOptions = {
    ...chartOptions,
    maintainAspectRatio: false,
    plugins: {
      ...chartOptions.plugins,
      legend: { display: isComparisonBar, labels: { color: "#5B728A", boxWidth: 12, font: { size: 12 } } },
      tooltip: {
        callbacks: {
          label: (context: TooltipItem<"bar">) => {
            const value = Number(context.parsed.y || 0);
            const growth = growthFor(String(context.label), value);
            const datasetLabel = context.dataset.label ? `${context.dataset.label}: ` : "";
            const lines = [`${datasetLabel}${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${unit}`];
            if (!isComparisonBar && growth !== undefined) {
              lines.push(`Delta/Growth: ${growth >= 0 ? "+" : ""}${growth.toFixed(1)}%`);
            }
            return lines;
          },
        },
      },
    },
    scales: {
      ...chartOptions.scales,
      x: {
        ...chartOptions.scales.x,
        ticks: {
          ...chartOptions.scales.x.ticks,
          font: { size: 11 },
          padding: 8,
        },
      },
    },
  };
  return (
    <div className="doughnut-wrap">
      {title && <h3>{title}</h3>}
      <div className={`doughnut-canvas${isBar || isComparisonBar ? " process-share-bar-canvas" : ""}`}>
        {isComparisonBar ? (
          <Bar
            data={{
              labels: comparisonLabels,
              datasets: [
                {
                  label: `ปีฐาน (${unit})`,
                  data: comparisonLabels.map((label) => data.find((item) => item.name === label)?.emission ?? 0),
                  backgroundColor: chartPalette.baseline.bg,
                  borderColor: chartPalette.baseline.border,
                  borderWidth: 1,
                },
                {
                  label: `ปีดำเนินการ (${unit})`,
                  data: comparisonLabels.map((label) => comparisonMap.get(label) ?? 0),
                  backgroundColor: chartPalette.project.bg,
                  borderColor: chartPalette.project.border,
                  borderWidth: 1,
                },
              ],
            }}
            options={barOptions}
          />
        ) : isBar ? (
          <Bar
            data={{
              labels: data.map((item) => item.name),
              datasets: [
                {
                  label: `ปริมาณการปล่อย (${unit})`,
                  data: data.map((item) => item.emission),
                  backgroundColor: data.map((_, index) => chartColors[index % chartColors.length]),
                  borderColor: data.map((_, index) => chartColors[index % chartColors.length]),
                  borderWidth: 1,
                },
              ],
            }}
            options={{ ...barOptions, plugins: { ...barOptions.plugins, legend: { display: false } } }}
          />
        ) : (
          <>
            <Doughnut
              data={{
                labels: data.map((item) => item.name),
                datasets: [
                  {
                    data: data.map((item) => item.emission),
                    backgroundColor: chartColors,
                    borderColor: "#FFFFFF",
                    borderWidth: 2,
                  },
                ],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                cutout: "62%",
                plugins: {
                  legend: {
                    display: false,
                    labels: { color: "#5B728A", boxWidth: 10, font: { size: 11 } },
                  },
                  tooltip: {
                    callbacks: {
                      label: (context) => {
                        const value = Number(context.parsed || 0);
                        const growth = growthFor(String(context.label), value);
                        const lines = [`${context.label}: ${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${unit}`];
                        if (growth !== undefined) {
                          lines.push(`Delta/Growth: ${growth >= 0 ? "+" : ""}${growth.toFixed(1)}%`);
                        }
                        return lines;
                      },
                    },
                  },
                },
              }}
            />
            <div className="doughnut-center-label" aria-label={`ปริมาณการปล่อยรวม ${totalLabel} ${unit}`}>
              <small>ปริมาณการปล่อย</small>
              <strong>{totalLabel}</strong>
              <span>{unit}</span>
            </div>
          </>
        )}
      </div>
      <div className={isComparisonBar ? "process-total-summary" : "value-legend"}>
        {isComparisonBar ? (
          <>
            <div className="process-total-card baseline">
              <span>ปีฐานรวมทุกกระบวนการ</span>
              <strong>{total.toLocaleString(undefined, { maximumFractionDigits: 2 })} {unit}</strong>
            </div>
            <div className="process-total-card current">
              <span>ปีดำเนินการรวมทุกกระบวนการ</span>
              <strong>{comparisonTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })} {unit}</strong>
            </div>
            <div className={`process-total-card delta ${comparisonDiff <= 0 ? "good" : "bad"}`}>
              <span>{comparisonDiff <= 0 ? "ลดลงจากปีฐาน" : "เพิ่มขึ้นจากปีฐาน"}</span>
              <strong>
                {Math.abs(comparisonDiff).toLocaleString(undefined, { maximumFractionDigits: 2 })} {unit}
                <small> ({comparisonDiff >= 0 ? "+" : "-"}{Math.abs(comparisonDiffPct).toFixed(1)}%)</small>
              </strong>
            </div>
          </>
        ) : data.map((item, index) => {
            const pct = total ? (item.emission / total) * 100 : 0;
            const growth = growthFor(item.name, item.emission);
            return (
              <div className="value-legend-row" key={item.name}>
                <span className="legend-swatch" style={{ background: chartColors[index % chartColors.length] }} />
                <span className="legend-name">{item.name}</span>
                <span className="legend-values">
                  <strong>{item.emission.toLocaleString(undefined, { maximumFractionDigits: 2 })} {unit}</strong>
                  <small>{pct.toFixed(1)}%</small>
                  {growth !== undefined && (
                    <small className={`growth-pill ${growth <= 0 ? "good" : "bad"}`}>
                      {growth >= 0 ? "+" : ""}{growth.toFixed(1)}%
                    </small>
                  )}
                </span>
              </div>
            );
          })}
        {!data.length && <div className="empty-state">ไม่มีข้อมูลสำหรับแผนภูมินี้</div>}
      </div>
    </div>
  );
}
