import { Doughnut } from "react-chartjs-2";
import type { ActivityValue } from "../../types/dashboard";
import { chartColors } from "./ChartRegistry";
import "./ChartRegistry";

export function ProcessDoughnut({ title, data }: { title?: string; data: ActivityValue[] }) {
  const total = data.reduce((sum, item) => sum + item.emission, 0);
  const totalLabel = total.toLocaleString(undefined, { maximumFractionDigits: 2 });
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
                    return `${context.label}: ${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} tCO2e`;
                  },
                },
              },
            },
          }}
        />
        <div className="doughnut-center-label" aria-label={`ปริมาณการปล่อยรวม ${totalLabel} tCO2e`}>
          <small>ปริมาณการปล่อย</small>
          <strong>{totalLabel}</strong>
          <span>tCO2e</span>
        </div>
      </div>
      <div className="value-legend">
        {data.map((item, index) => {
          const pct = total ? (item.emission / total) * 100 : 0;
          return (
            <div className="value-legend-row" key={item.name}>
              <span className="legend-swatch" style={{ background: chartColors[index % chartColors.length] }} />
              <span className="legend-name">{item.name}</span>
              <span className="legend-values">
                <strong>{item.emission.toLocaleString(undefined, { maximumFractionDigits: 2 })} tCO2e</strong>
                <small>{pct.toFixed(1)}%</small>
              </span>
            </div>
          );
        })}
        {!data.length && <div className="empty-state">ไม่มีข้อมูลสำหรับแผนภูมินี้</div>}
      </div>
    </div>
  );
}
