import { Doughnut } from "react-chartjs-2";
import type { ActivityValue } from "../../types/dashboard";
import { chartColors } from "./ChartRegistry";
import "./ChartRegistry";

export function ProcessDoughnut({ title, data }: { title?: string; data: ActivityValue[] }) {
  const total = data.reduce((sum, item) => sum + item.emission, 0);
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
            plugins: {
              legend: {
                display: false,
                labels: { color: "#5B728A", boxWidth: 10, font: { size: 11 } },
              },
            },
          }}
        />
      </div>
      <div className="value-legend">
        {data.map((item, index) => {
          const pct = total ? (item.emission / total) * 100 : 0;
          return (
            <div className="value-legend-row" key={item.name}>
              <span className="legend-swatch" style={{ background: chartColors[index % chartColors.length] }} />
              <span className="legend-name">{item.name}</span>
              <strong>{item.emission.toLocaleString(undefined, { maximumFractionDigits: 2 })} tCO2e</strong>
              <small>{pct.toFixed(1)}%</small>
            </div>
          );
        })}
        {!data.length && <div className="empty-state">ไม่มีข้อมูลสำหรับแผนภูมินี้</div>}
      </div>
    </div>
  );
}
