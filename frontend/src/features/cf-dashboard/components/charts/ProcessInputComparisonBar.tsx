import { Bar } from "react-chartjs-2";
import type { ProcessInputComparison } from "../../types/dashboard";
import { chartOptions, chartPalette, sortProcessLabels } from "./ChartRegistry";
import "./ChartRegistry";

export function ProcessInputComparisonBar({
  data,
  mode = "byProcess",
}: {
  data: ProcessInputComparison[];
  mode?: "byProcess" | "total";
}) {
  const processOrder = new Map(sortProcessLabels(data.map((item) => item.process)).map((process, index) => [process, index]));
  const processData = mode === "total" ? data : [...data].sort((a, b) => (processOrder.get(a.process) ?? 0) - (processOrder.get(b.process) ?? 0));
  const labels = mode === "total" ? ["ปุ๋ยรวม (kg)", "น้ำมันรวม (L)"] : processData.map((item) => item.process);
  const baselineData = mode === "total"
    ? [
        data.reduce((sum, item) => sum + item.baselineFertilizerKg, 0),
        data.reduce((sum, item) => sum + item.baselineFuelLiter, 0),
      ]
    : processData.map((item) => item.baselineFertilizerKg);
  const currentData = mode === "total"
    ? [
        data.reduce((sum, item) => sum + item.currentFertilizerKg, 0),
        data.reduce((sum, item) => sum + item.currentFuelLiter, 0),
      ]
    : processData.map((item) => item.currentFertilizerKg);
  const fuelBaselineData = processData.map((item) => item.baselineFuelLiter);
  const fuelCurrentData = processData.map((item) => item.currentFuelLiter);

  const datasets = mode === "total"
    ? [
        {
          label: "Baseline avg",
          data: baselineData,
          backgroundColor: chartPalette.baseline.bg,
          borderColor: chartPalette.baseline.border,
          borderWidth: 1,
        },
        {
          label: "Project year",
          data: currentData,
          backgroundColor: chartPalette.project.bg,
          borderColor: chartPalette.project.border,
          borderWidth: 1,
        },
      ]
    : [
        {
          label: "ปุ๋ย baseline (kg)",
          data: baselineData,
          backgroundColor: chartPalette.fertilizerBaseline.bg,
          borderColor: chartPalette.fertilizerBaseline.border,
          borderWidth: 1,
        },
        {
          label: "ปุ๋ย project (kg)",
          data: currentData,
          backgroundColor: chartPalette.fertilizerProject.bg,
          borderColor: chartPalette.fertilizerProject.border,
          borderWidth: 1,
        },
        {
          label: "น้ำมัน baseline (L)",
          data: fuelBaselineData,
          backgroundColor: chartPalette.fuelBaseline.bg,
          borderColor: chartPalette.fuelBaseline.border,
          borderWidth: 1,
        },
        {
          label: "น้ำมัน project (L)",
          data: fuelCurrentData,
          backgroundColor: chartPalette.fuelProject.bg,
          borderColor: chartPalette.fuelProject.border,
          borderWidth: 1,
        },
      ];

  return (
    <div className="chart-box md">
      <Bar data={{ labels, datasets }} options={chartOptions} />
    </div>
  );
}
