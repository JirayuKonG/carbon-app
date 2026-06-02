import { Bar } from "react-chartjs-2";
import type { ProcessInputComparison } from "../../types/dashboard";
import { chartOptions } from "./ChartRegistry";
import "./ChartRegistry";

export function ProcessInputComparisonBar({
  data,
  mode = "byProcess",
}: {
  data: ProcessInputComparison[];
  mode?: "byProcess" | "total";
}) {
  const labels = mode === "total" ? ["ปุ๋ยรวม (kg)", "น้ำมันรวม (L)"] : data.map((item) => item.process);
  const baselineData = mode === "total"
    ? [
        data.reduce((sum, item) => sum + item.baselineFertilizerKg, 0),
        data.reduce((sum, item) => sum + item.baselineFuelLiter, 0),
      ]
    : data.map((item) => item.baselineFertilizerKg);
  const currentData = mode === "total"
    ? [
        data.reduce((sum, item) => sum + item.currentFertilizerKg, 0),
        data.reduce((sum, item) => sum + item.currentFuelLiter, 0),
      ]
    : data.map((item) => item.currentFertilizerKg);
  const fuelBaselineData = data.map((item) => item.baselineFuelLiter);
  const fuelCurrentData = data.map((item) => item.currentFuelLiter);

  const datasets = mode === "total"
    ? [
        {
          label: "Baseline avg",
          data: baselineData,
          backgroundColor: "rgba(255,184,107,.72)",
          borderColor: "#FFB86B",
          borderWidth: 1,
        },
        {
          label: "Project year",
          data: currentData,
          backgroundColor: "rgba(39,123,39,.72)",
          borderColor: "#277B27",
          borderWidth: 1,
        },
      ]
    : [
        {
          label: "ปุ๋ย baseline (kg)",
          data: baselineData,
          backgroundColor: "rgba(255,184,107,.72)",
          borderColor: "#FFB86B",
          borderWidth: 1,
        },
        {
          label: "ปุ๋ย project (kg)",
          data: currentData,
          backgroundColor: "rgba(39,123,39,.72)",
          borderColor: "#277B27",
          borderWidth: 1,
        },
        {
          label: "น้ำมัน baseline (L)",
          data: fuelBaselineData,
          backgroundColor: "rgba(91,164,255,.58)",
          borderColor: "#5BA4FF",
          borderWidth: 1,
        },
        {
          label: "น้ำมัน project (L)",
          data: fuelCurrentData,
          backgroundColor: "rgba(183,156,255,.58)",
          borderColor: "#B79CFF",
          borderWidth: 1,
        },
      ];

  return (
    <div className="chart-box md">
      <Bar data={{ labels, datasets }} options={chartOptions} />
    </div>
  );
}
