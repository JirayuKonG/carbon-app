import { Doughnut } from "react-chartjs-2";
import type { ActivityValue } from "../../types/dashboard";
import { chartColors } from "./ChartRegistry";
import "./ChartRegistry";

export function ProcessDoughnut({ title, data, comparisonData, unit = "tCO2e" }: { title?: string; data: ActivityValue[]; comparisonData?: ActivityValue[]; unit?: string }) {
  const total = data.reduce((sum, item) => sum + item.emission, 0);
  const totalLabel = total.toLocaleString(undefined, { maximumFractionDigits: 2 });
  const growthFor = (name: string, value: number) => {
    const previous = comparisonData?.find((item) => item.name === name)?.emission;
    if (previous === undefined || previous === 0) return undefined;
    return ((value - previous) / previous) * 100;
  };
  return (
    <div className="doughnut-wrap">
      {title && <h3>{title}</h3>}
      <div className="doughnut-canvas">
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
      </div>
      <div className="value-legend">
        {data.map((item, index) => {
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
